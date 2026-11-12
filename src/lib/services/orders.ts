import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma, type Tx } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { parseDateTimeLocal } from "@/lib/dates";
import { computeOrderTotals } from "@/lib/domain/order-calc";
import { ORDER_STATUS_LABEL } from "@/lib/domain/labels";
import type { OrderParsed } from "@/lib/validation";
import { reconcileOrderStock } from "./stock";
import { addPaymentTx, lockOrder, recalcOrderPayment } from "./payments";

export function variantDisplayName(v: { customName: string | null; presentation: { name: string } | null }) {
  return v.customName ?? v.presentation?.name ?? "Padrão";
}

const EDITABLE_STATUSES: OrderStatus[] = ["PENDING", "IN_PREPARATION", "READY"];

type ResolvedItem = {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  unitPriceCents: number;
  quantity: number;
  totalCents: number;
  stockConsumptionMilli: number | null;
  notes: string | null;
};

/**
 * Resolve os itens do formulário em itens com preço "fotografado".
 * - Itens novos: preço atual do catálogo; o produto precisa estar ativo e disponível.
 * - Itens existentes (edição, mesmo id e mesma variante): mantêm o preço, nomes e consumo
 *   originais da venda — alterações de preço no catálogo não afetam pedidos já feitos.
 */
async function resolveItems(
  tx: Tx,
  items: OrderParsed["items"],
  existing: Map<string, { variantId: string } & Omit<ResolvedItem, "quantity" | "totalCents" | "notes">>,
): Promise<ResolvedItem[]> {
  const newVariantIds = [...new Set(items.filter((i) => !(i.id && existing.has(i.id))).map((i) => i.variantId))];
  const variants = newVariantIds.length
    ? await tx.productVariant.findMany({
        where: { id: { in: newVariantIds } },
        include: { product: true, presentation: { select: { name: true } } },
      })
    : [];
  const byId = new Map(variants.map((v) => [v.id, v]));

  return items.map((item) => {
    const prev = item.id ? existing.get(item.id) : undefined;
    if (prev && prev.variantId === item.variantId) {
      return {
        productId: prev.productId,
        variantId: prev.variantId,
        productName: prev.productName,
        variantName: prev.variantName,
        unitPriceCents: prev.unitPriceCents,
        stockConsumptionMilli: prev.stockConsumptionMilli,
        quantity: item.quantity,
        totalCents: prev.unitPriceCents * item.quantity,
        notes: item.notes,
      };
    }
    const v = byId.get(item.variantId);
    if (!v) throw new DomainError("Um dos produtos selecionados não existe mais. Atualize a página.");
    if (!v.product.active || !v.active) {
      throw new DomainError(`"${v.product.name}" foi desativado e não pode ser vendido.`);
    }
    if (!v.product.isAvailable) {
      throw new DomainError(`"${v.product.name}" está indisponível para venda no momento.`);
    }
    if (v.product.trackStock && !v.stockConsumptionMilli) {
      throw new DomainError(
        `Configure o consumo de estoque de "${v.product.name} (${variantDisplayName(v)})" antes de vendê-lo.`,
      );
    }
    return {
      productId: v.productId,
      variantId: v.id,
      productName: v.product.name,
      variantName: variantDisplayName(v),
      unitPriceCents: v.priceCents,
      stockConsumptionMilli: v.product.trackStock ? v.stockConsumptionMilli : null,
      quantity: item.quantity,
      totalCents: v.priceCents * item.quantity,
      notes: item.notes,
    };
  });
}

async function assertCustomer(tx: Tx, customerId: string | null) {
  if (!customerId) return;
  const c = await tx.customer.findUnique({ where: { id: customerId }, select: { deletedAt: true } });
  if (!c || c.deletedAt) throw new DomainError("Cliente não encontrado.");
}

function headerData(input: OrderParsed, totals: ReturnType<typeof computeOrderTotals>, timezone: string) {
  const scheduledFor = input.scheduledFor ? parseDateTimeLocal(input.scheduledFor, timezone) : null;
  if (input.scheduledFor && !scheduledFor) throw new DomainError("Data/horário previstos inválidos.");
  return {
    customerId: input.customerId,
    fulfillment: input.fulfillment,
    deliveryAddress: input.fulfillment === "DELIVERY" ? input.deliveryAddress : null,
    scheduledFor,
    discountType: input.discountValue > 0 ? input.discountType : null,
    discountValue: input.discountType ? input.discountValue : 0,
    preferredPaymentMethod: input.preferredPaymentMethod,
    notes: input.notes,
    ...totals,
  };
}

export async function createOrder(input: OrderParsed, timezone: string) {
  if (input.idempotencyKey) {
    const existing = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return { order: existing, duplicated: true };
  }
  try {
    const order = await prisma.$transaction(async (tx) => {
      await assertCustomer(tx, input.customerId);
      const items = await resolveItems(tx, input.items, new Map());
      const totals = computeOrderTotals({
        items,
        discountType: input.discountType,
        discountValue: input.discountValue,
        deliveryFeeCents: input.fulfillment === "DELIVERY" ? input.deliveryFeeCents : 0,
      });
      const created = await tx.order.create({
        data: {
          ...headerData(input, totals, timezone),
          deliveryFeeCents: totals.deliveryFeeCents,
          idempotencyKey: input.idempotencyKey ?? null,
          items: { create: items },
          statusHistory: { create: { fromStatus: null, toStatus: "PENDING", note: "Pedido criado" } },
        },
      });
      await reconcileOrderStock(tx, created.id);
      if (input.payNow && input.payNow.amountCents > 0) {
        await addPaymentTx(tx, {
          orderId: created.id,
          kind: "PAYMENT",
          method: input.payNow.method,
          amountCents: input.payNow.amountCents,
        });
      }
      return tx.order.findUniqueOrThrow({ where: { id: created.id } });
    });
    return { order, duplicated: false };
  } catch (err) {
    // Clique duplo simultâneo: a segunda transação esbarra na chave única.
    if (
      input.idempotencyKey &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const existing = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return { order: existing, duplicated: true };
    }
    throw err;
  }
}

export async function updateOrder(orderId: string, input: OrderParsed, timezone: string) {
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const current = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    if (!EDITABLE_STATUSES.includes(current.status)) {
      throw new DomainError(`Pedidos com status "${ORDER_STATUS_LABEL[current.status]}" não podem ser editados.`);
    }
    await assertCustomer(tx, input.customerId);
    const existing = new Map(current.items.map((i) => [i.id, i]));
    const items = await resolveItems(tx, input.items, existing);
    const totals = computeOrderTotals({
      items,
      discountType: input.discountType,
      discountValue: input.discountValue,
      deliveryFeeCents: input.fulfillment === "DELIVERY" ? input.deliveryFeeCents : 0,
    });
    await tx.orderItem.deleteMany({ where: { orderId } });
    await tx.order.update({
      where: { id: orderId },
      data: {
        ...headerData(input, totals, timezone),
        deliveryFeeCents: totals.deliveryFeeCents,
        items: { create: items },
      },
    });
    await reconcileOrderStock(tx, orderId);
    return recalcOrderPayment(tx, orderId);
  });
}

export async function changeOrderStatus(orderId: string, to: Exclude<OrderStatus, "CANCELLED">, note?: string | null) {
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } });
    if (order.status === "CANCELLED") throw new DomainError("Pedido cancelado não pode mudar de status.");
    if (order.status === to) return tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: to, completedAt: to === "DELIVERED" ? new Date() : null },
    });
    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: order.status, toStatus: to, note: note ?? null },
    });
    return updated;
  });
}

export async function cancelOrder(orderId: string, reason: string | null) {
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } });
    if (order.status === "CANCELLED") throw new DomainError("Este pedido já está cancelado.");
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
    });
    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: order.status, toStatus: "CANCELLED", note: reason ? `Motivo: ${reason}` : null },
    });
    await reconcileOrderStock(tx, orderId); // devolve ao estoque o que foi baixado
    return updated;
  });
}

export const orderDetailInclude = {
  customer: true,
  items: { orderBy: { createdAt: "asc" } },
  payments: { orderBy: { paidAt: "asc" } },
  statusHistory: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderInclude;

export async function getOrderDetail(id: string) {
  return prisma.order.findUnique({ where: { id }, include: orderDetailInclude });
}

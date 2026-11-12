import type { InventoryMovementType } from "@prisma/client";
import { prisma, type Tx } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { formatMilli } from "@/lib/money";
import { requiredConsumption, stockDeltas } from "@/lib/domain/stock";

/** Aplica uma variação atômica no saldo e registra a movimentação. */
async function applyDelta(
  tx: Tx,
  args: { productId: string; deltaMilli: number; type: InventoryMovementType; orderId?: string | null; reason?: string | null },
) {
  const product = await tx.product.update({
    where: { id: args.productId },
    data: { stockMilli: { increment: args.deltaMilli } },
    select: { id: true, name: true, stockMilli: true, allowNegativeStock: true, trackStock: true, stockUnit: true },
  });
  if (args.deltaMilli < 0 && product.stockMilli < 0 && !product.allowNegativeStock) {
    const available = product.stockMilli - args.deltaMilli;
    throw new DomainError(
      `Estoque insuficiente de "${product.name}": disponível ${formatMilli(Math.max(available, 0))} ${product.stockUnit ?? ""}, necessário ${formatMilli(-args.deltaMilli)}.`.replace(/\s+,/, ","),
    );
  }
  await tx.inventoryMovement.create({
    data: {
      productId: args.productId,
      type: args.type,
      quantityMilli: args.deltaMilli,
      balanceAfterMilli: product.stockMilli,
      orderId: args.orderId ?? null,
      reason: args.reason ?? null,
    },
  });
}

/**
 * Reconcilia o estoque de um pedido (ver regra em lib/domain/stock.ts).
 * Deve ser chamada dentro da transação, após travar a linha do pedido.
 */
export async function reconcileOrderStock(tx: Tx, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      status: true,
      items: { select: { productId: true, quantity: true, stockConsumptionMilli: true } },
      movements: { where: { type: { in: ["SALE", "SALE_REVERSAL"] } }, select: { productId: true, quantityMilli: true } },
    },
  });
  const required = requiredConsumption(order.items, order.status === "CANCELLED");
  const deltas = stockDeltas(required, order.movements);
  // ordem determinística evita deadlocks entre transações concorrentes
  for (const productId of [...deltas.keys()].sort()) {
    const delta = deltas.get(productId)!;
    await applyDelta(tx, {
      productId,
      deltaMilli: delta,
      type: delta < 0 ? "SALE" : "SALE_REVERSAL",
      orderId,
    });
  }
}

export async function registerManualMovement(input: {
  productId: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantityMilli: number;
  reason: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ stockMilli: number; trackStock: boolean }[]>`
      SELECT "stockMilli", "trackStock" FROM "Product" WHERE id = ${input.productId} FOR UPDATE`;
    if (!locked) throw new DomainError("Produto não encontrado.");
    if (!locked.trackStock) throw new DomainError("Ative o controle de estoque deste produto antes de lançar movimentações.");

    let delta: number;
    if (input.type === "IN") delta = input.quantityMilli;
    else if (input.type === "OUT") delta = -input.quantityMilli;
    else delta = input.quantityMilli - locked.stockMilli;

    if (input.type !== "ADJUSTMENT" && input.quantityMilli <= 0) throw new DomainError("Informe uma quantidade maior que zero.");
    if (delta === 0) throw new DomainError("O saldo informado é igual ao atual — nada a ajustar.");
    await applyDelta(tx, { productId: input.productId, deltaMilli: delta, type: input.type, reason: input.reason });
  });
}

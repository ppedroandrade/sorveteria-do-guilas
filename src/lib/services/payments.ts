import { prisma, type Tx } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { parseDateTimeLocal } from "@/lib/dates";
import { assertPaymentAllowed, derivePaymentStatus } from "@/lib/domain/payments";
import type { PaymentKind, PaymentMethod } from "@prisma/client";

export async function lockOrder(tx: Tx, orderId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
  if (!rows.length) throw new DomainError("Pedido não encontrado.");
}

/** Recalcula paidCents e paymentStatus a partir dos lançamentos (fonte da verdade). */
export async function recalcOrderPayment(tx: Tx, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { totalCents: true, payments: { select: { kind: true, amountCents: true } } },
  });
  let net = 0;
  for (const p of order.payments) net += p.kind === "REFUND" ? -p.amountCents : p.amountCents;
  const paymentStatus = derivePaymentStatus(order.totalCents, order.payments);
  return tx.order.update({ where: { id: orderId }, data: { paidCents: net, paymentStatus } });
}

export async function addPaymentTx(
  tx: Tx,
  input: {
    orderId: string;
    kind: PaymentKind;
    method: PaymentMethod;
    amountCents: number;
    paidAt?: Date | null;
    notes?: string | null;
    idempotencyKey?: string | null;
  },
) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: input.orderId },
    select: { status: true, totalCents: true, paidCents: true },
  });
  assertPaymentAllowed({
    orderStatus: order.status,
    totalCents: order.totalCents,
    netPaidCents: order.paidCents,
    kind: input.kind,
    amountCents: input.amountCents,
  });
  if (input.paidAt && input.paidAt.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new DomainError("A data do pagamento não pode estar no futuro.");
  }
  const payment = await tx.payment.create({
    data: {
      orderId: input.orderId,
      kind: input.kind,
      method: input.method,
      amountCents: input.amountCents,
      paidAt: input.paidAt ?? new Date(),
      notes: input.notes ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });
  await recalcOrderPayment(tx, input.orderId);
  return payment;
}

export async function addPayment(
  input: {
    orderId: string;
    kind: PaymentKind;
    method: PaymentMethod;
    amountCents: number;
    paidAt?: string | null;
    notes?: string | null;
    idempotencyKey?: string | null;
  },
  timezone: string,
) {
  if (input.idempotencyKey) {
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return { payment: existing, duplicated: true };
  }
  const paidAt = input.paidAt ? parseDateTimeLocal(input.paidAt, timezone) : null;
  if (input.paidAt && !paidAt) throw new DomainError("Data do pagamento inválida.");
  const payment = await prisma.$transaction(async (tx) => {
    await lockOrder(tx, input.orderId);
    return addPaymentTx(tx, { ...input, paidAt });
  });
  return { payment, duplicated: false };
}

/** Remove um lançamento feito por engano. */
export async function deletePayment(paymentId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new DomainError("Lançamento não encontrado.");
    await lockOrder(tx, payment.orderId);
    await tx.payment.delete({ where: { id: paymentId } });
    const order = await recalcOrderPayment(tx, payment.orderId);
    if (order.paidCents < 0) throw new DomainError("Remova primeiro o reembolso vinculado a este pagamento.");
    return order;
  });
}

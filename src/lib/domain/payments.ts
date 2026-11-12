import type { OrderStatus, PaymentKind, PaymentStatus } from "@prisma/client";

export type PaymentLike = { kind: PaymentKind; amountCents: number };

export function summarizePayments(payments: PaymentLike[]) {
  let paid = 0;
  let refunded = 0;
  for (const p of payments) {
    if (p.kind === "REFUND") refunded += p.amountCents;
    else paid += p.amountCents;
  }
  return { grossPaidCents: paid, refundedCents: refunded, netPaidCents: paid - refunded };
}

/**
 * Situação financeira derivada (fonte da verdade = lançamentos de pagamento):
 * - Reembolsado: houve reembolso e o saldo líquido recebido voltou a zero.
 * - Pago: líquido recebido ≥ total do pedido (pedido de valor zero também é "pago").
 * - Parcial: recebeu algo, mas menos que o total.
 * - Pendente: nada recebido.
 */
export function derivePaymentStatus(totalCents: number, payments: PaymentLike[]): PaymentStatus {
  const { refundedCents, netPaidCents } = summarizePayments(payments);
  if (refundedCents > 0 && netPaidCents <= 0) return "REFUNDED";
  if (netPaidCents <= 0) return totalCents === 0 ? "PAID" : "PENDING";
  if (netPaidCents >= totalCents) return "PAID";
  return "PARTIAL";
}

export function balanceDueCents(totalCents: number, netPaidCents: number, status: OrderStatus): number {
  if (status === "CANCELLED") return 0;
  return Math.max(0, totalCents - netPaidCents);
}

export class PaymentRuleError extends Error {}

/** Valida um novo lançamento antes de gravá-lo. */
export function assertPaymentAllowed(args: {
  orderStatus: OrderStatus;
  totalCents: number;
  netPaidCents: number;
  kind: PaymentKind;
  amountCents: number;
}) {
  const { orderStatus, totalCents, netPaidCents, kind, amountCents } = args;
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new PaymentRuleError("Informe um valor maior que zero.");
  }
  if (kind === "PAYMENT") {
    if (orderStatus === "CANCELLED") {
      throw new PaymentRuleError("Não é possível registrar pagamento em pedido cancelado.");
    }
    const due = totalCents - netPaidCents;
    if (due <= 0) throw new PaymentRuleError("Este pedido já está quitado.");
    if (amountCents > due) {
      throw new PaymentRuleError(
        `O valor excede o saldo em aberto (${(due / 100).toFixed(2).replace(".", ",")}). Registre apenas o valor do pedido; o troco não entra no caixa.`,
      );
    }
  } else {
    if (amountCents > netPaidCents) {
      throw new PaymentRuleError("O reembolso não pode ser maior que o valor já recebido.");
    }
  }
}

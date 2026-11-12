import type { DiscountType } from "@prisma/client";

export type CalcItem = { unitPriceCents: number; quantity: number };

export type OrderTotals = {
  subtotalCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  totalCents: number;
};

export class OrderCalcError extends Error {}

/**
 * Regra de desconto:
 * - AMOUNT: valor fixo em centavos.
 * - PERCENT: pontos-base (1000 = 10,00%), arredondado para o centavo mais próximo.
 * O desconto incide apenas sobre o subtotal dos produtos (nunca sobre a taxa de entrega)
 * e não pode ultrapassar o subtotal.
 */
export function computeDiscountCents(
  subtotalCents: number,
  type: DiscountType | null | undefined,
  value: number | null | undefined,
): number {
  const v = Math.max(0, Math.trunc(value ?? 0));
  if (!type || v === 0) return 0;
  if (type === "PERCENT") {
    if (v > 10000) throw new OrderCalcError("O desconto percentual não pode passar de 100%.");
    return Math.round((subtotalCents * v) / 10000);
  }
  if (v > subtotalCents) throw new OrderCalcError("O desconto não pode ser maior que o subtotal dos produtos.");
  return v;
}

export function computeOrderTotals(input: {
  items: CalcItem[];
  discountType?: DiscountType | null;
  discountValue?: number | null;
  deliveryFeeCents?: number | null;
}): OrderTotals {
  let subtotal = 0;
  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new OrderCalcError("Quantidade inválida.");
    }
    if (!Number.isInteger(item.unitPriceCents) || item.unitPriceCents < 0) {
      throw new OrderCalcError("Preço inválido.");
    }
    subtotal += item.unitPriceCents * item.quantity;
  }
  const deliveryFee = Math.max(0, Math.trunc(input.deliveryFeeCents ?? 0));
  const discount = computeDiscountCents(subtotal, input.discountType, input.discountValue);
  return {
    subtotalCents: subtotal,
    discountCents: discount,
    deliveryFeeCents: deliveryFee,
    totalCents: subtotal - discount + deliveryFee,
  };
}

import { describe, expect, it } from "vitest";
import { computeDiscountCents, computeOrderTotals, OrderCalcError } from "@/lib/domain/order-calc";

describe("cálculo de totais do pedido", () => {
  it("soma itens × quantidade", () => {
    const t = computeOrderTotals({
      items: [
        { unitPriceCents: 5400, quantity: 2 },
        { unitPriceCents: 8000, quantity: 1 },
      ],
    });
    expect(t).toEqual({ subtotalCents: 18800, discountCents: 0, deliveryFeeCents: 0, totalCents: 18800 });
  });

  it("aplica desconto em reais e taxa de entrega (desconto não incide sobre a taxa)", () => {
    const t = computeOrderTotals({
      items: [{ unitPriceCents: 4500, quantity: 2 }],
      discountType: "AMOUNT",
      discountValue: 1000,
      deliveryFeeCents: 800,
    });
    expect(t.subtotalCents).toBe(9000);
    expect(t.discountCents).toBe(1000);
    expect(t.totalCents).toBe(9000 - 1000 + 800);
  });

  it("aplica desconto percentual com arredondamento ao centavo", () => {
    // 10% de 4.500 = 450; 12,5% de 4.200 = 525; 33,33% de 10.000 = 3.333
    expect(computeDiscountCents(4500, "PERCENT", 1000)).toBe(450);
    expect(computeDiscountCents(4200, "PERCENT", 1250)).toBe(525);
    expect(computeDiscountCents(10000, "PERCENT", 3333)).toBe(3333);
    expect(computeDiscountCents(8500, "PERCENT", 10000)).toBe(8500);
  });

  it("bloqueia desconto maior que o subtotal ou acima de 100%", () => {
    expect(() => computeDiscountCents(4500, "AMOUNT", 4501)).toThrow(OrderCalcError);
    expect(() => computeDiscountCents(4500, "PERCENT", 10001)).toThrow(OrderCalcError);
  });

  it("desconto de 100% gera pedido de valor zero (+ taxa)", () => {
    const t = computeOrderTotals({ items: [{ unitPriceCents: 4500, quantity: 1 }], discountType: "PERCENT", discountValue: 10000, deliveryFeeCents: 500 });
    expect(t.totalCents).toBe(500);
  });

  it("ignora desconto sem tipo ou zerado", () => {
    expect(computeDiscountCents(4500, null, 1000)).toBe(0);
    expect(computeDiscountCents(4500, "AMOUNT", 0)).toBe(0);
  });

  it("rejeita quantidade inválida e preço negativo", () => {
    expect(() => computeOrderTotals({ items: [{ unitPriceCents: 4500, quantity: 0 }] })).toThrow(OrderCalcError);
    expect(() => computeOrderTotals({ items: [{ unitPriceCents: 4500, quantity: 1.5 }] })).toThrow(OrderCalcError);
    expect(() => computeOrderTotals({ items: [{ unitPriceCents: -1, quantity: 1 }] })).toThrow(OrderCalcError);
  });

  it("não sofre erro de ponto flutuante (centavos inteiros)", () => {
    const t = computeOrderTotals({ items: Array.from({ length: 10 }, () => ({ unitPriceCents: 10, quantity: 3 })) });
    expect(t.totalCents).toBe(300);
  });
});

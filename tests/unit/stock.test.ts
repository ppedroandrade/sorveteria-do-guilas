import { describe, expect, it } from "vitest";
import { requiredConsumption, stockDeltas, stockLevel } from "@/lib/domain/stock";

describe("regra de baixa de estoque", () => {
  const items = [
    { productId: "a", quantity: 2, stockConsumptionMilli: 500 },
    { productId: "a", quantity: 1, stockConsumptionMilli: 1000 },
    { productId: "b", quantity: 3, stockConsumptionMilli: null }, // sem controle
  ];

  it("calcula consumo devido somando itens do mesmo produto", () => {
    expect(Object.fromEntries(requiredConsumption(items, false))).toEqual({ a: 2000 });
  });

  it("primeira reconciliação baixa o devido", () => {
    expect(Object.fromEntries(stockDeltas(requiredConsumption(items, false), []))).toEqual({ a: -2000 });
  });

  it("reprocessar não baixa em dobro (idempotente)", () => {
    const applied = [{ productId: "a", quantityMilli: -2000 }];
    expect(stockDeltas(requiredConsumption(items, false), applied).size).toBe(0);
  });

  it("edição lança só a diferença", () => {
    const applied = [{ productId: "a", quantityMilli: -2000 }];
    const edited = [{ productId: "a", quantity: 1, stockConsumptionMilli: 500 }];
    expect(Object.fromEntries(stockDeltas(requiredConsumption(edited, false), applied))).toEqual({ a: 1500 });
  });

  it("cancelamento devolve tudo; cancelar de novo não devolve em dobro", () => {
    const applied = [{ productId: "a", quantityMilli: -2000 }];
    expect(Object.fromEntries(stockDeltas(requiredConsumption(items, true), applied))).toEqual({ a: 2000 });
    const afterCancel = [...applied, { productId: "a", quantityMilli: 2000 }];
    expect(stockDeltas(requiredConsumption(items, true), afterCancel).size).toBe(0);
  });

  it("troca de produto na edição estorna um e baixa o outro", () => {
    const applied = [{ productId: "a", quantityMilli: -1000 }];
    const edited = [{ productId: "c", quantity: 1, stockConsumptionMilli: 1000 }];
    expect(Object.fromEntries(stockDeltas(requiredConsumption(edited, false), applied))).toEqual({ a: 1000, c: -1000 });
  });

  it("nível de estoque", () => {
    expect(stockLevel({ trackStock: false, stockMilli: 0, minStockMilli: 0 })).toBe("untracked");
    expect(stockLevel({ trackStock: true, stockMilli: 0, minStockMilli: 1000 })).toBe("out");
    expect(stockLevel({ trackStock: true, stockMilli: 1000, minStockMilli: 1000 })).toBe("low");
    expect(stockLevel({ trackStock: true, stockMilli: 1001, minStockMilli: 1000 })).toBe("ok");
  });
});

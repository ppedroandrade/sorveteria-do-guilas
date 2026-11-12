import { describe, expect, it } from "vitest";
import { assertPaymentAllowed, balanceDueCents, derivePaymentStatus, PaymentRuleError, summarizePayments } from "@/lib/domain/payments";

const pay = (amountCents: number) => ({ kind: "PAYMENT" as const, amountCents });
const refund = (amountCents: number) => ({ kind: "REFUND" as const, amountCents });

describe("situação financeira", () => {
  it("pendente sem pagamentos", () => expect(derivePaymentStatus(10000, [])).toBe("PENDING"));
  it("parcial", () => expect(derivePaymentStatus(10000, [pay(3000)])).toBe("PARTIAL"));
  it("pedido de R$100 pago com R$50 PIX + R$50 dinheiro fica quitado", () => {
    expect(derivePaymentStatus(10000, [pay(5000), pay(5000)])).toBe("PAID");
  });
  it("reembolso total → reembolsado", () => expect(derivePaymentStatus(10000, [pay(10000), refund(10000)])).toBe("REFUNDED"));
  it("reembolso parcial → parcial", () => expect(derivePaymentStatus(10000, [pay(10000), refund(4000)])).toBe("PARTIAL"));
  it("pedido de valor zero é considerado pago", () => expect(derivePaymentStatus(0, [])).toBe("PAID"));
  it("resume líquido", () => expect(summarizePayments([pay(5000), pay(2000), refund(1000)]).netPaidCents).toBe(6000));
  it("saldo devedor ignora cancelados", () => {
    expect(balanceDueCents(10000, 3000, "PENDING")).toBe(7000);
    expect(balanceDueCents(10000, 3000, "CANCELLED")).toBe(0);
  });
});

describe("regras de lançamento", () => {
  const base = { orderStatus: "PENDING" as const, totalCents: 10000, netPaidCents: 5000 };
  it("aceita pagamento até o saldo", () => {
    expect(() => assertPaymentAllowed({ ...base, kind: "PAYMENT", amountCents: 5000 })).not.toThrow();
  });
  it("rejeita pagamento acima do saldo", () => {
    expect(() => assertPaymentAllowed({ ...base, kind: "PAYMENT", amountCents: 5001 })).toThrow(PaymentRuleError);
  });
  it("rejeita pagamento em pedido quitado ou cancelado", () => {
    expect(() => assertPaymentAllowed({ ...base, netPaidCents: 10000, kind: "PAYMENT", amountCents: 1 })).toThrow(/quitado/);
    expect(() => assertPaymentAllowed({ ...base, orderStatus: "CANCELLED", kind: "PAYMENT", amountCents: 1 })).toThrow(/cancelado/);
  });
  it("rejeita valor zero/negativo", () => {
    expect(() => assertPaymentAllowed({ ...base, kind: "PAYMENT", amountCents: 0 })).toThrow();
    expect(() => assertPaymentAllowed({ ...base, kind: "PAYMENT", amountCents: -10 })).toThrow();
  });
  it("reembolso limitado ao recebido (também em pedido cancelado)", () => {
    expect(() => assertPaymentAllowed({ ...base, orderStatus: "CANCELLED", kind: "REFUND", amountCents: 5000 })).not.toThrow();
    expect(() => assertPaymentAllowed({ ...base, kind: "REFUND", amountCents: 5001 })).toThrow(PaymentRuleError);
  });
});

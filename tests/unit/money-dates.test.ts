import { describe, expect, it } from "vitest";
import { formatMoney, parseMilli, parseMoneyToCents, formatMilli } from "@/lib/money";
import { dayRange, monthRange, parseDateTimeLocal, resolvePeriod, toDateTimeLocalValue } from "@/lib/dates";
import { toCsv } from "@/lib/csv";
import { buildWhatsAppMessage, whatsAppLink } from "@/lib/domain/whatsapp";

describe("dinheiro", () => {
  it("formata BRL", () => expect(formatMoney(10000)).toBe("R$ 100,00"));
  it("interpreta formatos brasileiros", () => {
    expect(parseMoneyToCents("45,90")).toBe(4590);
    expect(parseMoneyToCents("R$ 1.234,50")).toBe(123450);
    expect(parseMoneyToCents("45")).toBe(4500);
    expect(parseMoneyToCents("45.9")).toBe(4590);
    expect(parseMoneyToCents("abc")).toBeNull();
  });
  it("quantidades em milésimos", () => {
    expect(parseMilli("1,5")).toBe(1500);
    expect(parseMilli("0.25")).toBe(250);
    expect(formatMilli(1500)).toBe("1,5");
  });
});

describe("datas no fuso do negócio (America/Sao_Paulo)", () => {
  it("22:30 em SP ainda é o mesmo dia, embora já seja o dia seguinte em UTC", () => {
    const now = new Date("2026-11-13T01:30:00Z"); // 12/11 22:30 em SP
    const { start, end } = dayRange(now);
    expect(start.toISOString()).toBe("2026-11-12T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-13T03:00:00.000Z");
  });
  it("mês", () => {
    const { start, end } = monthRange(new Date("2026-11-30T23:00:00Z"));
    expect(start.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-01T03:00:00.000Z");
  });
  it("datetime-local ida e volta", () => {
    const d = parseDateTimeLocal("2026-11-20T15:30")!;
    expect(d.toISOString()).toBe("2026-11-20T18:30:00.000Z");
    expect(toDateTimeLocalValue(d)).toBe("2026-11-20T15:30");
  });
  it("período personalizado inverte datas trocadas e usa fim exclusivo", () => {
    const p = resolvePeriod({ period: "custom", from: "2026-11-10", to: "2026-11-01" });
    expect(p.from).toBe("2026-11-01");
    expect(p.to).toBe("2026-11-10");
    expect(p.days).toBe(10);
    expect(p.end.toISOString()).toBe("2026-11-11T03:00:00.000Z");
  });
  it("período inválido cai no padrão", () => {
    expect(resolvePeriod({ period: "xyz" }, undefined, new Date(), "7d").preset).toBe("7d");
    expect(resolvePeriod({ period: "custom", from: "lixo" }, undefined, new Date(), "30d").preset).toBe("30d");
  });
});

describe("CSV", () => {
  it("usa ; e BOM, escapa aspas e neutraliza fórmulas", () => {
    const csv = toCsv(["Nome", "Valor"], [["=HYPERLINK(\"x\")", "10,00"], ['Ana "Bia"', "5,00"]]);
    expect(csv.startsWith("﻿Nome;Valor")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(`"Ana ""Bia"""`);
  });
});

describe("WhatsApp", () => {
  const msg = buildWhatsAppMessage(
    {
      number: 7,
      customerName: "Maria Silva",
      items: [{ productName: "Pistache", variantName: "Tamanho 1", quantity: 2, totalCents: 10800 }],
      subtotalCents: 10800,
      discountCents: 0,
      deliveryFeeCents: 500,
      totalCents: 11300,
      paidCents: 5000,
      paymentStatus: "PARTIAL",
      fulfillment: "DELIVERY",
      deliveryAddress: "Rua A, 10",
      scheduledLabel: "sexta, 20/11 às 15:30",
      notes: null,
    },
    { businessName: "Gelateria" },
  );
  it("contém dados essenciais", () => {
    expect(msg).toContain("Olá, Maria!");
    expect(msg).toContain("*Pedido #0007*");
    expect(msg).toContain("2x Pistache (Tamanho 1)");
    expect(msg).toContain("*Total: R$ 113,00*");
    expect(msg).toContain("Falta: R$ 63,00");
    expect(msg).toContain("Entrega: sexta, 20/11 às 15:30");
  });
  it("link adiciona DDI 55", () => {
    expect(whatsAppLink("(11) 98765-4321", "oi")).toBe("https://wa.me/5511987654321?text=oi");
    expect(whatsAppLink(null, "oi")).toBe("https://wa.me/?text=oi");
  });
});

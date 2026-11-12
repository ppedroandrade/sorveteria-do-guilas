import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { cancelOrder, changeOrderStatus, createOrder, updateOrder } from "@/lib/services/orders";
import { addPayment, deletePayment } from "@/lib/services/payments";
import { registerManualMovement } from "@/lib/services/stock";
import { receivables, receivedSummary, salesSummary, productRanking } from "@/lib/services/analytics";
import { DomainError } from "@/lib/errors";
import { hasTestDb, orderInput, resetDb, seedCatalog } from "../helpers";

const TZ = "America/Sao_Paulo";
const d = hasTestDb ? describe : describe.skip;
const allTime = { start: new Date("2000-01-01"), end: new Date("2100-01-01") };

d("pedidos (integração com PostgreSQL)", () => {
  let cat: Awaited<ReturnType<typeof seedCatalog>>;
  beforeEach(async () => {
    await resetDb();
    cat = await seedCatalog();
  });
  afterAll(async () => prisma.$disconnect());

  it("cria pedido com múltiplos produtos, total correto e histórico", async () => {
    const { order } = await createOrder(
      orderInput([
        { variantId: cat.pistache.variants[0].id, quantity: 2 },
        { variantId: cat.milho.variants[1].id, quantity: 1 },
      ], { fulfillment: "DELIVERY", deliveryAddress: "Rua X", deliveryFeeCents: 700, discountType: "PERCENT", discountValue: 1000 }),
      TZ,
    );
    // 2×54 + 80 = 188; 10% = 18,80; +7 = 176,20
    expect(order.subtotalCents).toBe(18800);
    expect(order.discountCents).toBe(1880);
    expect(order.totalCents).toBe(17620);
    expect(order.status).toBe("PENDING");
    expect(order.paymentStatus).toBe("PENDING");
    const hist = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id } });
    expect(hist).toHaveLength(1);
  });

  it("retirada ignora taxa de entrega enviada", async () => {
    const { order } = await createOrder(orderInput([{ variantId: cat.milho.variants[0].id, quantity: 1 }], { deliveryFeeCents: 999 }), TZ);
    expect(order.deliveryFeeCents).toBe(0);
    expect(order.totalCents).toBe(4200);
  });

  it("preserva o preço histórico quando o catálogo muda", async () => {
    const v = cat.pistache.variants[0];
    const { order } = await createOrder(orderInput([{ variantId: v.id, quantity: 1 }]), TZ);
    await prisma.productVariant.update({ where: { id: v.id }, data: { priceCents: 9900 } });
    await prisma.product.update({ where: { id: cat.pistache.id }, data: { name: "Pistache Siciliano" } });
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(item.unitPriceCents).toBe(5400);
    expect(item.productName).toBe("Pistache");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).totalCents).toBe(5400);
  });

  it("edição mantém preço original dos itens existentes e usa preço atual nos novos", async () => {
    const v = cat.pistache.variants[0];
    const { order } = await createOrder(orderInput([{ variantId: v.id, quantity: 1 }]), TZ);
    await prisma.productVariant.update({ where: { id: v.id }, data: { priceCents: 6000 } });
    const existing = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    await updateOrder(order.id, orderInput([
      { id: existing.id, variantId: v.id, quantity: 2 }, // mantém 54,00
      { variantId: v.id, quantity: 1 }, // novo: 60,00
    ]), TZ);
    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.totalCents).toBe(2 * 5400 + 6000);
  });

  it("não permite vender produto indisponível ou desativado", async () => {
    await prisma.product.update({ where: { id: cat.milho.id }, data: { isAvailable: false } });
    await expect(createOrder(orderInput([{ variantId: cat.milho.variants[0].id, quantity: 1 }]), TZ)).rejects.toThrow(/indisponível/);
    await prisma.product.update({ where: { id: cat.doce.id }, data: { active: false } });
    await expect(createOrder(orderInput([{ variantId: cat.doce.variants[0].id, quantity: 1 }]), TZ)).rejects.toThrow(/desativado/);
    expect(await prisma.order.count()).toBe(0);
  });

  it("chave de idempotência evita pedido duplicado (inclusive em cliques simultâneos)", async () => {
    const input = orderInput([{ variantId: cat.milho.variants[0].id, quantity: 1 }], { idempotencyKey: "chave-123456" });
    const [a, b] = await Promise.all([createOrder(input, TZ), createOrder(input, TZ)]);
    expect(a.order.id).toBe(b.order.id);
    expect(await prisma.order.count()).toBe(1);
  });

  it("pagamentos parciais e múltiplas formas quitam o pedido", async () => {
    const { order } = await createOrder(orderInput([{ variantId: cat.pistache.variants[1].id, quantity: 1 }]), TZ); // R$ 100
    await addPayment({ orderId: order.id, kind: "PAYMENT", method: "PIX", amountCents: 5000 }, TZ);
    let o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.paymentStatus).toBe("PARTIAL");
    await addPayment({ orderId: order.id, kind: "PAYMENT", method: "CASH", amountCents: 5000 }, TZ);
    o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.paymentStatus).toBe("PAID");
    expect(o.paidCents).toBe(10000);
    await expect(addPayment({ orderId: order.id, kind: "PAYMENT", method: "CASH", amountCents: 1 }, TZ)).rejects.toThrow(/quitado/);
  });

  it("rejeita pagamento acima do saldo e evita lançamento duplicado", async () => {
    const { order } = await createOrder(orderInput([{ variantId: cat.milho.variants[0].id, quantity: 1 }]), TZ); // 42
    await expect(addPayment({ orderId: order.id, kind: "PAYMENT", method: "PIX", amountCents: 4300 }, TZ)).rejects.toThrow(/excede/);
    const p = { orderId: order.id, kind: "PAYMENT" as const, method: "PIX" as const, amountCents: 2000, idempotencyKey: "pag-abcdef12" };
    await addPayment(p, TZ);
    const again = await addPayment(p, TZ);
    expect(again.duplicated).toBe(true);
    expect(await prisma.payment.count()).toBe(1);
  });

  it("pagamento junto com a criação do pedido", async () => {
    const { order } = await createOrder(
      orderInput([{ variantId: cat.milho.variants[0].id, quantity: 1 }], { payNow: { method: "PIX", amountCents: 4200 } }),
      TZ,
    );
    expect(order.paymentStatus).toBe("PAID");
  });

  it("cancelamento exclui das vendas, mantém recebido e permite reembolso", async () => {
    const { order: a } = await createOrder(orderInput([{ variantId: cat.milho.variants[0].id, quantity: 1 }]), TZ); // 42
    const { order: b } = await createOrder(orderInput([{ variantId: cat.pistache.variants[0].id, quantity: 1 }]), TZ); // 54
    await addPayment({ orderId: b.id, kind: "PAYMENT", method: "PIX", amountCents: 5400 }, TZ);
    await cancelOrder(b.id, "Cliente desistiu");

    const sales = await salesSummary(allTime.start, allTime.end);
    expect(sales.soldCents).toBe(4200);
    expect(sales.orderCount).toBe(1);
    expect(sales.cancelledCount).toBe(1);
    expect((await receivables()).openCents).toBe(4200); // cancelado não entra no a receber
    expect((await receivedSummary(allTime.start, allTime.end)).netReceivedCents).toBe(5400);

    await expect(addPayment({ orderId: b.id, kind: "PAYMENT", method: "PIX", amountCents: 100 }, TZ)).rejects.toThrow(/cancelado/);
    await addPayment({ orderId: b.id, kind: "REFUND", method: "PIX", amountCents: 5400 }, TZ);
    const ob = await prisma.order.findUniqueOrThrow({ where: { id: b.id } });
    expect(ob.paymentStatus).toBe("REFUNDED");
    expect((await receivedSummary(allTime.start, allTime.end)).netReceivedCents).toBe(0);
    await expect(cancelOrder(b.id, null)).rejects.toThrow(/já está cancelado/);
    await expect(changeOrderStatus(b.id, "READY")).rejects.toThrow(DomainError);
    const ranking = await productRanking(allTime.start, allTime.end);
    expect(ranking.find((p) => p.name === "Pistache")).toBeUndefined();
    void a;
  });

  it("não permite editar pedido entregue", async () => {
    const { order } = await createOrder(orderInput([{ variantId: cat.milho.variants[0].id, quantity: 1 }]), TZ);
    await changeOrderStatus(order.id, "DELIVERED");
    await expect(updateOrder(order.id, orderInput([{ variantId: cat.milho.variants[0].id, quantity: 2 }]), TZ)).rejects.toThrow(/não podem ser editados/);
  });

  it("remover lançamento recalcula a situação", async () => {
    const { order } = await createOrder(orderInput([{ variantId: cat.milho.variants[0].id, quantity: 1 }]), TZ);
    const { payment } = await addPayment({ orderId: order.id, kind: "PAYMENT", method: "PIX", amountCents: 4200 }, TZ);
    await deletePayment(payment.id);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("PENDING");
  });
});

d("estoque (integração)", () => {
  let cat: Awaited<ReturnType<typeof seedCatalog>>;
  beforeEach(async () => {
    await resetDb();
    cat = await seedCatalog();
    // Pistache controlado em litros: Tamanho 1 consome 0,5 L; Tamanho 2 consome 1 L
    await prisma.product.update({ where: { id: cat.pistache.id }, data: { trackStock: true, stockUnit: "litro", minStockMilli: 1000 } });
    await prisma.productVariant.update({ where: { id: cat.pistache.variants[0].id }, data: { stockConsumptionMilli: 500 } });
    await prisma.productVariant.update({ where: { id: cat.pistache.variants[1].id }, data: { stockConsumptionMilli: 1000 } });
    await registerManualMovement({ productId: cat.pistache.id, type: "IN", quantityMilli: 5000, reason: "Produção" });
  });
  const stock = async () => (await prisma.product.findUniqueOrThrow({ where: { id: cat.pistache.id } })).stockMilli;

  it("baixa no pedido, não duplica em mudança de status/edição, devolve no cancelamento", async () => {
    const { order } = await createOrder(orderInput([
      { variantId: cat.pistache.variants[0].id, quantity: 2 }, // 1,0 L
      { variantId: cat.pistache.variants[1].id, quantity: 1 }, // 1,0 L
    ]), TZ);
    expect(await stock()).toBe(3000);

    await changeOrderStatus(order.id, "IN_PREPARATION");
    await changeOrderStatus(order.id, "READY");
    expect(await stock()).toBe(3000);

    const items = await prisma.orderItem.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
    await updateOrder(order.id, orderInput(items.map((i) => ({ id: i.id, variantId: i.variantId, quantity: i.quantity }))), TZ);
    expect(await stock()).toBe(3000); // mesma edição: nada muda

    await updateOrder(order.id, orderInput([{ id: items[1].id, variantId: items[1].variantId, quantity: 1 }]), TZ);
    expect(await stock()).toBe(4000); // removeu 1,0 L

    await cancelOrder(order.id, null);
    expect(await stock()).toBe(5000);
    const sum = await prisma.inventoryMovement.aggregate({ where: { orderId: order.id }, _sum: { quantityMilli: true } });
    expect(sum._sum.quantityMilli).toBe(0);
  });

  it("impede estoque negativo quando configurado", async () => {
    await expect(createOrder(orderInput([{ variantId: cat.pistache.variants[1].id, quantity: 6 }]), TZ)).rejects.toThrow(/Estoque insuficiente/);
    expect(await stock()).toBe(5000);
    expect(await prisma.order.count()).toBe(0); // transação desfeita por inteiro
  });

  it("permite negativo quando o produto autoriza", async () => {
    await prisma.product.update({ where: { id: cat.pistache.id }, data: { allowNegativeStock: true } });
    await createOrder(orderInput([{ variantId: cat.pistache.variants[1].id, quantity: 6 }]), TZ);
    expect(await stock()).toBe(-1000);
  });

  it("exige conversão configurada para vender produto com estoque", async () => {
    await prisma.productVariant.update({ where: { id: cat.pistache.variants[1].id }, data: { stockConsumptionMilli: null } });
    await expect(createOrder(orderInput([{ variantId: cat.pistache.variants[1].id, quantity: 1 }]), TZ)).rejects.toThrow(/Configure o consumo/);
  });

  it("ajuste de contagem lança a diferença; saída manual valida saldo", async () => {
    await registerManualMovement({ productId: cat.pistache.id, type: "ADJUSTMENT", quantityMilli: 4200, reason: "Contagem" });
    expect(await stock()).toBe(4200);
    await expect(registerManualMovement({ productId: cat.pistache.id, type: "OUT", quantityMilli: 5000, reason: null })).rejects.toThrow(/insuficiente/);
    const last = await prisma.inventoryMovement.findFirstOrThrow({ where: { type: "ADJUSTMENT" } });
    expect(last.quantityMilli).toBe(-800);
    expect(last.balanceAfterMilli).toBe(4200);
  });

  it("pedidos simultâneos não ultrapassam o estoque disponível", async () => {
    // 5 L disponíveis; 8 pedidos de 1 L concorrentes → no máximo 5 passam
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => createOrder(orderInput([{ variantId: cat.pistache.variants[1].id, quantity: 1 }]), TZ)),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(5);
    expect(await stock()).toBe(0);
  });
});

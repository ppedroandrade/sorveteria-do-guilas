import { Prisma, type PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TZ, dayRange, eachDayKey } from "@/lib/dates";
import { addDays } from "date-fns";

/**
 * Regras dos indicadores:
 * - "Vendido" (competência): soma do total de pedidos NÃO cancelados criados no período.
 * - "Recebido" (caixa): soma dos pagamentos − reembolsos com data de pagamento no período,
 *   independentemente da data do pedido.
 * - "A receber": saldo em aberto (total − líquido pago) de pedidos não cancelados.
 * - Receita por produto/tamanho: valor bruto dos itens (antes do desconto geral do pedido).
 */

const n = (v: unknown) => Number(v ?? 0);
const VALID = Prisma.sql`o."status" <> 'CANCELLED'`;

export async function salesSummary(start: Date, end: Date) {
  const [valid, cancelled] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { not: "CANCELLED" }, createdAt: { gte: start, lt: end } },
      _sum: { totalCents: true, discountCents: true, deliveryFeeCents: true, subtotalCents: true },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { status: "CANCELLED", createdAt: { gte: start, lt: end } },
      _sum: { totalCents: true },
      _count: { _all: true },
    }),
  ]);
  const soldCents = valid._sum.totalCents ?? 0;
  const orderCount = valid._count._all;
  return {
    soldCents,
    orderCount,
    averageTicketCents: orderCount ? Math.round(soldCents / orderCount) : 0,
    discountCents: valid._sum.discountCents ?? 0,
    deliveryFeeCents: valid._sum.deliveryFeeCents ?? 0,
    cancelledCount: cancelled._count._all,
    cancelledCents: cancelled._sum.totalCents ?? 0,
  };
}

export async function receivedSummary(start: Date, end: Date) {
  const rows = await prisma.payment.groupBy({
    by: ["method", "kind"],
    where: { paidAt: { gte: start, lt: end } },
    _sum: { amountCents: true },
    _count: { _all: true },
  });
  const byMethod = new Map<PaymentMethod, { receivedCents: number; refundedCents: number; count: number }>();
  let received = 0;
  let refunded = 0;
  for (const r of rows) {
    const cur = byMethod.get(r.method) ?? { receivedCents: 0, refundedCents: 0, count: 0 };
    const amt = r._sum.amountCents ?? 0;
    if (r.kind === "REFUND") {
      cur.refundedCents += amt;
      refunded += amt;
    } else {
      cur.receivedCents += amt;
      cur.count += r._count._all;
      received += amt;
    }
    byMethod.set(r.method, cur);
  }
  return {
    grossReceivedCents: received,
    refundedCents: refunded,
    netReceivedCents: received - refunded,
    byMethod: [...byMethod.entries()]
      .map(([method, v]) => ({ method, ...v, netCents: v.receivedCents - v.refundedCents }))
      .sort((a, b) => b.netCents - a.netCents),
  };
}

/** Saldo em aberto. Com período, considera apenas pedidos criados nele. */
export async function receivables(range?: { start: Date; end: Date }) {
  const rows = await prisma.order.findMany({
    where: {
      status: { not: "CANCELLED" },
      paymentStatus: { in: ["PENDING", "PARTIAL"] },
      ...(range ? { createdAt: { gte: range.start, lt: range.end } } : {}),
    },
    select: { totalCents: true, paidCents: true },
  });
  return {
    openCents: rows.reduce((s, o) => s + Math.max(0, o.totalCents - o.paidCents), 0),
    openCount: rows.length,
  };
}

export type Granularity = "day" | "week" | "month";

/** Série temporal de vendido × recebido, agrupada no fuso do negócio. */
export async function salesSeries(start: Date, end: Date, granularity: Granularity = "day", zone = DEFAULT_TZ) {
  const unit = Prisma.raw(`'${granularity}'`);
  const fmt = Prisma.raw(granularity === "month" ? `'YYYY-MM'` : `'YYYY-MM-DD'`);
  const [sold, received] = await Promise.all([
    prisma.$queryRaw<{ k: string; total: bigint; count: bigint }[]>`
      SELECT to_char(date_trunc(${unit}, (o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${zone}), ${fmt}) AS k,
             SUM(o."totalCents") AS total, COUNT(*) AS count
      FROM "Order" o
      WHERE ${VALID} AND o."createdAt" >= ${start} AND o."createdAt" < ${end}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ k: string; total: bigint }[]>`
      SELECT to_char(date_trunc(${unit}, (p."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE ${zone}), ${fmt}) AS k,
             SUM(CASE WHEN p."kind" = 'REFUND' THEN -p."amountCents" ELSE p."amountCents" END) AS total
      FROM "Payment" p
      WHERE p."paidAt" >= ${start} AND p."paidAt" < ${end}
      GROUP BY 1 ORDER BY 1`,
  ]);
  const soldMap = new Map(sold.map((r) => [r.k, { total: n(r.total), count: n(r.count) }]));
  const recMap = new Map(received.map((r) => [r.k, n(r.total)]));

  let keys: string[];
  if (granularity === "day") keys = eachDayKey(start, end, zone);
  else keys = [...new Set([...soldMap.keys(), ...recMap.keys()])].sort();

  return keys.map((k) => ({
    key: k,
    soldCents: soldMap.get(k)?.total ?? 0,
    orders: soldMap.get(k)?.count ?? 0,
    receivedCents: recMap.get(k) ?? 0,
  }));
}

export async function productRanking(start: Date, end: Date, opts: { includeZero?: boolean } = {}) {
  const rows = await prisma.$queryRaw<
    { productId: string; name: string; active: boolean; quantity: bigint | null; revenue: bigint | null; orders: bigint | null }[]
  >`
    SELECT p.id AS "productId", p.name, p.active,
           SUM(s.quantity) AS quantity, SUM(s.revenue) AS revenue, SUM(s.orders) AS orders
    FROM "Product" p
    ${opts.includeZero ? Prisma.sql`LEFT JOIN` : Prisma.sql`JOIN`} (
      SELECT oi."productId", SUM(oi.quantity) AS quantity, SUM(oi."totalCents") AS revenue,
             COUNT(DISTINCT oi."orderId") AS orders
      FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
      WHERE ${VALID} AND o."createdAt" >= ${start} AND o."createdAt" < ${end}
      GROUP BY oi."productId"
    ) s ON s."productId" = p.id
    ${opts.includeZero ? Prisma.sql`WHERE p.active = true OR s.quantity IS NOT NULL` : Prisma.empty}
    GROUP BY p.id, p.name, p.active
    ORDER BY quantity DESC NULLS LAST, revenue DESC NULLS LAST, p.name ASC`;
  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    active: r.active,
    quantity: n(r.quantity),
    revenueCents: n(r.revenue),
    orders: n(r.orders),
  }));
}

export async function revenueByPresentation(start: Date, end: Date) {
  const rows = await prisma.$queryRaw<{ name: string; quantity: bigint; revenue: bigint }[]>`
    SELECT COALESCE(pr.name, oi."variantName") AS name, SUM(oi.quantity) AS quantity, SUM(oi."totalCents") AS revenue
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    LEFT JOIN "ProductVariant" pv ON pv.id = oi."variantId"
    LEFT JOIN "Presentation" pr ON pr.id = pv."presentationId"
    WHERE ${VALID} AND o."createdAt" >= ${start} AND o."createdAt" < ${end}
    GROUP BY 1 ORDER BY revenue DESC`;
  return rows.map((r) => ({ name: r.name, quantity: n(r.quantity), revenueCents: n(r.revenue) }));
}

export async function customerRanking(start: Date, end: Date, limit = 20) {
  const rows = await prisma.$queryRaw<
    { id: string; name: string; phone: string | null; orders: bigint; total: bigint; last: Date; first: Date }[]
  >`
    SELECT c.id, c.name, c.phone, COUNT(o.id) AS orders, SUM(o."totalCents") AS total,
           MAX(o."createdAt") AS last, MIN(o."createdAt") AS first
    FROM "Order" o JOIN "Customer" c ON c.id = o."customerId"
    WHERE ${VALID} AND o."createdAt" >= ${start} AND o."createdAt" < ${end}
    GROUP BY c.id, c.name, c.phone
    ORDER BY total DESC, orders DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    orders: n(r.orders),
    totalCents: n(r.total),
    averageTicketCents: n(r.orders) ? Math.round(n(r.total) / n(r.orders)) : 0,
    lastOrderAt: r.last,
    firstOrderAt: r.first,
  }));
}

/** Clientes que já compraram, mas não compram há pelo menos `days` dias. */
export async function inactiveCustomers(days: number, limit = 30) {
  const cutoff = addDays(new Date(), -days);
  const rows = await prisma.$queryRaw<{ id: string; name: string; phone: string | null; orders: bigint; total: bigint; last: Date }[]>`
    SELECT c.id, c.name, c.phone, COUNT(o.id) AS orders, SUM(o."totalCents") AS total, MAX(o."createdAt") AS last
    FROM "Customer" c JOIN "Order" o ON o."customerId" = c.id
    WHERE c."deletedAt" IS NULL AND ${VALID}
    GROUP BY c.id, c.name, c.phone
    HAVING MAX(o."createdAt") < ${cutoff}
    ORDER BY last DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, orders: n(r.orders), totalCents: n(r.total), lastOrderAt: r.last }));
}

export async function operationalCounters(zone = DEFAULT_TZ) {
  const today = dayRange(new Date(), zone);
  const dayAfterTomorrow = addDays(today.start, 2);
  const [pending, inPrep, ready, awaitingPayment, upcoming, lowStock] = await Promise.all([
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: "IN_PREPARATION" } }),
    prisma.order.count({ where: { status: "READY" } }),
    prisma.order.count({ where: { status: { not: "CANCELLED" }, paymentStatus: { in: ["PENDING", "PARTIAL"] } } }),
    prisma.order.findMany({
      where: {
        status: { notIn: ["CANCELLED", "DELIVERED"] },
        scheduledFor: { gte: today.start, lt: dayAfterTomorrow },
      },
      orderBy: { scheduledFor: "asc" },
      take: 12,
      include: { customer: { select: { name: true } }, items: { select: { productName: true, variantName: true, quantity: true } } },
    }),
    lowStockProducts(),
  ]);
  return { pending, inPrep, ready, awaitingPayment, upcoming, lowStock, tomorrowStart: addDays(today.start, 1) };
}

export async function lowStockProducts() {
  const rows = await prisma.$queryRaw<
    { id: string; name: string; stockMilli: number; minStockMilli: number; stockUnit: string | null }[]
  >`SELECT id, name, "stockMilli", "minStockMilli", "stockUnit" FROM "Product"
    WHERE active = true AND "trackStock" = true AND "stockMilli" <= "minStockMilli"
    ORDER BY ("stockMilli" - "minStockMilli") ASC, name ASC`;
  return rows;
}

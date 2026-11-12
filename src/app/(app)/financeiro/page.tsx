import Link from "next/link";
import { Suspense } from "react";
import { CircleDollarSign, HandCoins, RotateCcw, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { productRanking, receivables, receivedSummary, salesSummary } from "@/lib/services/analytics";
import { PageHeader } from "@/components/shared/page-header";
import { PeriodFilter } from "@/components/shared/period-filter";
import { StatCard } from "@/components/shared/stat-card";
import { ExportButton } from "@/components/shared/export-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarList } from "@/components/charts/bar-list";
import { PaymentStatusBadge } from "@/components/shared/status-badges";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime, resolvePeriod } from "@/lib/dates";
import { PAYMENT_METHOD_LABEL } from "@/lib/domain/labels";
import { formatOrderNumber } from "@/lib/utils";

export const metadata = { title: "Financeiro" };

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  await requireUser();
  const [sp, settings] = await Promise.all([searchParams, getSettings()]);
  const tz = settings.timezone;
  const cur = settings.currency;
  const period = resolvePeriod(sp, tz, new Date(), "month");

  const [sales, received, openAll, openPeriod, products, openOrders, payments] = await Promise.all([
    salesSummary(period.start, period.end),
    receivedSummary(period.start, period.end),
    receivables(),
    receivables(period),
    productRanking(period.start, period.end),
    prisma.order.findMany({
      where: { status: { not: "CANCELLED" }, paymentStatus: { in: ["PENDING", "PARTIAL"] } },
      orderBy: { createdAt: "asc" },
      take: 25,
      include: { customer: { select: { name: true } } },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: period.start, lt: period.end } },
      orderBy: { paidAt: "desc" },
      take: 15,
      include: { order: { select: { id: true, number: true, customer: { select: { name: true } } } } },
    }),
  ]);
  const byRevenue = [...products].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 8);
  const q = { period: period.preset, from: period.from, to: period.to };

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Vendido = pedidos válidos (sem cancelados) criados no período. Recebido = pagamentos com data no período, menos reembolsos."
        actions={<ExportButton tipo="pedidos" query={q} label="Exportar pedidos" />}
      />
      <div className="mb-5">
        <Suspense>
          <PeriodFilter preset={period.preset} from={period.from} to={period.to} />
        </Suspense>
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total vendido" value={formatMoney(sales.soldCents, cur)} hint={`${sales.orderCount} pedido(s) · ticket ${formatMoney(sales.averageTicketCents, cur)}`} icon={<TrendingUp />} tone="primary" />
        <StatCard
          label="Total recebido"
          value={formatMoney(received.netReceivedCents, cur)}
          hint={received.refundedCents ? `Bruto ${formatMoney(received.grossReceivedCents, cur)} · reembolsos ${formatMoney(received.refundedCents, cur)}` : "Líquido de reembolsos"}
          icon={<CircleDollarSign />}
          tone="caramel"
        />
        <StatCard
          label="A receber"
          value={formatMoney(openAll.openCents, cur)}
          hint={`${openAll.openCount} pedido(s) em aberto · ${formatMoney(openPeriod.openCents, cur)} deste período`}
          icon={<HandCoins />}
          tone={openAll.openCents ? "alert" : "default"}
        />
        <StatCard
          label="Cancelados"
          value={sales.cancelledCount}
          hint={`${formatMoney(sales.cancelledCents, cur)} fora das vendas`}
          icon={<RotateCcw />}
        />
      </section>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Recebimentos por forma de pagamento</CardTitle>
              <CardDescription>{period.label}</CardDescription>
            </div>
            <ExportButton tipo="pagamentos" query={q} label="CSV" />
          </CardHeader>
          <CardContent>
            <BarList
              items={received.byMethod.map((m) => ({
                key: m.method,
                label: PAYMENT_METHOD_LABEL[m.method],
                value: Math.max(0, m.netCents),
                display: formatMoney(m.netCents, cur),
                sub: `${m.count}×`,
              }))}
              emptyLabel="Nenhum pagamento no período."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Produtos com maior faturamento</CardTitle>
            <CardDescription>Receita bruta dos itens (antes do desconto geral do pedido)</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              items={byRevenue.map((p) => ({ key: p.productId, label: p.name, value: p.revenueCents, display: formatMoney(p.revenueCents, cur), sub: `${p.quantity} un.` }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pedidos com saldo em aberto</CardTitle>
            <CardDescription>
              Mais antigos primeiro ·{" "}
              <Link href="/pedidos?view=list&pagamento=open" className="underline">
                ver todos
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {openOrders.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-muted-foreground">Tudo recebido. 🎉</p>
            ) : (
              <ul className="divide-y border-t">
                {openOrders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/pedidos/${o.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/50">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          {formatOrderNumber(o.number)} · {o.customer?.name ?? "Cliente avulso"}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(o.createdAt, "dd/MM/yyyy", tz)}</p>
                      </div>
                      <PaymentStatusBadge status={o.paymentStatus} />
                      <span className="w-24 text-right text-sm font-semibold tabular text-destructive">
                        {formatMoney(o.totalCents - o.paidCents, cur)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Últimos lançamentos</CardTitle>
            <CardDescription>{period.label}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {payments.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-muted-foreground">Nenhum lançamento no período.</p>
            ) : (
              <ul className="divide-y border-t">
                {payments.map((p) => (
                  <li key={p.id}>
                    <Link href={`/pedidos/${p.order.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/50">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {p.kind === "REFUND" ? "Reembolso · " : ""}
                          {PAYMENT_METHOD_LABEL[p.method]} · {formatOrderNumber(p.order.number)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDateTime(p.paidAt, tz)} · {p.order.customer?.name ?? "Cliente avulso"}
                        </p>
                      </div>
                      <span className={`text-sm font-semibold tabular ${p.kind === "REFUND" ? "text-destructive" : ""}`}>
                        {p.kind === "REFUND" ? "−" : ""}
                        {formatMoney(p.amountCents, cur)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

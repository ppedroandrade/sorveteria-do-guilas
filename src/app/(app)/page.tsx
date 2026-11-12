import Link from "next/link";
import { Suspense } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  Clock,
  HandCoins,
  Plus,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Truck,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { prisma } from "@/lib/prisma";
import {
  customerRanking,
  operationalCounters,
  productRanking,
  receivables,
  receivedSummary,
  salesSeries,
  salesSummary,
} from "@/lib/services/analytics";
import { dayRange, formatDate, formatRelativeSchedule, monthRange, resolvePeriod } from "@/lib/dates";
import { formatMilli, formatMoney } from "@/lib/money";
import { formatOrderNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { PeriodFilter } from "@/components/shared/period-filter";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badges";
import { SalesChart } from "@/components/charts/sales-chart";
import { BarList } from "@/components/charts/bar-list";

export const metadata = { title: "Dashboard" };

function greeting(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const user = await requireUser();
  const [sp, settings] = await Promise.all([searchParams, getSettings()]);
  const tz = settings.timezone;
  const cur = settings.currency;
  const now = new Date();
  const period = resolvePeriod(sp, tz, now, "7d");
  const today = dayRange(now, tz);
  const month = monthRange(now, tz);

  const [todaySales, todayReceived, monthSales, periodSales, periodReceived, open, ops, series, products, customers, recent] =
    await Promise.all([
      salesSummary(today.start, today.end),
      receivedSummary(today.start, today.end),
      salesSummary(month.start, month.end),
      salesSummary(period.start, period.end),
      receivedSummary(period.start, period.end),
      receivables(),
      operationalCounters(tz),
      salesSeries(period.start, period.end, "day", tz),
      productRanking(period.start, period.end),
      customerRanking(period.start, period.end, 5),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { customer: { select: { name: true } } },
      }),
    ]);

  const chartData = series.map((p) => ({
    ...p,
    label: formatDate(new Date(`${p.key}T12:00:00Z`), period.days > 14 ? "dd/MM" : "EEE dd", "UTC"),
  }));
  const hour = Number(formatDate(now, "H", tz));

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground first-letter:uppercase">{formatDate(now, "EEEE, d 'de' MMMM", tz)}</p>
          <h1 className="font-display text-3xl font-semibold">
            {greeting(hour)}, {user.name.split(" ")[0]}
          </h1>
        </div>
        <Button asChild variant="caramel" size="lg" className="shadow-lift">
          <Link href="/pedidos/novo">
            <Plus /> Novo pedido
          </Link>
        </Button>
      </div>

      {/* Hoje e mês */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Indicadores principais">
        <StatCard
          label="Faturamento hoje"
          value={formatMoney(todaySales.soldCents, cur)}
          hint={`Recebido hoje: ${formatMoney(todayReceived.netReceivedCents, cur)}`}
          icon={<TrendingUp />}
          tone="primary"
        />
        <StatCard
          label="Faturamento do mês"
          value={formatMoney(monthSales.soldCents, cur)}
          hint={`${monthSales.orderCount} pedido(s) válidos`}
          icon={<CircleDollarSign />}
          tone="caramel"
        />
        <StatCard
          label="Pedidos hoje"
          value={todaySales.orderCount}
          hint={todaySales.cancelledCount ? `${todaySales.cancelledCount} cancelado(s) não contam` : "Sem cancelamentos"}
          icon={<ShoppingBag />}
          href="/pedidos?view=list&period=today"
        />
        <StatCard
          label="Ticket médio"
          value={formatMoney(periodSales.averageTicketCents, cur)}
          hint={period.label}
          icon={<Receipt />}
        />
      </section>

      {/* Operação */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Operação">
        <StatCard
          label="Pedidos pendentes"
          value={ops.pending}
          hint={`${ops.inPrep} em preparo · ${ops.ready} pronto(s)`}
          icon={<Clock />}
          tone={ops.pending ? "caramel" : "default"}
          href="/pedidos"
        />
        <StatCard
          label="Aguardando pagamento"
          value={ops.awaitingPayment}
          hint={`${formatMoney(open.openCents, cur)} a receber`}
          icon={<HandCoins />}
          tone={ops.awaitingPayment ? "alert" : "default"}
          href="/pedidos?view=list&pagamento=open"
        />
        <StatCard
          label="Vendido no período"
          value={formatMoney(periodSales.soldCents, cur)}
          hint={`${periodSales.orderCount} pedido(s) · ${period.label}`}
          icon={<TrendingUp />}
        />
        <StatCard
          label="Recebido no período"
          value={formatMoney(periodReceived.netReceivedCents, cur)}
          hint={periodReceived.refundedCents ? `Reembolsos: ${formatMoney(periodReceived.refundedCents, cur)}` : period.label}
          icon={<CircleDollarSign />}
          href="/financeiro"
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Vendas</CardTitle>
              <CardDescription>Vendido (pedidos válidos) × recebido (pagamentos) — {period.label.toLowerCase()}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Suspense>
              <PeriodFilter preset={period.preset} from={period.from} to={period.to} />
            </Suspense>
            <SalesChart data={chartData} currency={cur} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-caramel" /> Encomendas hoje e amanhã
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ops.upcoming.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma encomenda agendada.</p>
            ) : (
              <ul className="space-y-2">
                {ops.upcoming.map((o) => {
                  const isTomorrow = o.scheduledFor! >= ops.tomorrowStart;
                  const late = o.scheduledFor! < now;
                  return (
                    <li key={o.id}>
                      <Link
                        href={`/pedidos/${o.id}`}
                        className="flex items-start gap-3 rounded-xl border bg-background/40 p-3 transition hover:bg-accent"
                      >
                        <div
                          className={`rounded-lg px-2 py-1 text-center text-xs font-bold tabular ${
                            late ? "bg-destructive-soft text-destructive" : isTomorrow ? "bg-muted text-foreground/70" : "bg-caramel-soft text-caramel-foreground"
                          }`}
                        >
                          {formatDate(o.scheduledFor, "HH:mm", tz)}
                          <span className="block text-[10px] font-semibold uppercase">{isTomorrow ? "amanhã" : late ? "atrasado" : "hoje"}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {formatOrderNumber(o.number)} · {o.customer?.name ?? "Cliente avulso"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {o.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <OrderStatusBadge status={o.status} />
                            {o.fulfillment === "DELIVERY" && <Truck className="h-3.5 w-3.5 text-caramel" aria-label="Entrega" />}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Sabores mais vendidos</CardTitle>
            <CardDescription>Unidades vendidas · {period.label.toLowerCase()}</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              items={products.slice(0, 6).map((p) => ({
                key: p.productId,
                label: p.name,
                value: p.quantity,
                display: `${p.quantity} un.`,
                sub: formatMoney(p.revenueCents, cur),
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clientes que mais compram</CardTitle>
            <CardDescription>Por valor · {period.label.toLowerCase()}</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              items={customers.map((c) => ({
                key: c.id,
                label: (
                  <Link href={`/clientes/${c.id}`} className="hover:underline">
                    {c.name}
                  </Link>
                ),
                value: c.totalCents,
                display: formatMoney(c.totalCents, cur),
                sub: `${c.orders}×`,
              }))}
              emptyLabel="Nenhuma compra de cliente cadastrado no período."
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-caramel" /> Estoque baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ops.lowStock.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum alerta de estoque.</p>
            ) : (
              <ul className="space-y-2">
                {ops.lowStock.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{p.name}</span>
                    <span className={`shrink-0 font-semibold tabular ${p.stockMilli <= 0 ? "text-destructive" : "text-caramel-foreground"}`}>
                      {formatMilli(p.stockMilli)} {p.stockUnit} <span className="font-normal text-muted-foreground">/ mín. {formatMilli(p.minStockMilli)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="link" size="sm" className="mt-2 px-0">
              <Link href="/estoque">
                Ver estoque <ArrowUpRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Pedidos recentes</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/pedidos?view=list">
              Ver todos <ArrowUpRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <p className="px-5 pb-6 text-center text-sm text-muted-foreground">Nenhum pedido ainda. Que tal registrar o primeiro?</p>
          ) : (
            <ul className="divide-y border-t">
              {recent.map((o) => (
                <li key={o.id}>
                  <Link href={`/pedidos/${o.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 transition hover:bg-accent/50">
                    <span className="w-14 font-bold">{formatOrderNumber(o.number)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{o.customer?.name ?? "Cliente avulso"}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {o.scheduledFor ? formatRelativeSchedule(o.scheduledFor, now, tz) : formatDate(o.createdAt, "dd/MM HH:mm", tz)}
                    </span>
                    <OrderStatusBadge status={o.status} />
                    <PaymentStatusBadge status={o.paymentStatus} />
                    <span className="w-24 text-right font-semibold tabular">{formatMoney(o.totalCents, cur)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

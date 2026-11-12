import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import {
  customerRanking,
  inactiveCustomers,
  productRanking,
  revenueByPresentation,
  salesSeries,
  salesSummary,
  type Granularity,
} from "@/lib/services/analytics";
import { PageHeader } from "@/components/shared/page-header";
import { PeriodFilter } from "@/components/shared/period-filter";
import { ExportButton } from "@/components/shared/export-button";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { SalesChart } from "@/components/charts/sales-chart";
import { BarList } from "@/components/charts/bar-list";
import { formatMoney } from "@/lib/money";
import { formatDate, resolvePeriod } from "@/lib/dates";
import { cn, formatPhone } from "@/lib/utils";
import { differenceInCalendarDays } from "date-fns";

export const metadata = { title: "Relatórios" };

type SP = { tab?: string; period?: string; from?: string; to?: string; agrupar?: string; dias?: string };
const TABS = [
  { k: "vendas", label: "Vendas" },
  { k: "produtos", label: "Produtos" },
  { k: "clientes", label: "Clientes" },
] as const;

function seriesLabel(key: string, g: Granularity) {
  if (g === "month") {
    const [y, m] = key.split("-");
    return formatDate(new Date(Date.UTC(Number(y), Number(m) - 1, 15)), "MMM/yy", "UTC");
  }
  const d = new Date(`${key}T12:00:00Z`);
  return g === "week" ? `Sem. ${formatDate(d, "dd/MM", "UTC")}` : formatDate(d, "dd/MM", "UTC");
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const [sp, settings] = await Promise.all([searchParams, getSettings()]);
  const tab = TABS.some((t) => t.k === sp.tab) ? sp.tab! : "vendas";
  const tz = settings.timezone;
  const period = resolvePeriod(sp, tz, new Date(), "30d");
  const q = { period: period.preset, from: period.from, to: period.to };
  const tabHref = (k: string) => {
    const s = new URLSearchParams({ tab: k, period: period.preset });
    if (period.preset === "custom") {
      s.set("from", period.from);
      s.set("to", period.to);
    }
    return `/relatorios?${s.toString()}`;
  };

  return (
    <>
      <PageHeader title="Relatórios" description={`Período: ${period.label}. Pedidos cancelados nunca entram nas vendas.`} />
      <div className="mb-5 flex flex-col gap-3">
        <nav className="inline-flex w-fit rounded-xl bg-muted p-1" aria-label="Tipo de relatório">
          {TABS.map((t) => (
            <Link
              key={t.k}
              href={tabHref(t.k)}
              aria-current={tab === t.k ? "page" : undefined}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-medium text-muted-foreground",
                tab === t.k && "bg-card text-foreground shadow-sm",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <Suspense>
          <PeriodFilter preset={period.preset} from={period.from} to={period.to} />
        </Suspense>
      </div>
      {tab === "vendas" && <SalesReport sp={sp} period={period} q={q} tz={tz} cur={settings.currency} />}
      {tab === "produtos" && <ProductsReport period={period} q={q} cur={settings.currency} />}
      {tab === "clientes" && <CustomersReport sp={sp} period={period} q={q} tz={tz} cur={settings.currency} />}
    </>
  );
}

type Period = ReturnType<typeof resolvePeriod>;

async function SalesReport({ sp, period, q, tz, cur }: { sp: SP; period: Period; q: Record<string, string>; tz: string; cur: string }) {
  const g: Granularity = sp.agrupar === "week" || sp.agrupar === "month" ? sp.agrupar : "day";
  const [summary, series] = await Promise.all([salesSummary(period.start, period.end), salesSeries(period.start, period.end, g, tz)]);
  const data = series.map((s) => ({ ...s, label: seriesLabel(s.key, g) }));
  const groupHref = (v: string) => {
    const s = new URLSearchParams({ tab: "vendas", ...q, agrupar: v });
    return `/relatorios?${s.toString()}`;
  };
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Vendido" value={formatMoney(summary.soldCents, cur)} tone="primary" />
        <StatCard label="Pedidos" value={summary.orderCount} />
        <StatCard label="Ticket médio" value={formatMoney(summary.averageTicketCents, cur)} />
        <StatCard label="Descontos concedidos" value={formatMoney(summary.discountCents, cur)} hint={`Taxas de entrega: ${formatMoney(summary.deliveryFeeCents, cur)}`} />
      </section>
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Vendas por {g === "day" ? "dia" : g === "week" ? "semana" : "mês"}</CardTitle>
            <CardDescription>Vendido × recebido</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-muted p-0.5 text-sm">
              {(
                [
                  ["day", "Dia"],
                  ["week", "Semana"],
                  ["month", "Mês"],
                ] as const
              ).map(([v, l]) => (
                <Link key={v} href={groupHref(v)} className={cn("rounded-md px-3 py-1 text-muted-foreground", g === v && "bg-card text-foreground shadow-sm")}>
                  {l}
                </Link>
              ))}
            </div>
            <ExportButton tipo="vendas" query={{ ...q, agrupar: g }} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <SalesChart data={data} currency={cur} />
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Período</TH>
                <TH className="text-right">Pedidos</TH>
                <TH className="text-right">Vendido</TH>
                <TH className="text-right">Recebido</TH>
              </TR>
            </THead>
            <TBody>
              {data.filter((d) => d.orders || d.receivedCents).length === 0 ? (
                <TR>
                  <TD colSpan={4} className="py-6 text-center text-muted-foreground">
                    Sem movimento no período.
                  </TD>
                </TR>
              ) : (
                [...data].reverse().filter((d) => d.orders || d.receivedCents).map((d) => (
                  <TR key={d.key}>
                    <TD>{d.label}</TD>
                    <TD className="text-right tabular">{d.orders}</TD>
                    <TD className="text-right font-semibold tabular">{formatMoney(d.soldCents, cur)}</TD>
                    <TD className="text-right tabular">{formatMoney(d.receivedCents, cur)}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

async function ProductsReport({ period, q, cur }: { period: Period; q: Record<string, string>; cur: string }) {
  const [all, sizes] = await Promise.all([productRanking(period.start, period.end, { includeZero: true }), revenueByPresentation(period.start, period.end)]);
  const sold = all.filter((p) => p.quantity > 0);
  const least = [...all].filter((p) => p.active).sort((a, b) => a.quantity - b.quantity || a.revenueCents - b.revenueCents).slice(0, 5);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Mais vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={sold.slice(0, 5).map((p) => ({ key: p.productId, label: p.name, value: p.quantity, display: `${p.quantity} un.` }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Menos vendidos</CardTitle>
            <CardDescription>Sabores ativos, incluindo os sem venda</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {least.map((p) => (
                <li key={p.productId} className="flex justify-between gap-2">
                  <span className="truncate">{p.name}</span>
                  <span className={cn("font-semibold tabular", p.quantity === 0 && "text-destructive")}>{p.quantity} un.</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Receita por tamanho</CardTitle>
              <CardDescription>Receita bruta dos itens</CardDescription>
            </div>
            <ExportButton tipo="tamanhos" query={q} label="CSV" />
          </CardHeader>
          <CardContent>
            <BarList items={sizes.map((s) => ({ key: s.name, label: s.name, value: s.revenueCents, display: formatMoney(s.revenueCents, cur), sub: `${s.quantity} un.` }))} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Todos os sabores</CardTitle>
          <ExportButton tipo="produtos" query={q} />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Sabor</TH>
                <TH className="text-right">Quantidade</TH>
                <TH className="hidden text-right sm:table-cell">Pedidos</TH>
                <TH className="text-right">Receita</TH>
              </TR>
            </THead>
            <TBody>
              {all.map((p) => (
                <TR key={p.productId}>
                  <TD>
                    {p.name}
                    {!p.active && <span className="ml-1 text-xs text-muted-foreground">(desativado)</span>}
                  </TD>
                  <TD className="text-right tabular">{p.quantity}</TD>
                  <TD className="hidden text-right tabular sm:table-cell">{p.orders}</TD>
                  <TD className="text-right font-semibold tabular">{formatMoney(p.revenueCents, cur)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

async function CustomersReport({ sp, period, q, tz, cur }: { sp: SP; period: Period; q: Record<string, string>; tz: string; cur: string }) {
  const days = [30, 60, 90].includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  const [ranking, inactive] = await Promise.all([customerRanking(period.start, period.end, 50), inactiveCustomers(days)]);
  const now = new Date();
  const byFrequency = [...ranking].sort((a, b) => b.orders - a.orders).slice(0, 5);
  const daysHref = (d: number) => `/relatorios?${new URLSearchParams({ tab: "clientes", ...q, dias: String(d) }).toString()}`;
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Maior gasto</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={ranking.slice(0, 5).map((c) => ({ key: c.id, label: c.name, value: c.totalCents, display: formatMoney(c.totalCents, cur) }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mais compras (frequência)</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              items={byFrequency.map((c) => {
                const span = differenceInCalendarDays(c.lastOrderAt, c.firstOrderAt);
                const every = c.orders > 1 ? Math.max(1, Math.round(span / (c.orders - 1))) : null;
                return { key: c.id, label: c.name, value: c.orders, display: `${c.orders} pedido(s)`, sub: every ? `a cada ~${every}d` : undefined };
              })}
            />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Ranking de clientes</CardTitle>
          <ExportButton tipo="clientes" query={q} />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Cliente</TH>
                <TH className="text-right">Pedidos</TH>
                <TH className="text-right">Total</TH>
                <TH className="hidden text-right sm:table-cell">Ticket médio</TH>
                <TH className="hidden md:table-cell">Última compra</TH>
              </TR>
            </THead>
            <TBody>
              {ranking.length === 0 ? (
                <TR>
                  <TD colSpan={5} className="py-6 text-center text-muted-foreground">
                    Nenhuma compra de cliente cadastrado no período.
                  </TD>
                </TR>
              ) : (
                ranking.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    </TD>
                    <TD className="text-right tabular">{c.orders}</TD>
                    <TD className="text-right font-semibold tabular">{formatMoney(c.totalCents, cur)}</TD>
                    <TD className="hidden text-right tabular sm:table-cell">{formatMoney(c.averageTicketCents, cur)}</TD>
                    <TD className="hidden text-muted-foreground md:table-cell">{formatDate(c.lastOrderAt, "dd/MM/yyyy", tz)}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Clientes sem compras recentes</CardTitle>
            <CardDescription>Já compraram, mas não voltam há {days}+ dias — boa lista para um contato pelo WhatsApp.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg bg-muted p-0.5 text-sm">
              {[30, 60, 90].map((d) => (
                <Link key={d} href={daysHref(d)} className={cn("rounded-md px-3 py-1 text-muted-foreground", days === d && "bg-card text-foreground shadow-sm")}>
                  {d}d
                </Link>
              ))}
            </div>
            <ExportButton tipo="inativos" query={{ dias: String(days) }} label="CSV" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {inactive.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-muted-foreground">Nenhum cliente inativo. 👏</p>
          ) : (
            <ul className="divide-y border-t">
              {inactive.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <Link href={`/clientes/${c.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                    {c.name}
                  </Link>
                  <span className="hidden text-muted-foreground sm:inline">{formatPhone(c.phone)}</span>
                  <span className="text-muted-foreground">há {differenceInCalendarDays(now, c.lastOrderAt)} dias</span>
                  <span className="w-24 text-right font-semibold tabular">{formatMoney(c.totalCents, cur)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

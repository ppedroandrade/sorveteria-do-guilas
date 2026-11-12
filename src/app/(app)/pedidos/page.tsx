import Link from "next/link";
import { Suspense } from "react";
import type { Prisma } from "@prisma/client";
import { ClipboardList, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badges";
import { PeriodFilter } from "@/components/shared/period-filter";
import { Pagination, parsePage } from "@/components/shared/pagination";
import { OrdersToolbar } from "@/components/orders/orders-toolbar";
import { QuickStatus } from "@/components/orders/quick-status";
import { KanbanBoard, type KanbanOrder } from "@/components/orders/kanban-board";
import { formatMoney } from "@/lib/money";
import { formatDateTime, formatRelativeSchedule, resolvePeriod } from "@/lib/dates";
import { formatOrderNumber, onlyDigits } from "@/lib/utils";
import { ORDER_STATUS_VALUES } from "@/lib/validation";

export const metadata = { title: "Pedidos" };

const PAGE_SIZE = 20;

type SP = {
  view?: string;
  q?: string;
  status?: string;
  pagamento?: string;
  cliente?: string;
  period?: string;
  from?: string;
  to?: string;
  page?: string;
};

function searchWhere(q: string | undefined): Prisma.OrderWhereInput {
  const term = (q ?? "").trim();
  if (!term) return {};
  const asNumber = /^#?\d+$/.test(term) ? Number(onlyDigits(term)) : null;
  return {
    OR: [
      ...(asNumber !== null && asNumber < 2_000_000_000 ? [{ number: asNumber }] : []),
      { customer: { name: { contains: term, mode: "insensitive" as const } } },
      ...(onlyDigits(term).length >= 4 ? [{ customer: { phoneDigits: { contains: onlyDigits(term) } } }] : []),
    ],
  };
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const [sp, settings] = await Promise.all([searchParams, getSettings()]);
  const view = sp.view === "list" ? "list" : "kanban";
  const tz = settings.timezone;
  const cur = settings.currency;

  return (
    <>
      <PageHeader
        title="Pedidos"
        description={view === "kanban" ? "Arraste os cartões ou use os botões para avançar o status." : "Filtre, busque e acompanhe todos os pedidos."}
        actions={
          <Button asChild variant="caramel">
            <Link href="/pedidos/novo">
              <Plus /> Novo pedido
            </Link>
          </Button>
        }
      />
      <div className="mb-5 space-y-3">
        <Suspense>
          <OrdersToolbar view={view} />
        </Suspense>
      </div>
      {view === "kanban" ? <KanbanView sp={sp} tz={tz} cur={cur} /> : <ListView sp={sp} tz={tz} cur={cur} />}
    </>
  );
}

async function KanbanView({ sp, tz, cur }: { sp: SP; tz: string; cur: string }) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: {
      AND: [
        searchWhere(sp.q),
        {
          OR: [
            { status: { in: ["PENDING", "IN_PREPARATION", "READY"] } },
            { status: "DELIVERED", completedAt: { gte: since } },
          ],
        },
      ],
    },
    orderBy: [{ scheduledFor: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 300,
    include: { customer: { select: { name: true } }, items: { select: { productName: true, variantName: true, quantity: true } } },
  });
  const now = new Date();
  const data: KanbanOrder[] = orders.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    paymentStatus: o.paymentStatus,
    customerName: o.customer?.name ?? null,
    totalCents: o.totalCents,
    isDelivery: o.fulfillment === "DELIVERY",
    scheduledLabel: o.scheduledFor ? formatRelativeSchedule(o.scheduledFor, now, tz) : null,
    overdue: !!o.scheduledFor && o.scheduledFor < now && o.status !== "DELIVERED",
    itemsSummary: o.items.map((i) => `${i.quantity}x ${i.productName} (${i.variantName})`).join(", "),
  }));
  return (
    <>
      <KanbanBoard orders={data} currency={cur} />
      <p className="mt-2 text-xs text-muted-foreground">
        &quot;Finalizado&quot; mostra os pedidos entregues nas últimas 24 h. Pedidos cancelados ficam na visualização em lista.
      </p>
    </>
  );
}

async function ListView({ sp, tz, cur }: { sp: SP; tz: string; cur: string }) {
  const page = parsePage(sp.page);
  const hasPeriod = !!sp.period;
  const period = resolvePeriod(sp, tz, new Date(), "30d");

  const where: Prisma.OrderWhereInput = { AND: [searchWhere(sp.q)] };
  const and = where.AND as Prisma.OrderWhereInput[];
  if (sp.status === "open") and.push({ status: { in: ["PENDING", "IN_PREPARATION", "READY"] } });
  else if (sp.status && (ORDER_STATUS_VALUES as readonly string[]).includes(sp.status))
    and.push({ status: sp.status as (typeof ORDER_STATUS_VALUES)[number] });
  if (sp.pagamento === "open") and.push({ status: { not: "CANCELLED" }, paymentStatus: { in: ["PENDING", "PARTIAL"] } });
  else if (sp.pagamento && ["PENDING", "PARTIAL", "PAID", "REFUNDED"].includes(sp.pagamento))
    and.push({ paymentStatus: sp.pagamento as "PENDING" });
  if (sp.cliente) and.push({ customerId: sp.cliente });
  if (hasPeriod) and.push({ createdAt: { gte: period.start, lt: period.end } });

  const [orders, total, customer] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { customer: { select: { name: true } }, items: { select: { productName: true, quantity: true } } },
    }),
    prisma.order.count({ where }),
    sp.cliente ? prisma.customer.findUnique({ where: { id: sp.cliente }, select: { name: true } }) : null,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodFilter preset={hasPeriod ? period.preset : ""} from={period.from} to={period.to} />
        {hasPeriod && (
          <Link href={`/pedidos?view=list`} className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline">
            Limpar período
          </Link>
        )}
        {customer && (
          <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            Cliente: {customer.name}{" "}
            <Link href="/pedidos?view=list" className="ml-1 underline">
              remover
            </Link>
          </span>
        )}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title="Nenhum pedido encontrado"
          description="Ajuste os filtros ou registre um novo pedido."
          action={
            <Button asChild>
              <Link href="/pedidos/novo">
                <Plus /> Novo pedido
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* Celular: cartões */}
          <div className="space-y-2 md:hidden">
            {orders.map((o) => (
              <Card key={o.id} className="p-4">
                <Link href={`/pedidos/${o.id}`} className="block">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{formatOrderNumber(o.number)}</span>
                    <span className="font-semibold tabular">{formatMoney(o.totalCents, cur)}</span>
                  </div>
                  <p className="text-sm">{o.customer?.name ?? "Cliente avulso"}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {o.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(o.createdAt, tz)}</p>
                </Link>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <OrderStatusBadge status={o.status} />
                  <PaymentStatusBadge status={o.paymentStatus} />
                  <div className="ml-auto">
                    <QuickStatus orderId={o.id} status={o.status} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {/* Desktop: tabela */}
          <Card className="hidden md:block">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Nº</TH>
                  <TH>Cliente</TH>
                  <TH>Data</TH>
                  <TH>Produtos</TH>
                  <TH className="text-right">Valor</TH>
                  <TH>Status</TH>
                  <TH>Pagamento</TH>
                  <TH className="text-right">Ações</TH>
                </TR>
              </THead>
              <TBody>
                {orders.map((o) => (
                  <TR key={o.id}>
                    <TD>
                      <Link href={`/pedidos/${o.id}`} className="font-bold hover:underline">
                        {formatOrderNumber(o.number)}
                      </Link>
                    </TD>
                    <TD className="max-w-[180px] truncate">{o.customer?.name ?? <span className="text-muted-foreground">Cliente avulso</span>}</TD>
                    <TD className="whitespace-nowrap text-muted-foreground">{formatDateTime(o.createdAt, tz)}</TD>
                    <TD className="max-w-[260px]">
                      <span className="line-clamp-1 text-muted-foreground">
                        {o.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")}
                      </span>
                    </TD>
                    <TD className="text-right font-semibold tabular">{formatMoney(o.totalCents, cur)}</TD>
                    <TD>
                      <OrderStatusBadge status={o.status} />
                    </TD>
                    <TD>
                      <PaymentStatusBadge status={o.paymentStatus} />
                    </TD>
                    <TD>
                      <QuickStatus orderId={o.id} status={o.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            basePath="/pedidos"
            params={{ view: "list", q: sp.q, status: sp.status, pagamento: sp.pagamento, cliente: sp.cliente, period: sp.period, from: sp.from, to: sp.to }}
          />
        </>
      )}
    </div>
  );
}

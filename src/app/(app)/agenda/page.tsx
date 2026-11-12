import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Store, Truck } from "lucide-react";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badges";
import { dayKey, formatDate, parseDateInput, startOfDayTz, toDateInputValue } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatOrderNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "Agenda" };

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ inicio?: string; cancelados?: string }> }) {
  await requireUser();
  const [sp, settings] = await Promise.all([searchParams, getSettings()]);
  const tz = settings.timezone;
  const today = startOfDayTz(new Date(), tz);
  const start = parseDateInput(sp.inicio, tz) ?? today;
  const end = addDays(start, 14);
  const showCancelled = sp.cancelados === "1";

  const orders = await prisma.order.findMany({
    where: {
      scheduledFor: { gte: start, lt: end },
      ...(showCancelled ? {} : { status: { not: "CANCELLED" } }),
    },
    orderBy: { scheduledFor: "asc" },
    include: { customer: { select: { name: true } }, items: { select: { productName: true, variantName: true, quantity: true } } },
  });
  const groups = new Map<string, typeof orders>();
  for (const o of orders) {
    const k = dayKey(o.scheduledFor!, tz);
    groups.set(k, [...(groups.get(k) ?? []), o]);
  }
  const todayKey = dayKey(new Date(), tz);
  const nav = (d: Date) => `/agenda?inicio=${toDateInputValue(d, tz)}${showCancelled ? "&cancelados=1" : ""}`;

  return (
    <>
      <PageHeader
        title="Agenda de encomendas"
        description={`${formatDate(start, "dd/MM", tz)} a ${formatDate(addDays(end, -1), "dd/MM/yyyy", tz)} · ${orders.length} encomenda(s)`}
        actions={
          <div className="flex items-center gap-1">
            <Button asChild variant="outline" size="icon" aria-label="Período anterior">
              <Link href={nav(addDays(start, -14))}>
                <ChevronLeft />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/agenda">Hoje</Link>
            </Button>
            <Button asChild variant="outline" size="icon" aria-label="Próximo período">
              <Link href={nav(end)}>
                <ChevronRight />
              </Link>
            </Button>
          </div>
        }
      />
      <p className="-mt-3 mb-5 text-sm">
        <Link
          href={`/agenda?inicio=${toDateInputValue(start, tz)}${showCancelled ? "" : "&cancelados=1"}`}
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          {showCancelled ? "Ocultar cancelados" : "Mostrar cancelados"}
        </Link>
      </p>
      {orders.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="Nenhuma encomenda neste período"
          description="Pedidos com data e horário previstos aparecem aqui."
        />
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([k, list]) => (
            <section key={k}>
              <h2 className={cn("mb-2 flex items-center gap-2 text-sm font-semibold first-letter:uppercase", k === todayKey && "text-caramel-foreground")}>
                {formatDate(list[0].scheduledFor, "EEEE, dd 'de' MMMM", tz)}
                {k === todayKey && <span className="rounded-full bg-caramel px-2 py-0.5 text-[11px] text-white">Hoje</span>}
              </h2>
              <div className="grid gap-2 md:grid-cols-2">
                {list.map((o) => (
                  <Link key={o.id} href={`/pedidos/${o.id}`}>
                    <Card className="flex gap-4 p-4 transition hover:shadow-lift">
                      <div className="w-14 shrink-0 text-center">
                        <p className="font-display text-xl font-semibold tabular">{formatDate(o.scheduledFor, "HH:mm", tz)}</p>
                        {o.fulfillment === "DELIVERY" ? (
                          <Truck className="mx-auto mt-1 h-4 w-4 text-caramel" aria-label="Entrega" />
                        ) : (
                          <Store className="mx-auto mt-1 h-4 w-4 text-muted-foreground" aria-label="Retirada" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {formatOrderNumber(o.number)} · {o.customer?.name ?? "Cliente avulso"}
                        </p>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {o.items.map((i) => `${i.quantity}x ${i.productName} (${i.variantName})`).join(", ")}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <OrderStatusBadge status={o.status} />
                          <PaymentStatusBadge status={o.paymentStatus} />
                          <span className="ml-auto text-sm font-semibold tabular">{formatMoney(o.totalCents, settings.currency)}</span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

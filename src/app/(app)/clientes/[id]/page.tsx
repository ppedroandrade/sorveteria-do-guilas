import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Copy, Mail, MapPin, MessageCircle, Phone, Plus, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { getCustomerStats } from "@/lib/services/customers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badges";
import { Pagination, parsePage } from "@/components/shared/pagination";
import { EditCustomerButtons } from "@/components/customers/customer-actions";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatOrderNumber, formatPhone } from "@/lib/utils";
import { whatsAppLink } from "@/lib/domain/whatsapp";

const PAGE_SIZE = 15;

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  await requireUser();
  const [{ id }, sp, settings] = await Promise.all([params, searchParams, getSettings()]);
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) notFound();
  const page = parsePage(sp.page);
  const [stats, orders, total, favorites] = await Promise.all([
    getCustomerStats(id),
    prisma.order.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { items: { select: { productName: true, variantName: true, quantity: true } } },
    }),
    prisma.order.count({ where: { customerId: id } }),
    prisma.orderItem.groupBy({
      by: ["productName"],
      where: { order: { customerId: id, status: { not: "CANCELLED" } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
  ]);
  const tz = settings.timezone;
  const cur = settings.currency;

  return (
    <div className="animate-fade-up">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link href="/clientes">
          <ChevronLeft /> Clientes
        </Link>
      </Button>
      <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">
            Cliente desde {formatDate(customer.createdAt, "dd/MM/yyyy", tz)}
            {customer.deletedAt && " · arquivado"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="caramel">
            <Link href={`/pedidos/novo?cliente=${customer.id}`}>
              <Plus /> Novo pedido
            </Link>
          </Button>
          {customer.phone && (
            <Button asChild variant="outline">
              <a href={whatsAppLink(customer.phone, `Olá, ${customer.name.split(" ")[0]}!`)} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> WhatsApp
              </a>
            </Button>
          )}
          {!customer.deletedAt && (
            <EditCustomerButtons
              customerId={customer.id}
              values={{
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                address: customer.address,
                neighborhood: customer.neighborhood,
                city: customer.city,
                notes: customer.notes,
                preferences: customer.preferences,
              }}
            />
          )}
        </div>
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Total gasto" value={formatMoney(stats.totalSpentCents, cur)} tone="primary" />
        <StatCard label="Compras" value={stats.orderCount} hint="Pedidos não cancelados" />
        <StatCard label="Ticket médio" value={formatMoney(stats.averageTicketCents, cur)} />
        <StatCard
          label="Última compra"
          value={stats.lastOrderAt ? formatDate(stats.lastOrderAt, "dd/MM/yy", tz) : "—"}
          hint={stats.openBalanceCents ? `${formatMoney(stats.openBalanceCents, cur)} em aberto` : "Sem pendências"}
          tone={stats.openBalanceCents ? "alert" : "default"}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" /> {formatPhone(customer.phone) || "—"}
              </p>
              <p className="flex items-center gap-2 break-all">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" /> {customer.email ?? "—"}
              </p>
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                {[customer.address, customer.neighborhood, customer.city].filter(Boolean).join(", ") || "—"}
              </p>
              {customer.preferences && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-caramel-soft p-3 text-caramel-foreground">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0" /> {customer.preferences}
                </p>
              )}
              {customer.notes && <p className="rounded-lg bg-muted p-3 text-muted-foreground">{customer.notes}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Sabores favoritos</CardTitle>
            </CardHeader>
            <CardContent>
              {favorites.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ainda sem compras.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {favorites.map((f) => (
                    <li key={f.productName} className="flex justify-between">
                      <span>{f.productName}</span>
                      <span className="font-semibold tabular">{f._sum.quantity}×</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de pedidos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-muted-foreground">Nenhum pedido ainda.</p>
            ) : (
              <ul className="divide-y border-t">
                {orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
                    <Link href={`/pedidos/${o.id}`} className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {formatOrderNumber(o.number)} <span className="font-normal text-muted-foreground">· {formatDateTime(o.createdAt, tz)}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {o.items.map((i) => `${i.quantity}x ${i.productName} (${i.variantName})`).join(", ")}
                      </p>
                    </Link>
                    <OrderStatusBadge status={o.status} />
                    <PaymentStatusBadge status={o.paymentStatus} />
                    <span className="w-24 text-right text-sm font-semibold tabular">{formatMoney(o.totalCents, cur)}</span>
                    <Button asChild variant="ghost" size="icon-sm" title="Repetir pedido">
                      <Link href={`/pedidos/novo?duplicar=${o.id}`} aria-label={`Repetir pedido ${formatOrderNumber(o.number)}`}>
                        <Copy />
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="px-5 pb-4">
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath={`/clientes/${id}`} params={{}} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

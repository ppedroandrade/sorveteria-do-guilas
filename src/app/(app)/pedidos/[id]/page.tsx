import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ChevronLeft, MapPin, MessageCircle, Phone, Store, Truck, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getOrderDetail } from "@/lib/services/orders";
import { getSettings } from "@/lib/services/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badges";
import { OrderActions } from "@/components/orders/order-actions";
import { PaymentPanel } from "@/components/orders/payment-panel";
import { WhatsAppShare } from "@/components/orders/whatsapp-share";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime, formatRelativeSchedule } from "@/lib/dates";
import { formatOrderNumber, formatPhone } from "@/lib/utils";
import { FULFILLMENT_LABEL, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/domain/labels";
import { buildWhatsAppMessage, whatsAppLink } from "@/lib/domain/whatsapp";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getOrderDetail(id);
  return { title: o ? `Pedido ${formatOrderNumber(o.number)}` : "Pedido" };
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ novo?: string }>;
}) {
  await requireUser();
  const [{ id }, sp, settings] = await Promise.all([params, searchParams, getSettings()]);
  const order = await getOrderDetail(id);
  if (!order) notFound();
  const tz = settings.timezone;
  const cur = settings.currency;

  const message = buildWhatsAppMessage(
    {
      number: order.number,
      customerName: order.customer?.name ?? null,
      items: order.items,
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      deliveryFeeCents: order.deliveryFeeCents,
      totalCents: order.totalCents,
      paidCents: order.paidCents,
      paymentStatus: order.paymentStatus,
      fulfillment: order.fulfillment,
      deliveryAddress: order.deliveryAddress,
      scheduledLabel: order.scheduledFor ? formatDate(order.scheduledFor, "EEEE, dd/MM 'às' HH:mm", tz) : null,
      notes: order.notes,
    },
    { businessName: settings.businessName, currency: cur },
  );

  return (
    <div className="animate-fade-up">
      <Button asChild variant="ghost" size="sm" className="no-print -ml-2 mb-2">
        <Link href="/pedidos">
          <ChevronLeft /> Pedidos
        </Link>
      </Button>

      {sp.novo && (
        <div className="no-print mb-4 flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary-soft px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium text-primary">Pedido {formatOrderNumber(order.number)} registrado com sucesso.</p>
          <Button asChild size="sm" variant="caramel">
            <Link href="/pedidos/novo">Criar outro pedido</Link>
          </Button>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-semibold">Pedido {formatOrderNumber(order.number)}</h1>
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Criado em {formatDateTime(order.createdAt, tz)}</p>
          <p className="break-all text-xs text-muted-foreground/80">ID {order.id}</p>
        </div>
        <OrderActions orderId={order.id} status={order.status} netPaidCents={order.paidCents} />
      </div>

      {order.status === "CANCELLED" && (
        <div className="mb-5 rounded-xl border border-destructive/20 bg-destructive-soft px-4 py-3 text-sm text-destructive">
          <strong>Pedido cancelado</strong> em {formatDateTime(order.cancelledAt, tz)}
          {order.cancelReason ? ` — ${order.cancelReason}` : ""}. Não é contabilizado como venda.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Produtos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y border-t">
                {order.items.map((it) => (
                  <li key={it.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        <span className="mr-1.5 text-muted-foreground tabular">{it.quantity}×</span>
                        {it.productName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {it.variantName} · {formatMoney(it.unitPriceCents, cur)} cada
                      </p>
                      {it.notes && <p className="mt-0.5 text-xs text-caramel-foreground">Obs.: {it.notes}</p>}
                    </div>
                    <p className="font-semibold tabular">{formatMoney(it.totalCents, cur)}</p>
                  </li>
                ))}
              </ul>
              <dl className="space-y-1.5 border-t bg-background/40 px-5 py-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular">{formatMoney(order.subtotalCents, cur)}</dd>
                </div>
                {order.discountCents > 0 && (
                  <div className="flex justify-between text-primary">
                    <dt>
                      Desconto
                      {order.discountType === "PERCENT" && ` (${(order.discountValue / 100).toLocaleString("pt-BR")}%)`}
                    </dt>
                    <dd className="tabular">− {formatMoney(order.discountCents, cur)}</dd>
                  </div>
                )}
                {order.deliveryFeeCents > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Taxa de entrega</dt>
                    <dd className="tabular">{formatMoney(order.deliveryFeeCents, cur)}</dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between pt-1">
                  <dt className="font-semibold">Total</dt>
                  <dd className="font-display text-2xl font-semibold tabular">{formatMoney(order.totalCents, cur)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Situação financeira</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentPanel
                orderId={order.id}
                status={order.status}
                totalCents={order.totalCents}
                netPaidCents={order.paidCents}
                preferredMethod={order.preferredPaymentMethod}
                currency={cur}
                payments={order.payments.map((p) => ({
                  id: p.id,
                  kind: p.kind,
                  method: p.method,
                  amountCents: p.amountCents,
                  notes: p.notes,
                  paidAtLabel: formatDateTime(p.paidAt, tz),
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l border-border pl-5">
                {order.statusHistory.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-card bg-primary" />
                    <p className="text-sm font-medium">
                      {h.fromStatus ? `${ORDER_STATUS_LABEL[h.fromStatus]} → ` : ""}
                      {ORDER_STATUS_LABEL[h.toStatus]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(h.createdAt, tz)}
                      {h.note ? ` · ${h.note}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="grid min-w-0 content-start gap-5 md:grid-cols-2 xl:grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {order.customer ? (
                <>
                  <Link href={`/clientes/${order.customer.id}`} className="font-semibold hover:underline">
                    {order.customer.name}
                  </Link>
                  {order.customer.phone && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" /> {formatPhone(order.customer.phone)}
                    </p>
                  )}
                  {order.customer.preferences && <p className="text-xs text-caramel-foreground">{order.customer.preferences}</p>}
                </>
              ) : (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <UserRound className="h-4 w-4" /> Cliente avulso
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entrega</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex items-center gap-2 font-medium">
                {order.fulfillment === "DELIVERY" ? <Truck className="h-4 w-4 text-caramel" /> : <Store className="h-4 w-4 text-caramel" />}
                {FULFILLMENT_LABEL[order.fulfillment]}
              </p>
              {order.deliveryAddress && (
                <p className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {order.deliveryAddress}
                </p>
              )}
              <p className="flex items-center gap-2 text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                {order.scheduledFor ? formatRelativeSchedule(order.scheduledFor, new Date(), tz) : "Sem horário agendado"}
              </p>
              {order.preferredPaymentMethod && (
                <p className="text-muted-foreground">Pagamento combinado: {PAYMENT_METHOD_LABEL[order.preferredPaymentMethod]}</p>
              )}
              {order.notes && (
                <p className="rounded-lg bg-caramel-soft px-3 py-2 text-caramel-foreground">
                  <strong>Obs.:</strong> {order.notes}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="no-print md:col-span-2 xl:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-[#1f8f4e]" /> Resumo para WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WhatsAppShare message={message} link={whatsAppLink(order.customer?.phone, message)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { getSellableCatalog } from "@/lib/services/products";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { OrderForm } from "@/components/orders/order-form";
import { formatOrderNumber } from "@/lib/utils";
import { toDateTimeLocalValue } from "@/lib/dates";
import { centsToInput } from "@/lib/money";

export const metadata = { title: "Editar pedido" };

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [order, settings, catalog] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        customer: { select: { id: true, name: true, phone: true, address: true, neighborhood: true, city: true, preferences: true } },
      },
    }),
    getSettings(),
    getSellableCatalog(),
  ]);
  if (!order) notFound();
  if (order.status === "CANCELLED" || order.status === "DELIVERED") redirect(`/pedidos/${id}`);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link href={`/pedidos/${id}`}>
          <ChevronLeft /> Pedido {formatOrderNumber(order.number)}
        </Link>
      </Button>
      <PageHeader
        title={`Editar pedido ${formatOrderNumber(order.number)}`}
        description="Itens já existentes mantêm o preço da venda original; itens novos usam o preço atual."
      />
      <OrderForm
        mode="edit"
        orderId={order.id}
        catalog={catalog}
        currency={settings.currency}
        defaultDeliveryFeeCents={settings.defaultDeliveryFeeCents}
        initial={{
          customer: order.customer,
          items: order.items.map((i) => ({
            key: i.id,
            id: i.id,
            variantId: i.variantId,
            productId: i.productId,
            productName: i.productName,
            variantName: i.variantName,
            unitPriceCents: i.unitPriceCents,
            quantity: i.quantity,
            notes: i.notes ?? "",
          })),
          fulfillment: order.fulfillment,
          deliveryAddress: order.deliveryAddress ?? "",
          deliveryFeeCents: order.deliveryFeeCents,
          scheduledFor: toDateTimeLocalValue(order.scheduledFor, settings.timezone),
          discountType: order.discountType ?? "AMOUNT",
          discountAmountCents: order.discountType === "AMOUNT" ? order.discountValue : 0,
          discountPercent: order.discountType === "PERCENT" ? centsToInput(order.discountValue).replace(/,00$/, "") : "",
          preferredPaymentMethod: order.preferredPaymentMethod ?? "",
          notes: order.notes ?? "",
        }}
      />
    </>
  );
}

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { getSellableCatalog } from "@/lib/services/products";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { OrderForm, type OrderFormValues } from "@/components/orders/order-form";
import { formatOrderNumber } from "@/lib/utils";

export const metadata = { title: "Novo pedido" };

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicar?: string; cliente?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const [settings, catalog] = await Promise.all([getSettings(), getSellableCatalog()]);

  let initial: Partial<OrderFormValues> | undefined;
  const warnings: string[] = [];
  let subtitle = "Selecione o cliente, toque nos sabores e confirme.";

  const customerSelect = { id: true, name: true, phone: true, address: true, neighborhood: true, city: true, preferences: true } as const;

  if (sp.duplicar) {
    const source = await prisma.order.findUnique({
      where: { id: sp.duplicar },
      include: { items: true, customer: { select: { ...customerSelect, deletedAt: true } } },
    });
    if (source) {
      subtitle = `Cópia do pedido ${formatOrderNumber(source.number)} — preços atualizados pelo catálogo atual.`;
      const variants = new Map(catalog.flatMap((p) => p.variants.map((v) => [v.id, { p, v }] as const)));
      const items: OrderFormValues["items"] = [];
      for (const it of source.items) {
        const found = variants.get(it.variantId);
        if (!found || !found.p.isAvailable) {
          warnings.push(`"${it.productName} (${it.variantName})" não está disponível e foi removido da cópia.`);
          continue;
        }
        if (found.v.priceCents !== it.unitPriceCents) {
          warnings.push(`O preço de "${it.productName} (${found.v.name})" mudou desde o pedido original.`);
        }
        items.push({
          key: it.id,
          id: null,
          variantId: found.v.id,
          productId: found.p.id,
          productName: found.p.name,
          variantName: found.v.name,
          unitPriceCents: found.v.priceCents,
          quantity: it.quantity,
          notes: it.notes ?? "",
        });
      }
      const { deletedAt, ...customer } = source.customer ?? { deletedAt: null };
      initial = {
        customer: source.customer && !deletedAt ? (customer as OrderFormValues["customer"]) : null,
        items,
        fulfillment: source.fulfillment,
        deliveryAddress: source.deliveryAddress ?? "",
        deliveryFeeCents: source.fulfillment === "DELIVERY" ? source.deliveryFeeCents : settings.defaultDeliveryFeeCents,
        preferredPaymentMethod: source.preferredPaymentMethod ?? "",
        notes: source.notes ?? "",
      };
    }
  } else if (sp.cliente) {
    const c = await prisma.customer.findFirst({ where: { id: sp.cliente, deletedAt: null }, select: customerSelect });
    if (c) {
      initial = {
        customer: c,
        deliveryAddress: [c.address, c.neighborhood, c.city].filter(Boolean).join(", "),
      };
    }
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link href="/pedidos">
          <ChevronLeft /> Pedidos
        </Link>
      </Button>
      <PageHeader title="Novo pedido" description={subtitle} />
      <OrderForm
        mode="create"
        catalog={catalog}
        currency={settings.currency}
        defaultDeliveryFeeCents={settings.defaultDeliveryFeeCents}
        initial={initial}
        warnings={warnings}
      />
    </>
  );
}

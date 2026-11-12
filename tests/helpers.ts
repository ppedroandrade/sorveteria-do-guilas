import { prisma } from "@/lib/prisma";

export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

export async function resetDb() {
  // Trava de segurança: só limpa o banco configurado como TEST_DATABASE_URL.
  if (!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
    throw new Error("resetDb() recusado: DATABASE_URL não aponta para TEST_DATABASE_URL.");
  }
  await prisma.$executeRawUnsafe(
    `TRUNCATE "InventoryMovement","Payment","OrderStatusHistory","OrderItem","Order","ProductVariant","Product","Category","Presentation","Customer","Session","User","BusinessSettings" RESTART IDENTITY CASCADE`,
  );
}

/** Catálogo mínimo: 2 apresentações e alguns sabores. */
export async function seedCatalog() {
  const t1 = await prisma.presentation.create({ data: { name: "Tamanho 1", sortOrder: 1 } });
  const t2 = await prisma.presentation.create({ data: { name: "Tamanho 2", sortOrder: 2 } });
  const mk = (name: string, p1: number, p2: number, extra: Record<string, unknown> = {}) =>
    prisma.product.create({
      data: {
        name,
        ...extra,
        variants: {
          create: [
            { presentationId: t1.id, priceCents: p1, sortOrder: 0 },
            { presentationId: t2.id, priceCents: p2, sortOrder: 1 },
          ],
        },
      },
      include: { variants: { orderBy: { sortOrder: "asc" } } },
    });
  const pistache = await mk("Pistache", 5400, 10000);
  const milho = await mk("Milho", 4200, 8000);
  const doce = await mk("Doce de leite", 4500, 8500);
  return { t1, t2, pistache, milho, doce };
}

export function orderInput(items: { variantId: string; quantity: number; id?: string | null }[], extra: Record<string, unknown> = {}) {
  return {
    idempotencyKey: null,
    customerId: null,
    items: items.map((i) => ({ id: i.id ?? null, variantId: i.variantId, quantity: i.quantity, notes: null })),
    fulfillment: "PICKUP" as const,
    deliveryAddress: null,
    deliveryFeeCents: 0,
    scheduledFor: null,
    discountType: null,
    discountValue: 0,
    preferredPaymentMethod: null,
    notes: null,
    payNow: null,
    ...extra,
  };
}

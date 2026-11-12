import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import type { z } from "zod";
import type { productSchema } from "@/lib/validation";

type ProductParsed = z.output<typeof productSchema>;

async function assertPresentations(ids: (string | null | undefined)[]) {
  const wanted = [...new Set(ids.filter(Boolean) as string[])];
  if (!wanted.length) return;
  const found = await prisma.presentation.count({ where: { id: { in: wanted } } });
  if (found !== wanted.length) throw new DomainError("Apresentação inválida.");
}

export async function saveProduct(id: string | null, input: ProductParsed) {
  await assertPresentations(input.variants.map((v) => v.presentationId));
  const base = {
    name: input.name,
    description: input.description,
    categoryId: input.categoryId,
    imageDataUrl: input.imageDataUrl,
    isVegan: input.isVegan,
    isAvailable: input.isAvailable,
    trackStock: input.trackStock,
    stockUnit: input.stockUnit,
    minStockMilli: input.minStockMilli,
    allowNegativeStock: input.allowNegativeStock,
  };
  const variantData = (v: ProductParsed["variants"][number], i: number) => ({
    presentationId: v.presentationId || null,
    customName: v.customName,
    priceCents: v.priceCents,
    stockConsumptionMilli: v.stockConsumptionMilli ?? null,
    active: v.active,
    sortOrder: i,
  });

  if (!id) {
    return prisma.product.create({
      data: { ...base, variants: { create: input.variants.map(variantData) } },
    });
  }

  return prisma.$transaction(async (tx) => {
    const current = await tx.product.findUnique({ where: { id }, include: { variants: { include: { _count: { select: { orderItems: true } } } } } });
    if (!current) throw new DomainError("Produto não encontrado.");
    await tx.product.update({ where: { id }, data: base });

    const keepIds = new Set(input.variants.map((v) => v.id).filter(Boolean) as string[]);
    for (const [i, v] of input.variants.entries()) {
      if (v.id) {
        if (!current.variants.some((cv) => cv.id === v.id)) throw new DomainError("Apresentação inválida para este produto.");
        await tx.productVariant.update({ where: { id: v.id }, data: variantData(v, i) });
      } else {
        await tx.productVariant.create({ data: { ...variantData(v, i), productId: id } });
      }
    }
    // Variantes removidas do formulário: apaga se nunca foram vendidas; senão apenas desativa.
    for (const cv of current.variants) {
      if (keepIds.has(cv.id)) continue;
      if (cv._count.orderItems > 0) await tx.productVariant.update({ where: { id: cv.id }, data: { active: false } });
      else await tx.productVariant.delete({ where: { id: cv.id } });
    }
    return tx.product.findUniqueOrThrow({ where: { id } });
  });
}

/** Catálogo enxuto para o formulário de pedido (sem imagens pesadas). */
export async function getSellableCatalog() {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isVegan: true,
      isAvailable: true,
      trackStock: true,
      stockMilli: true,
      minStockMilli: true,
      stockUnit: true,
      category: { select: { id: true, name: true } },
      variants: {
        where: { active: true },
        orderBy: [{ presentation: { sortOrder: "asc" } }, { sortOrder: "asc" }],
        select: {
          id: true,
          customName: true,
          priceCents: true,
          stockConsumptionMilli: true,
          presentation: { select: { name: true } },
        },
      },
    },
  });
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    isVegan: p.isVegan,
    isAvailable: p.isAvailable,
    categoryId: p.category?.id ?? null,
    categoryName: p.category?.name ?? "Sem categoria",
    trackStock: p.trackStock,
    stockMilli: p.stockMilli,
    minStockMilli: p.minStockMilli,
    stockUnit: p.stockUnit,
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.customName ?? v.presentation?.name ?? "Padrão",
      priceCents: v.priceCents,
      stockConsumptionMilli: v.stockConsumptionMilli,
    })),
  }));
}
export type SellableProduct = Awaited<ReturnType<typeof getSellableCatalog>>[number];

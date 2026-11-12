import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/products/product-form";

export const metadata = { title: "Editar sabor" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [product, categories, presentations, sales] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { variants: { orderBy: [{ active: "desc" }, { sortOrder: "asc" }] } },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.presentation.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, active: true } }),
    prisma.orderItem.count({ where: { productId: id } }),
  ]);
  if (!product) notFound();
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link href="/produtos">
          <ChevronLeft /> Produtos
        </Link>
      </Button>
      <PageHeader title={product.name} description={product.active ? undefined : "Este sabor está desativado."} />
      <ProductForm
        productId={product.id}
        categories={categories}
        presentations={presentations}
        hasSales={sales > 0}
        defaultValues={{
          name: product.name,
          description: product.description ?? "",
          categoryId: product.categoryId ?? "",
          imageDataUrl: product.imageDataUrl,
          isVegan: product.isVegan,
          isAvailable: product.isAvailable,
          trackStock: product.trackStock,
          stockUnit: product.stockUnit ?? "",
          minStockMilli: product.minStockMilli,
          allowNegativeStock: product.allowNegativeStock,
          variants: product.variants.map((v) => ({
            id: v.id,
            presentationId: v.presentationId,
            customName: v.customName ?? "",
            priceCents: v.priceCents,
            stockConsumptionMilli: v.stockConsumptionMilli,
            active: v.active,
          })),
        }}
      />
    </>
  );
}

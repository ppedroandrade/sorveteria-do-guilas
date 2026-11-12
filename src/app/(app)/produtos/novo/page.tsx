import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/products/product-form";

export const metadata = { title: "Novo sabor" };

export default async function NewProductPage() {
  await requireUser();
  const [categories, presentations] = await Promise.all([
    prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.presentation.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, active: true } }),
  ]);
  const active = presentations.filter((p) => p.active);
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link href="/produtos">
          <ChevronLeft /> Produtos
        </Link>
      </Button>
      <PageHeader title="Novo sabor" />
      <ProductForm
        categories={categories}
        presentations={presentations}
        defaultValues={{
          name: "",
          description: "",
          categoryId: "",
          imageDataUrl: null,
          isVegan: false,
          isAvailable: true,
          trackStock: false,
          stockUnit: "",
          minStockMilli: 0,
          allowNegativeStock: false,
          variants: (active.length ? active : [{ id: null }]).map((p) => ({
            presentationId: p.id,
            customName: "",
            priceCents: 0,
            stockConsumptionMilli: null,
            active: true,
          })),
        }}
      />
    </>
  );
}

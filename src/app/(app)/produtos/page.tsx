import Link from "next/link";
import { IceCreamCone, Leaf, Plus, Settings } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AvailabilitySwitch, ProductMenu } from "@/components/products/product-toggles";
import { formatMilli, formatMoney } from "@/lib/money";
import { stockLevel } from "@/lib/domain/stock";
import { cn } from "@/lib/utils";

export const metadata = { title: "Produtos e sabores" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ inativos?: string }> }) {
  await requireUser();
  const [sp, settings] = await Promise.all([searchParams, getSettings()]);
  const showInactive = sp.inativos === "1";
  const products = await prisma.product.findMany({
    where: showInactive ? {} : { active: true },
    orderBy: [{ active: "desc" }, { category: { sortOrder: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isVegan: true,
      isAvailable: true,
      active: true,
      trackStock: true,
      stockMilli: true,
      minStockMilli: true,
      stockUnit: true,
      imageDataUrl: true,
      category: { select: { name: true } },
      variants: {
        where: { active: true },
        orderBy: [{ presentation: { sortOrder: "asc" } }, { sortOrder: "asc" }],
        select: { id: true, customName: true, priceCents: true, presentation: { select: { name: true } } },
      },
    },
  });
  const inactiveCount = showInactive ? 0 : await prisma.product.count({ where: { active: false } });
  const cur = settings.currency;

  return (
    <>
      <PageHeader
        title="Produtos e sabores"
        description={`${products.filter((p) => p.active).length} sabores ativos · ${products.filter((p) => p.active && p.isAvailable).length} disponíveis agora`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/configuracoes#apresentacoes">
                <Settings /> Tamanhos e categorias
              </Link>
            </Button>
            <Button asChild>
              <Link href="/produtos/novo">
                <Plus /> Novo sabor
              </Link>
            </Button>
          </>
        }
      />
      {products.length === 0 ? (
        <EmptyState icon={<IceCreamCone />} title="Nenhum sabor cadastrado" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => {
            const level = stockLevel(p);
            return (
              <Card key={p.id} className={cn("flex flex-col p-4 transition hover:shadow-lift", !p.active && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary-soft to-caramel-soft">
                    {p.imageDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageDataUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <IceCreamCone className="h-6 w-6 text-caramel" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/produtos/${p.id}`} className="font-semibold leading-snug hover:underline">
                      {p.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.category && <Badge variant="muted">{p.category.name}</Badge>}
                      {p.isVegan && (
                        <Badge>
                          <Leaf /> Vegano
                        </Badge>
                      )}
                      {!p.active && <Badge variant="outline">Desativado</Badge>}
                      {level === "low" && <Badge variant="caramel">Estoque baixo</Badge>}
                      {level === "out" && <Badge variant="destructive">Sem estoque</Badge>}
                    </div>
                  </div>
                  <ProductMenu id={p.id} active={p.active} name={p.name} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.variants.map((v) => (
                    <div key={v.id} className="rounded-lg bg-background/70 px-2.5 py-1.5">
                      <p className="text-[11px] text-muted-foreground">{v.customName ?? v.presentation?.name ?? "Padrão"}</p>
                      <p className="text-sm font-semibold tabular">{formatMoney(v.priceCents, cur)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-sm">
                  <label className="flex items-center gap-2">
                    <AvailabilitySwitch id={p.id} value={p.isAvailable} disabled={!p.active} />
                    <span className={p.isAvailable ? "font-medium" : "text-muted-foreground"}>
                      {p.isAvailable ? "Disponível" : "Indisponível"}
                    </span>
                  </label>
                  {p.trackStock && (
                    <span className="text-xs text-muted-foreground tabular">
                      Estoque: {formatMilli(p.stockMilli)} {p.stockUnit}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {(inactiveCount > 0 || showInactive) && (
        <p className="mt-4 text-sm">
          <Link href={showInactive ? "/produtos" : "/produtos?inativos=1"} className="font-medium text-primary underline-offset-2 hover:underline">
            {showInactive ? "Ocultar desativados" : `Mostrar ${inactiveCount} desativado(s)`}
          </Link>
        </p>
      )}
    </>
  );
}

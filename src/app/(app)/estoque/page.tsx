import Link from "next/link";
import { Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { MovementButton } from "@/components/stock/movement-dialog";
import { Pagination, parsePage } from "@/components/shared/pagination";
import { formatMilli } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { MOVEMENT_LABEL } from "@/lib/domain/labels";
import { stockLevel } from "@/lib/domain/stock";
import { formatOrderNumber } from "@/lib/utils";

export const metadata = { title: "Estoque" };
const PAGE_SIZE = 30;

export default async function StockPage({ searchParams }: { searchParams: Promise<{ produto?: string; page?: string }> }) {
  await requireUser();
  const [sp, settings] = await Promise.all([searchParams, getSettings()]);
  const page = parsePage(sp.page);
  const movementWhere = sp.produto ? { productId: sp.produto } : {};
  const [tracked, untrackedCount, movements, totalMovements] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, trackStock: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        stockMilli: true,
        minStockMilli: true,
        stockUnit: true,
        allowNegativeStock: true,
        variants: { where: { active: true }, select: { stockConsumptionMilli: true, customName: true, presentation: { select: { name: true } } } },
      },
    }),
    prisma.product.count({ where: { active: true, trackStock: false } }),
    prisma.inventoryMovement.findMany({
      where: movementWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { product: { select: { name: true, stockUnit: true } }, order: { select: { id: true, number: true } } },
    }),
    prisma.inventoryMovement.count({ where: movementWhere }),
  ]);
  const tz = settings.timezone;
  const filtered = sp.produto ? tracked.find((t) => t.id === sp.produto) : null;

  return (
    <>
      <PageHeader
        title="Estoque"
        description="Controle simples e opcional. A baixa é automática ao criar pedidos e devolvida ao cancelar ou editar."
      />
      {tracked.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title="Nenhum produto com controle de estoque"
          description="Ative o controle em Produtos → editar sabor → Controle de estoque. Lá você define a unidade (litro, pote…) e quanto cada tamanho consome."
        />
      ) : (
        <Card className="mb-6">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Produto</TH>
                <TH className="text-right">Saldo</TH>
                <TH className="hidden text-right sm:table-cell">Mínimo</TH>
                <TH className="hidden md:table-cell">Consumo por venda</TH>
                <TH>Situação</TH>
                <TH className="text-right">Ação</TH>
              </TR>
            </THead>
            <TBody>
              {tracked.map((p) => {
                const level = stockLevel({ trackStock: true, ...p });
                return (
                  <TR key={p.id}>
                    <TD>
                      <Link href={`/estoque?produto=${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                    </TD>
                    <TD className="text-right font-semibold tabular">
                      {formatMilli(p.stockMilli)} <span className="font-normal text-muted-foreground">{p.stockUnit}</span>
                    </TD>
                    <TD className="hidden text-right tabular text-muted-foreground sm:table-cell">{formatMilli(p.minStockMilli)}</TD>
                    <TD className="hidden text-xs text-muted-foreground md:table-cell">
                      {p.variants
                        .map((v) => `${v.customName ?? v.presentation?.name}: ${v.stockConsumptionMilli ? formatMilli(v.stockConsumptionMilli) : "⚠ não configurado"}`)
                        .join(" · ")}
                    </TD>
                    <TD>
                      {level === "out" ? (
                        <Badge variant="destructive">Sem estoque</Badge>
                      ) : level === "low" ? (
                        <Badge variant="caramel">Baixo</Badge>
                      ) : (
                        <Badge>OK</Badge>
                      )}
                    </TD>
                    <TD className="text-right">
                      <MovementButton product={p} />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          {untrackedCount > 0 && (
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">
              {untrackedCount} sabor(es) sem controle de estoque. <Link href="/produtos" className="underline">Configurar em Produtos</Link>.
            </p>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Movimentações {filtered && `· ${filtered.name}`}</CardTitle>
          <CardDescription>
            {filtered ? <Link href="/estoque" className="underline">Ver todas</Link> : "Histórico de entradas, saídas, ajustes e baixas por pedido."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {movements.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Data</TH>
                  <TH>Produto</TH>
                  <TH>Tipo</TH>
                  <TH className="text-right">Qtd.</TH>
                  <TH className="hidden text-right sm:table-cell">Saldo após</TH>
                  <TH className="hidden md:table-cell">Origem</TH>
                </TR>
              </THead>
              <TBody>
                {movements.map((m) => (
                  <TR key={m.id}>
                    <TD className="whitespace-nowrap text-muted-foreground">{formatDateTime(m.createdAt, tz)}</TD>
                    <TD>{m.product.name}</TD>
                    <TD>{MOVEMENT_LABEL[m.type]}</TD>
                    <TD className={`text-right font-semibold tabular ${m.quantityMilli < 0 ? "text-destructive" : "text-primary"}`}>
                      {m.quantityMilli > 0 ? "+" : ""}
                      {formatMilli(m.quantityMilli)}
                    </TD>
                    <TD className="hidden text-right tabular text-muted-foreground sm:table-cell">
                      {formatMilli(m.balanceAfterMilli)} {m.product.stockUnit}
                    </TD>
                    <TD className="hidden text-muted-foreground md:table-cell">
                      {m.order ? (
                        <Link href={`/pedidos/${m.order.id}`} className="underline">
                          Pedido {formatOrderNumber(m.order.number)}
                        </Link>
                      ) : (
                        m.reason ?? "—"
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
          <div className="px-5 pb-4">
            <Pagination page={page} pageSize={PAGE_SIZE} total={totalMovements} basePath="/estoque" params={{ produto: sp.produto }} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

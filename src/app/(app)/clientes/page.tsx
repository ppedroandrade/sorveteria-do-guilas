import Link from "next/link";
import { Suspense } from "react";
import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { customerSearchWhere } from "@/lib/services/customers";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Pagination, parsePage } from "@/components/shared/pagination";
import { NewCustomerButton } from "@/components/customers/customer-actions";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { formatPhone } from "@/lib/utils";

export const metadata = { title: "Clientes" };
const PAGE_SIZE = 25;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireUser();
  const [sp, settings] = await Promise.all([searchParams, getSettings()]);
  const page = parsePage(sp.page);
  const where = customerSearchWhere(sp.q);
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, name: true, phone: true, neighborhood: true, city: true, createdAt: true },
    }),
    prisma.customer.count({ where }),
  ]);
  const stats = customers.length
    ? await prisma.order.groupBy({
        by: ["customerId"],
        where: { customerId: { in: customers.map((c) => c.id) }, status: { not: "CANCELLED" } },
        _sum: { totalCents: true },
        _count: { _all: true },
        _max: { createdAt: true },
      })
    : [];
  const byId = new Map(stats.map((s) => [s.customerId, s]));
  const tz = settings.timezone;
  const cur = settings.currency;

  return (
    <>
      <PageHeader title="Clientes" description={`${total} cliente(s) cadastrado(s)`} actions={<NewCustomerButton />} />
      <div className="mb-4">
        <Suspense>
          <SearchInput placeholder="Buscar por nome ou telefone…" />
        </Suspense>
      </div>
      {customers.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={sp.q ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          description="Clientes também podem ser cadastrados direto no novo pedido."
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Nome</TH>
                <TH className="hidden sm:table-cell">Telefone</TH>
                <TH className="hidden lg:table-cell">Bairro</TH>
                <TH className="text-right">Pedidos</TH>
                <TH className="text-right">Total gasto</TH>
                <TH className="hidden md:table-cell">Última compra</TH>
              </TR>
            </THead>
            <TBody>
              {customers.map((c) => {
                const s = byId.get(c.id);
                return (
                  <TR key={c.id}>
                    <TD>
                      <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      <p className="text-xs text-muted-foreground sm:hidden">{formatPhone(c.phone)}</p>
                    </TD>
                    <TD className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">{formatPhone(c.phone) || "—"}</TD>
                    <TD className="hidden text-muted-foreground lg:table-cell">{c.neighborhood ?? "—"}</TD>
                    <TD className="text-right tabular">{s?._count._all ?? 0}</TD>
                    <TD className="text-right font-semibold tabular">{formatMoney(s?._sum.totalCents ?? 0, cur)}</TD>
                    <TD className="hidden text-muted-foreground md:table-cell">{s?._max.createdAt ? formatDate(s._max.createdAt, "dd/MM/yyyy", tz) : "—"}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/clientes" params={{ q: sp.q }} />
    </>
  );
}

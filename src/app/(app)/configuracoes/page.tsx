import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "@/components/settings/settings-form";
import { CategoriesEditor, PresentationsEditor } from "@/components/settings/catalog-settings";
import { PasswordForm } from "@/components/settings/password-form";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [s, presentations, categories, customNames] = await Promise.all([
    getSettings(),
    prisma.presentation.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { variants: true } } } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } }),
    prisma.productVariant.groupBy({ by: ["presentationId"], where: { customName: { not: null } }, _count: { _all: true } }),
  ]);
  const customBy = new Map(customNames.map((c) => [c.presentationId, c._count._all]));

  return (
    <>
      <PageHeader title="Configurações" description="Dados do negócio, tamanhos, categorias e acesso." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="xl:row-span-2">
          <CardHeader>
            <CardTitle>Dados da sorveteria</CardTitle>
            <CardDescription>Aparecem no menu, no comprovante e nas mensagens de WhatsApp.</CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm
              defaultValues={{
                businessName: s.businessName,
                logoDataUrl: s.logoDataUrl,
                phone: s.phone ?? "",
                address: s.address ?? "",
                currency: s.currency,
                timezone: s.timezone,
                defaultDeliveryFeeCents: s.defaultDeliveryFeeCents,
                receiptHeader: s.receiptHeader ?? "",
                receiptFooter: s.receiptFooter ?? "",
              }}
            />
          </CardContent>
        </Card>
        <Card id="apresentacoes" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>Apresentações (tamanhos)</CardTitle>
            <CardDescription>
              Renomear aqui altera o nome em todos os sabores (exceto os que têm nome próprio). Os preços são definidos em cada sabor.
              Pedidos já feitos mantêm o nome usado na venda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PresentationsEditor
              rows={presentations.map((p) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                sortOrder: p.sortOrder,
                active: p.active,
                count: p._count.variants,
                customCount: customBy.get(p.id) ?? 0,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoriesEditor
              rows={categories.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder, active: c.active, count: c._count.products }))}
            />
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Acesso</CardTitle>
            <CardDescription>Conectado como {user.login}</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

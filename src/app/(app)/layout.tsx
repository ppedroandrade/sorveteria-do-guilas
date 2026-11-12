import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";

// Dados sempre frescos: é um painel operacional.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [settings, pendingCount] = await Promise.all([
    getSettings(),
    prisma.order.count({ where: { status: "PENDING" } }),
  ]);
  return (
    <AppShell businessName={settings.businessName} logo={settings.logoDataUrl} userName={user.name} pendingCount={pendingCount}>
      {children}
    </AppShell>
  );
}

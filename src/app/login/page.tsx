import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { LoginForm } from "./login-form";
import { BrandLogo } from "@/components/shared/logo";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentSession()) redirect("/");
  const [{ next }, settings] = await Promise.all([searchParams, getSettings()]);
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary-soft blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-caramel-soft blur-3xl" aria-hidden />
      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex justify-center">
          <BrandLogo name={settings.businessName} logo={settings.logoDataUrl} />
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-lift sm:p-8">
          <h1 className="font-display text-2xl font-semibold">Bem-vindo de volta</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">Entre para gerenciar pedidos, sabores e vendas.</p>
          <LoginForm next={next ?? "/"} />
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">Acesso restrito ao proprietário.</p>
      </div>
    </main>
  );
}

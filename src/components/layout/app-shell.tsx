"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";
import { NAV_ITEMS } from "./nav-items";

type ShellProps = {
  businessName: string;
  logo: string | null;
  userName: string;
  pendingCount: number;
  children: React.ReactNode;
};

const COLLAPSE_KEY = "gelateria.sidebar.collapsed";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({
  pathname,
  collapsed,
  pendingCount,
  onNavigate,
}: {
  pathname: string;
  collapsed?: boolean;
  pendingCount: number;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Menu principal">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        const badge = item.badgeKey === "pending" && pendingCount > 0 ? pendingCount : null;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-card/70 hover:text-sidebar-foreground",
              active && "bg-card text-sidebar-foreground shadow-soft",
              collapsed && "justify-center px-0",
            )}
          >
            <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-primary" : "text-sidebar-foreground/55")} />
            {!collapsed && <span className="truncate">{item.label}</span>}
            {badge !== null &&
              (collapsed ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-caramel" aria-label={`${badge} pendentes`} />
              ) : (
                <span className="ml-auto rounded-full bg-caramel px-2 py-0.5 text-[11px] font-bold text-white tabular">{badge}</span>
              ))}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ businessName, logo, userName, pendingCount, children }: ShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });

  const onNewOrderPage = pathname === "/pedidos/novo";

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar desktop */}
      <aside
        className={cn(
          "no-print sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 lg:flex",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <div className={cn("flex h-16 items-center px-4", collapsed && "justify-center px-0")}>
          <Link href="/" aria-label="Início">
            <BrandLogo name={businessName} logo={logo} compact={collapsed} />
          </Link>
        </div>
        <div className={cn("px-3 pb-3", collapsed && "px-2")}>
          <Button asChild variant="caramel" className={cn("w-full", collapsed && "px-0")}>
            <Link href="/pedidos/novo" title="Novo pedido">
              <Plus /> {!collapsed && "Novo pedido"}
            </Link>
          </Button>
        </div>
        <div className={cn("flex-1 overflow-y-auto px-3 scrollbar-thin", collapsed && "px-2")}>
          <NavList pathname={pathname} collapsed={collapsed} pendingCount={pendingCount} />
        </div>
        <div className={cn("flex items-center gap-2 border-t p-3", collapsed && "flex-col")}>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{userName}</p>
              <form action={logoutAction}>
                <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <LogOut className="h-3 w-3" /> Sair
                </button>
              </form>
            </div>
          )}
          {collapsed && (
            <form action={logoutAction}>
              <Button variant="ghost" size="icon-sm" title="Sair" aria-label="Sair">
                <LogOut />
              </Button>
            </form>
          )}
          <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar mobile/tablet */}
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu />
          </Button>
          <Link href="/" className="min-w-0 flex-1">
            <BrandLogo name={businessName} logo={logo} />
          </Link>
          {!onNewOrderPage && (
            <Button asChild variant="caramel" size="sm">
              <Link href="/pedidos/novo">
                <Plus /> Pedido
              </Link>
            </Button>
          )}
        </header>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent className="flex flex-col">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <div className="flex h-16 items-center px-4">
              <BrandLogo name={businessName} logo={logo} />
            </div>
            <div className="px-3 pb-3">
              <Button asChild variant="caramel" className="w-full">
                <Link href="/pedidos/novo" onClick={() => setMobileOpen(false)}>
                  <Plus /> Novo pedido
                </Link>
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-3">
              <NavList pathname={pathname} pendingCount={pendingCount} onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="border-t p-4">
              <p className="truncate text-sm font-semibold">{userName}</p>
              <form action={logoutAction}>
                <button className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  <LogOut className="h-3.5 w-3.5" /> Sair
                </button>
              </form>
            </div>
          </SheetContent>
        </Sheet>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

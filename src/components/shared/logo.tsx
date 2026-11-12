import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-9 w-9", className)} aria-hidden>
      <rect width="64" height="64" rx="16" fill="hsl(var(--caramel-soft))" />
      <path d="M22 30h20l-10 24z" fill="hsl(var(--caramel))" />
      <circle cx="32" cy="24" r="12" fill="#93b16f" />
      <circle cx="26" cy="20" r="3" fill="#fff" opacity=".5" />
    </svg>
  );
}

export function BrandLogo({ name, logo, compact }: { name: string; logo?: string | null; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
      ) : (
        <LogoMark className="shrink-0" />
      )}
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-[1.05rem] font-semibold">{name}</p>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Gestão</p>
        </div>
      )}
    </div>
  );
}

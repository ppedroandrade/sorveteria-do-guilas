"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRESETS = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "month", label: "Este mês" },
  { value: "lastMonth", label: "Mês passado" },
] as const;

/** Filtro de período baseado na URL (?period=…&from=…&to=…). */
export function PeriodFilter({ preset, from, to }: { preset: string; from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [custom, setCustom] = React.useState(preset === "custom");
  const [f, setF] = React.useState(from);
  const [t, setT] = React.useState(to);
  const [pending, startTransition] = React.useTransition();

  function apply(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    sp.delete("page");
    startTransition(() => router.push(`${pathname}?${sp.toString()}`, { scroll: false }));
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", pending && "opacity-70")}>
      <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => {
              setCustom(false);
              apply({ period: p.value, from: null, to: null });
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition sm:text-sm",
              preset === p.value && !custom && "bg-card text-foreground shadow-sm",
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustom((c) => !c)}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition sm:text-sm",
            (custom || preset === "custom") && "bg-card text-foreground shadow-sm",
          )}
        >
          <CalendarRange className="h-3.5 w-3.5" /> Personalizado
        </button>
      </div>
      {custom && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (f && t) apply({ period: "custom", from: f, to: t });
          }}
        >
          <Input type="date" value={f} onChange={(e) => setF(e.target.value)} className="h-9 w-[150px]" aria-label="Data inicial" />
          <span className="text-sm text-muted-foreground">até</span>
          <Input type="date" value={t} onChange={(e) => setT(e.target.value)} className="h-9 w-[150px]" aria-label="Data final" />
          <Button size="sm" type="submit" loading={pending}>Aplicar</Button>
        </form>
      )}
    </div>
  );
}

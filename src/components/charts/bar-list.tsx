import { cn } from "@/lib/utils";

/**
 * Ranking em barras horizontais (magnitude, um único tom). Leve, acessível e
 * legível no celular — os valores ficam sempre escritos ao lado da barra.
 */
export function BarList({
  items,
  emptyLabel = "Sem dados no período.",
  className,
}: {
  items: { key: string; label: React.ReactNode; value: number; display: string; sub?: string }[];
  emptyLabel?: string;
  className?: string;
}) {
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ol className={cn("space-y-2.5", className)}>
      {items.map((i, idx) => (
        <li key={i.key} className="text-sm" title={`${typeof i.label === "string" ? i.label : ""} ${i.display}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">
              <span className="mr-1.5 text-xs font-semibold text-muted-foreground tabular">{idx + 1}.</span>
              {i.label}
            </span>
            <span className="shrink-0 font-semibold tabular">
              {i.display}
              {i.sub && <span className="ml-1 text-xs font-normal text-muted-foreground">{i.sub}</span>}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-[#4a7a1e]" style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

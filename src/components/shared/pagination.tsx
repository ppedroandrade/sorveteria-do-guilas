import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label="Paginação">
      <p className="text-muted-foreground">
        {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-1">
        <Link
          aria-disabled={page <= 1}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-40")}
          href={href(page - 1)}
        >
          <ChevronLeft /> Anterior
        </Link>
        <span className="px-2 tabular text-muted-foreground">
          {page}/{pages}
        </span>
        <Link
          aria-disabled={page >= pages}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= pages && "pointer-events-none opacity-40")}
          href={href(page + 1)}
        >
          Próxima <ChevronRight />
        </Link>
      </div>
    </nav>
  );
}

export function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 10_000) : 1;
}

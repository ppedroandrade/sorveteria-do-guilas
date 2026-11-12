"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Kanban, List } from "lucide-react";
import { NativeSelect } from "@/components/ui/input";
import { SearchInput } from "@/components/shared/search-input";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";

export function OrdersToolbar({ view }: { view: "list" | "kanban" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    sp.delete("page");
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  }
  const viewHref = (v: string) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("view", v);
    sp.delete("page");
    return `${pathname}?${sp.toString()}`;
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="inline-flex shrink-0 rounded-xl bg-muted p-1" role="tablist" aria-label="Visualização">
        {(
          [
            ["kanban", "Kanban", Kanban],
            ["list", "Lista", List],
          ] as const
        ).map(([v, label, Icon]) => (
          <Link
            key={v}
            href={viewHref(v)}
            role="tab"
            aria-selected={view === v}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground",
              view === v && "bg-card text-foreground shadow-sm",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </Link>
        ))}
      </div>
      <SearchInput placeholder="Nº do pedido ou cliente…" />
      {view === "list" && (
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <NativeSelect
            aria-label="Filtrar por status"
            value={params.get("status") ?? ""}
            onChange={(e) => set("status", e.target.value)}
            className="sm:w-44"
          >
            <option value="">Todos os status</option>
            <option value="open">Em aberto (não finalizados)</option>
            {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Filtrar por pagamento"
            value={params.get("pagamento") ?? ""}
            onChange={(e) => set("pagamento", e.target.value)}
            className="sm:w-44"
          >
            <option value="">Todos os pagamentos</option>
            <option value="open">A receber</option>
            {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
    </div>
  );
}

"use client";
import * as React from "react";
import { Loader2, MapPin, Phone, Search, Sparkles, UserPlus, UserRound, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CustomerDialog } from "@/components/customers/customer-form";
import { customerQuickInfoAction, searchCustomersAction, type CustomerOption } from "@/server/actions/customers";
import { formatMoney } from "@/lib/money";
import { formatOrderNumber, formatPhone } from "@/lib/utils";
import { cn } from "@/lib/utils";

type QuickInfo = Awaited<ReturnType<typeof customerQuickInfoAction>>;

export function CustomerPicker({
  value,
  onChange,
  currency,
}: {
  value: CustomerOption | null;
  onChange: (c: CustomerOption | null) => void;
  currency: string;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<CustomerOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState(false);
  const [info, setInfo] = React.useState<QuickInfo | null>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchCustomersAction(query);
        if (!cancelled) setResults(r);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, open]);

  React.useEffect(() => {
    setInfo(null);
    if (!value) return;
    let cancelled = false;
    customerQuickInfoAction(value.id)
      .then((r) => !cancelled && setInfo(r))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [value]);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (value) {
    return (
      <div className="rounded-xl border bg-primary-soft/40 p-4 animate-fade-up">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{value.name}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {value.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {formatPhone(value.phone)}
                </span>
              )}
              {(value.address || value.neighborhood) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {[value.address, value.neighborhood, value.city].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
            {value.preferences && (
              <p className="mt-2 inline-flex items-start gap-1 text-xs text-caramel-foreground">
                <Sparkles className="mt-0.5 h-3 w-3 shrink-0" /> {value.preferences}
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X /> Trocar
          </Button>
        </div>
        {info && info.orderCount > 0 && (
          <div className="mt-3 border-t border-primary/10 pt-3">
            <p className="text-xs text-muted-foreground">
              {info.orderCount} pedido(s) · {formatMoney(info.totalCents, currency)} no total
            </p>
            <ul className="mt-1.5 space-y-1">
              {info.recent.map((o) => (
                <li key={o.id} className="truncate text-xs">
                  <span className="font-semibold">{formatOrderNumber(o.number)}</span>{" "}
                  <span className="text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString("pt-BR")} —{" "}
                    {o.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {info && info.orderCount === 0 && <p className="mt-2 text-xs text-muted-foreground">Primeiro pedido deste cliente ✨</p>}
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar cliente por nome ou telefone…"
            className="pl-9"
            aria-label="Buscar cliente"
            aria-expanded={open}
            role="combobox"
            aria-controls="customer-results"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        <Button type="button" variant="outline" onClick={() => setDialog(true)} className="shrink-0">
          <UserPlus /> <span className="hidden sm:inline">Novo</span>
        </Button>
      </div>
      <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <UserRound className="h-3 w-3" /> Sem cliente selecionado = <strong className="font-semibold">Cliente avulso</strong>
      </p>

      {open && (
        <div
          id="customer-results"
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border bg-popover p-1 shadow-lift"
        >
          {results.length === 0 && !loading && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado.
              <Button type="button" variant="link" size="sm" onClick={() => setDialog(true)}>
                Cadastrar {query ? `"${query}"` : "novo cliente"}
              </Button>
            </div>
          )}
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                onChange(c);
                setOpen(false);
                setQuery("");
              }}
              className={cn("flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none")}
            >
              <span className="text-sm font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">
                {[formatPhone(c.phone), c.neighborhood].filter(Boolean).join(" · ") || "Sem telefone"}
              </span>
            </button>
          ))}
        </div>
      )}

      <CustomerDialog
        open={dialog}
        onOpenChange={setDialog}
        compact
        defaultValues={/\d{4,}/.test(query) ? { phone: query } : { name: query }}
        onSaved={(c) => {
          onChange(c);
          setOpen(false);
          setQuery("");
        }}
      />
    </div>
  );
}

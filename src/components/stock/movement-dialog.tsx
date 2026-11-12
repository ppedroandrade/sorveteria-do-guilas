"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/shared/decimal-input";
import { useAction } from "@/components/shared/use-action";
import { formatMilli } from "@/lib/money";
import { cn } from "@/lib/utils";
import { registerMovementAction } from "@/server/actions/stock";

type Kind = "IN" | "OUT" | "ADJUSTMENT";
const KINDS: { k: Kind; label: string; icon: React.ElementType; hint: string }[] = [
  { k: "IN", label: "Entrada", icon: ArrowDownToLine, hint: "Produção ou compra que entrou no estoque." },
  { k: "OUT", label: "Saída", icon: ArrowUpFromLine, hint: "Perda, degustação, consumo interno…" },
  { k: "ADJUSTMENT", label: "Ajuste", icon: Scale, hint: "Informe o saldo contado; o sistema lança a diferença." },
];

export function MovementButton({
  product,
}: {
  product: { id: string; name: string; stockMilli: number; stockUnit: string | null; allowNegativeStock: boolean };
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<Kind>("IN");
  const [qty, setQty] = React.useState<number | null>(null);
  const [reason, setReason] = React.useState("");

  const preview =
    qty == null ? null : kind === "IN" ? product.stockMilli + qty : kind === "OUT" ? product.stockMilli - qty : qty;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (qty == null) return;
    const r = await run(() => registerMovementAction({ productId: product.id, type: kind, quantityMilli: qty, reason }));
    if (r.ok) {
      setOpen(false);
      setQty(null);
      setReason("");
      router.refresh();
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Movimentar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{product.name}</DialogTitle>
            <DialogDescription>
              Saldo atual: <strong>{formatMilli(product.stockMilli)} {product.stockUnit}</strong>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map(({ k, label, icon: Icon }) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-sm font-semibold transition",
                    kind === k ? "border-primary bg-primary-soft text-primary" : "bg-card hover:bg-accent",
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{KINDS.find((x) => x.k === kind)!.hint}</p>
            <Field label={kind === "ADJUSTMENT" ? `Saldo contado (${product.stockUnit ?? ""})` : `Quantidade (${product.stockUnit ?? ""})`} required>
              <DecimalInput value={qty} onValueChange={setQty} autoFocus placeholder="0" />
            </Field>
            <Field label="Motivo / observação">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
            </Field>
            {preview != null && (
              <p className={cn("text-sm", preview < 0 && !product.allowNegativeStock ? "text-destructive" : "text-muted-foreground")}>
                Novo saldo: <strong>{formatMilli(preview)} {product.stockUnit}</strong>
                {preview < 0 && !product.allowNegativeStock && " — não permitido para este produto"}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={pending} disabled={qty == null || (kind !== "ADJUSTMENT" && qty <= 0)}>
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

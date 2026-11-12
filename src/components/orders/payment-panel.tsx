"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus, PaymentKind, PaymentMethod } from "@prisma/client";
import { HandCoins, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { MoneyInput } from "@/components/shared/money-input";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { useAction } from "@/components/shared/use-action";
import { PAYMENT_METHOD_LABEL, PAYMENT_METHODS } from "@/lib/domain/labels";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { addPaymentAction, deletePaymentAction } from "@/server/actions/payments";

export type PaymentRow = {
  id: string;
  kind: PaymentKind;
  method: PaymentMethod;
  amountCents: number;
  paidAtLabel: string;
  notes: string | null;
};

function key() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function PaymentPanel({
  orderId,
  status,
  totalCents,
  netPaidCents,
  payments,
  preferredMethod,
  currency,
}: {
  orderId: string;
  status: OrderStatus;
  totalCents: number;
  netPaidCents: number;
  payments: PaymentRow[];
  preferredMethod: PaymentMethod | null;
  currency: string;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [dialog, setDialog] = React.useState<PaymentKind | null>(null);
  const [toDelete, setToDelete] = React.useState<PaymentRow | null>(null);
  const [amount, setAmount] = React.useState(0);
  const [method, setMethod] = React.useState<PaymentMethod>(preferredMethod ?? "PIX");
  const [paidAt, setPaidAt] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [idemKey, setIdemKey] = React.useState(key);

  const due = Math.max(0, totalCents - netPaidCents);
  const overpaid = status !== "CANCELLED" ? Math.max(0, netPaidCents - totalCents) : 0;
  const cancelledWithMoney = status === "CANCELLED" && netPaidCents > 0;

  function open(kind: PaymentKind) {
    setDialog(kind);
    setAmount(kind === "PAYMENT" ? due : Math.max(0, cancelledWithMoney ? netPaidCents : overpaid || netPaidCents));
    setPaidAt("");
    setNotes("");
    setIdemKey(key());
  }

  async function submit() {
    if (!dialog) return;
    const res = await run(() =>
      addPaymentAction({ orderId, kind: dialog, method, amountCents: amount, paidAt: paidAt || null, notes, idempotencyKey: idemKey }),
    );
    if (res.ok) {
      setDialog(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label="Total" value={formatMoney(totalCents, currency)} />
        <Metric label="Recebido" value={formatMoney(netPaidCents, currency)} tone="primary" />
        <Metric
          label={status === "CANCELLED" ? "Em aberto" : "Falta"}
          value={formatMoney(status === "CANCELLED" ? 0 : due, currency)}
          tone={due > 0 && status !== "CANCELLED" ? "alert" : undefined}
        />
      </div>

      {overpaid > 0 && (
        <p className="rounded-lg bg-caramel-soft px-3 py-2 text-xs font-medium text-caramel-foreground">
          Recebido {formatMoney(overpaid, currency)} a mais que o total (o pedido foi alterado depois do pagamento). Registre um reembolso se devolver a diferença.
        </p>
      )}
      {cancelledWithMoney && (
        <p className="rounded-lg bg-destructive-soft px-3 py-2 text-xs font-medium text-destructive">
          Pedido cancelado com {formatMoney(netPaidCents, currency)} recebidos. Registre o reembolso caso o valor tenha sido devolvido.
        </p>
      )}

      {payments.length > 0 ? (
        <ul className="divide-y rounded-xl border">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <span
                className={cn(
                  "rounded-lg p-1.5",
                  p.kind === "REFUND" ? "bg-destructive-soft text-destructive" : "bg-primary-soft text-primary",
                )}
              >
                {p.kind === "REFUND" ? <RotateCcw className="h-3.5 w-3.5" /> : <HandCoins className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {p.kind === "REFUND" ? "Reembolso · " : ""}
                  {PAYMENT_METHOD_LABEL[p.method]}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.paidAtLabel}
                  {p.notes ? ` · ${p.notes}` : ""}
                </p>
              </div>
              <span className={cn("font-semibold tabular", p.kind === "REFUND" && "text-destructive")}>
                {p.kind === "REFUND" ? "−" : ""}
                {formatMoney(p.amountCents, currency)}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="no-print text-muted-foreground hover:text-destructive"
                onClick={() => setToDelete(p)}
                aria-label="Remover lançamento"
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
      )}

      <div className="no-print flex flex-wrap gap-2">
        {status !== "CANCELLED" && due > 0 && (
          <Button onClick={() => open("PAYMENT")}>
            <Plus /> Registrar pagamento
          </Button>
        )}
        {netPaidCents > 0 && (
          <Button variant="outline" onClick={() => open("REFUND")}>
            <RotateCcw /> Registrar reembolso
          </Button>
        )}
      </div>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "REFUND" ? "Registrar reembolso" : "Registrar pagamento"}</DialogTitle>
            <DialogDescription>
              {dialog === "REFUND"
                ? `Valor já recebido: ${formatMoney(netPaidCents, currency)}.`
                : `Saldo em aberto: ${formatMoney(due, currency)}. Pagamentos parciais e em várias formas são aceitos.`}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor" htmlFor="pay-amount" required>
                <MoneyInput id="pay-amount" value={amount} onValueChange={setAmount} autoFocus />
              </Field>
              <Field label="Forma" htmlFor="pay-method">
                <NativeSelect id="pay-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABEL[m]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            {dialog === "PAYMENT" && due > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {[due, Math.round(due / 2)].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="rounded-full border bg-card px-3 py-1 text-xs font-semibold hover:bg-accent"
                    onClick={() => setAmount(v)}
                  >
                    {v === due ? "Valor total" : "Metade"} · {formatMoney(v, currency)}
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Data e hora" htmlFor="pay-at" hint="Em branco = agora">
                <Input id="pay-at" type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </Field>
              <Field label="Observação" htmlFor="pay-notes">
                <Input id="pay-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                Cancelar
              </Button>
              <Button type="submit" loading={pending} disabled={amount <= 0} variant={dialog === "REFUND" ? "destructive" : "default"}>
                Confirmar {formatMoney(amount, currency)}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmAction
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Remover este lançamento?"
        description="Use apenas para corrigir um registro feito por engano. A situação financeira do pedido será recalculada."
        confirmLabel="Remover"
        loading={pending}
        onConfirm={async () => {
          if (!toDelete) return;
          const res = await run(() => deletePaymentAction(toDelete.id));
          if (res.ok) {
            setToDelete(null);
            router.refresh();
          }
        }}
      />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "primary" | "alert" }) {
  return (
    <div className="rounded-xl bg-background/60 px-2 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold tabular sm:text-base",
          tone === "primary" && "text-primary",
          tone === "alert" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

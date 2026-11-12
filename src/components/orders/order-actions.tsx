"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { ArrowRight, Ban, Copy, Ellipsis, Pencil, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/input";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { useAction } from "@/components/shared/use-action";
import { ORDER_FLOW, ORDER_STATUS_LABEL } from "@/lib/domain/labels";
import { cancelOrderAction, changeOrderStatusAction } from "@/server/actions/orders";

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  PENDING: "Iniciar preparo",
  IN_PREPARATION: "Marcar como pronto",
  READY: "Marcar entregue/retirado",
};

export function nextStatus(s: OrderStatus): OrderStatus | null {
  const i = ORDER_FLOW.indexOf(s);
  return i >= 0 && i < ORDER_FLOW.length - 1 ? ORDER_FLOW[i + 1] : null;
}

export function OrderActions({ orderId, status, netPaidCents }: { orderId: string; status: OrderStatus; netPaidCents: number }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const next = nextStatus(status);
  const editable = status !== "CANCELLED" && status !== "DELIVERED";

  const move = (to: OrderStatus) =>
    run(() => changeOrderStatusAction({ orderId, status: to }), { onSuccess: () => router.refresh() });

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      {next && (
        <Button onClick={() => move(next)} loading={pending}>
          {NEXT_LABEL[status]} <ArrowRight />
        </Button>
      )}
      {editable && (
        <Button asChild variant="outline">
          <Link href={`/pedidos/${orderId}/editar`}>
            <Pencil /> Editar
          </Link>
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Mais ações">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status !== "CANCELLED" && (
            <>
              <DropdownMenuLabel>Mudar status</DropdownMenuLabel>
              {ORDER_FLOW.filter((s) => s !== status).map((s) => (
                <DropdownMenuItem key={s} onSelect={() => move(s)}>
                  {ORDER_FLOW.indexOf(s) < ORDER_FLOW.indexOf(status) ? <RotateCcw /> : <ArrowRight />}
                  {ORDER_STATUS_LABEL[s]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem asChild>
            <Link href={`/pedidos/novo?duplicar=${orderId}`}>
              <Copy /> Duplicar pedido
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/pedidos/${orderId}/comprovante`} target="_blank">
              <Printer /> Imprimir comprovante
            </Link>
          </DropdownMenuItem>
          {status !== "CANCELLED" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setCancelOpen(true)}>
                <Ban /> Cancelar pedido
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmAction
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar este pedido?"
        description={
          <>
            O pedido deixa de contar como venda e o estoque baixado é devolvido. Essa ação não pode ser desfeita.
            {netPaidCents > 0 && (
              <strong className="mt-2 block text-destructive">
                Há valores recebidos neste pedido. Se devolver o dinheiro ao cliente, registre o reembolso na seção Financeiro do pedido.
              </strong>
            )}
          </>
        }
        confirmLabel="Cancelar pedido"
        loading={pending}
        onConfirm={async () => {
          const res = await run(() => cancelOrderAction({ orderId, reason }));
          if (res.ok) {
            setCancelOpen(false);
            router.refresh();
          }
        }}
      >
        <Textarea placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} />
      </ConfirmAction>
    </div>
  );
}

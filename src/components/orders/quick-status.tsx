"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { ArrowRight, Copy, Ellipsis, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAction } from "@/components/shared/use-action";
import { ORDER_FLOW, ORDER_STATUS_LABEL } from "@/lib/domain/labels";
import { changeOrderStatusAction } from "@/server/actions/orders";

export function QuickStatus({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const idx = ORDER_FLOW.indexOf(status);
  const next = idx >= 0 && idx < ORDER_FLOW.length - 1 ? ORDER_FLOW[idx + 1] : null;
  return (
    <div className="flex items-center justify-end gap-1">
      {next && (
        <Button
          size="sm"
          variant="soft"
          loading={pending}
          onClick={() => run(() => changeOrderStatusAction({ orderId, status: next }), { onSuccess: () => router.refresh() })}
          title={`Mover para ${ORDER_STATUS_LABEL[next]}`}
        >
          {ORDER_STATUS_LABEL[next]} <ArrowRight />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="Ações">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/pedidos/${orderId}`}>
              <Eye /> Ver detalhes
            </Link>
          </DropdownMenuItem>
          {status !== "CANCELLED" && status !== "DELIVERED" && (
            <DropdownMenuItem asChild>
              <Link href={`/pedidos/${orderId}/editar`}>
                <Pencil /> Editar
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href={`/pedidos/novo?duplicar=${orderId}`}>
              <Copy /> Duplicar
            </Link>
          </DropdownMenuItem>
          {status !== "CANCELLED" && (
            <>
              <DropdownMenuSeparator />
              {ORDER_FLOW.filter((s) => s !== status && s !== next).map((s) => (
                <DropdownMenuItem
                  key={s}
                  onSelect={() => run(() => changeOrderStatusAction({ orderId, status: s }), { onSuccess: () => router.refresh() })}
                >
                  <ArrowRight /> {ORDER_STATUS_LABEL[s]}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

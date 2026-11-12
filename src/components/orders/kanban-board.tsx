"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { ArrowRight, CalendarClock, GripVertical, Truck } from "lucide-react";
import { PaymentStatusBadge } from "@/components/shared/status-badges";
import { useAction } from "@/components/shared/use-action";
import { changeOrderStatusAction } from "@/server/actions/orders";
import { formatMoney } from "@/lib/money";
import { formatOrderNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type KanbanOrder = {
  id: string;
  number: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customerName: string | null;
  totalCents: number;
  scheduledLabel: string | null;
  isDelivery: boolean;
  itemsSummary: string;
  overdue: boolean;
};

type Column = { status: OrderStatus; title: string; short: string; accent: string; next?: OrderStatus; nextLabel?: string };

const COLUMNS: Column[] = [
  { status: "PENDING", title: "Pendente", short: "Pendente", accent: "bg-caramel", next: "IN_PREPARATION", nextLabel: "Preparar" },
  { status: "IN_PREPARATION", title: "Em preparação", short: "Preparo", accent: "bg-sky-500", next: "READY", nextLabel: "Pronto" },
  { status: "READY", title: "Pronto", short: "Pronto", accent: "bg-violet-500", next: "DELIVERED", nextLabel: "Entregar" },
  { status: "DELIVERED", title: "Finalizado", short: "Finalizado", accent: "bg-primary" },
];

/**
 * Layout responsivo:
 * - celular (< md): abas de status + uma coluna centralizada (avanço pelos botões);
 * - tablet (md–xl): grade 2×2 com arrastar e soltar;
 * - desktop (≥ xl): as 4 colunas lado a lado.
 */
export function KanbanBoard({ orders: initial, currency }: { orders: KanbanOrder[]; currency: string }) {
  const router = useRouter();
  const { run } = useAction();
  const [orders, setOrders] = React.useState(initial);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [mobileTab, setMobileTab] = React.useState<OrderStatus>(
    () => COLUMNS.find((c) => initial.some((o) => o.status === c.status))?.status ?? "PENDING",
  );
  React.useEffect(() => setOrders(initial), [initial]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  async function move(id: string, to: OrderStatus) {
    const prev = orders;
    const order = prev.find((o) => o.id === id);
    if (!order || order.status === to) return;
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, status: to } : o))); // otimista
    const res = await run(() => changeOrderStatusAction({ orderId: id, status: to }));
    if (!res.ok) setOrders(prev);
    else router.refresh();
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (e.over) move(String(e.active.id), e.over.id as OrderStatus);
  }

  const byStatus = (s: OrderStatus) => orders.filter((o) => o.status === s);
  const active = orders.find((o) => o.id === activeId) ?? null;
  const mobileColumn = COLUMNS.find((c) => c.status === mobileTab)!;
  const mobileList = byStatus(mobileTab);

  return (
    <>
      {/* ───── Celular ───── */}
      <div className="mx-auto w-full max-w-xl md:hidden">
        <div className="sticky top-14 z-20 -mx-4 bg-background/90 px-4 pb-3 pt-1 backdrop-blur" role="tablist" aria-label="Status dos pedidos">
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1">
            {COLUMNS.map((c) => {
              const count = byStatus(c.status).length;
              const selected = c.status === mobileTab;
              return (
                <button
                  key={c.status}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setMobileTab(c.status)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-semibold text-muted-foreground transition",
                    selected && "bg-card text-foreground shadow-sm",
                  )}
                >
                  <span className="flex items-center gap-1">
                    <span className={cn("h-1.5 w-1.5 rounded-full", c.accent)} />
                    <span className="tabular text-sm">{count}</span>
                  </span>
                  <span className="truncate">{c.short}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-2.5" role="tabpanel" aria-label={mobileColumn.title}>
          {mobileList.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhum pedido em “{mobileColumn.title}”.
            </p>
          ) : (
            mobileList.map((o) => (
              <CardBody key={o.id} order={o} currency={currency}>
                <NextButton column={mobileColumn} onMove={() => move(o.id, mobileColumn.next!)} />
              </CardBody>
            ))
          )}
        </div>
      </div>

      {/* ───── Tablet e desktop ───── */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="hidden items-start gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const list = byStatus(col.status);
            return (
              <DroppableColumn key={col.status} column={col} count={list.length}>
                {list.length === 0 && (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                    Arraste pedidos para cá
                  </p>
                )}
                {list.map((o) => (
                  <DraggableCard key={o.id} order={o} currency={currency}>
                    <NextButton column={col} onMove={() => move(o.id, col.next!)} />
                  </DraggableCard>
                ))}
              </DroppableColumn>
            );
          })}
        </div>
        <DragOverlay>{active ? <CardBody order={active} currency={currency} dragging /> : null}</DragOverlay>
      </DndContext>
    </>
  );
}

function NextButton({ column, onMove }: { column: Column; onMove: () => void }) {
  if (!column.next) return null;
  return (
    <button
      type="button"
      onClick={onMove}
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-primary-soft px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground"
    >
      {column.nextLabel} <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );
}

function DroppableColumn({ column, count, children }: { column: Column; count: number; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: column.status });
  return (
    <section
      ref={setNodeRef}
      aria-label={column.title}
      className={cn(
        "flex min-w-0 flex-col rounded-2xl border bg-secondary/50 p-2.5 transition-colors",
        isOver && "border-primary bg-primary-soft/60",
      )}
    >
      <header className="mb-2.5 flex items-center gap-2 px-1.5">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", column.accent)} />
        <h2 className="truncate text-sm font-semibold">{column.title}</h2>
        <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs font-semibold tabular text-muted-foreground">{count}</span>
      </header>
      <div className="flex min-h-[96px] flex-col gap-2">{children}</div>
    </section>
  );
}

function DraggableCard({ order, currency, children }: { order: KanbanOrder; currency: string; children?: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id });
  return (
    <div ref={setNodeRef} className={cn(isDragging && "opacity-40")}>
      <CardBody order={order} currency={currency} handleProps={{ ...attributes, ...listeners }}>
        {children}
      </CardBody>
    </div>
  );
}

function CardBody({
  order,
  currency,
  dragging,
  handleProps,
  children,
}: {
  order: KanbanOrder;
  currency: string;
  dragging?: boolean;
  handleProps?: React.HTMLAttributes<HTMLButtonElement>;
  children?: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        "min-w-0 rounded-xl border bg-card p-3 shadow-soft transition",
        dragging && "rotate-1 shadow-lift",
        order.overdue && "border-destructive/40",
      )}
    >
      <div className="flex items-start gap-2">
        {handleProps && (
          <button
            type="button"
            className="-ml-1 mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
            aria-label={`Mover pedido ${formatOrderNumber(order.number)}`}
            {...handleProps}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <Link href={`/pedidos/${order.id}`} className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="text-sm font-bold">{formatOrderNumber(order.number)}</span>
            <span className="whitespace-nowrap text-sm font-semibold tabular">{formatMoney(order.totalCents, currency)}</span>
          </div>
          <p className="truncate text-sm">{order.customerName ?? "Cliente avulso"}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{order.itemsSummary}</p>
        </Link>
      </div>
      {(order.scheduledLabel || order.isDelivery) && (
        <div className={cn("mt-2 flex flex-wrap items-center gap-x-3 gap-y-1", handleProps && "pl-5")}>
          {order.scheduledLabel && (
            <span
              className={cn(
                "inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium",
                order.overdue ? "text-destructive" : "text-muted-foreground",
              )}
            >
              <CalendarClock className="h-3 w-3" /> {order.scheduledLabel}
            </span>
          )}
          {order.isDelivery && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-caramel-foreground">
              <Truck className="h-3 w-3" /> Entrega
            </span>
          )}
        </div>
      )}
      <div className={cn("mt-2 flex flex-wrap items-center justify-between gap-2", handleProps && "pl-5")}>
        <PaymentStatusBadge status={order.paymentStatus} />
        {children}
      </div>
    </article>
  );
}

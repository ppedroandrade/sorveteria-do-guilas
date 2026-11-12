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

const COLUMNS: { status: OrderStatus; title: string; accent: string; next?: OrderStatus; nextLabel?: string }[] = [
  { status: "PENDING", title: "Pendente", accent: "bg-caramel", next: "IN_PREPARATION", nextLabel: "Preparar" },
  { status: "IN_PREPARATION", title: "Em preparação", accent: "bg-sky-500", next: "READY", nextLabel: "Pronto" },
  { status: "READY", title: "Pronto", accent: "bg-violet-500", next: "DELIVERED", nextLabel: "Entregar" },
  { status: "DELIVERED", title: "Finalizado", accent: "bg-primary" },
];

export function KanbanBoard({ orders: initial, currency }: { orders: KanbanOrder[]; currency: string }) {
  const router = useRouter();
  const { run } = useAction();
  const [orders, setOrders] = React.useState(initial);
  const [activeId, setActiveId] = React.useState<string | null>(null);
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

  const active = orders.find((o) => o.id === activeId) ?? null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 scrollbar-thin sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => o.status === col.status);
          return (
            <Column key={col.status} id={col.status} title={col.title} accent={col.accent} count={list.length}>
              {list.length === 0 && (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  Arraste pedidos para cá
                </p>
              )}
              {list.map((o) => (
                <DraggableCard key={o.id} order={o} currency={currency}>
                  {col.next && (
                    <button
                      type="button"
                      onClick={() => move(o.id, col.next!)}
                      className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground"
                    >
                      {col.nextLabel} <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </DraggableCard>
              ))}
            </Column>
          );
        })}
      </div>
      <DragOverlay>{active ? <CardBody order={active} currency={currency} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({
  id,
  title,
  accent,
  count,
  children,
}: {
  id: string;
  title: string;
  accent: string;
  count: number;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={cn(
        "flex w-[78vw] max-w-[320px] shrink-0 snap-start flex-col rounded-2xl border bg-secondary/50 p-2.5 transition-colors sm:w-[300px] lg:w-auto lg:max-w-none",
        isOver && "border-primary bg-primary-soft/60",
      )}
    >
      <header className="mb-2.5 flex items-center gap-2 px-1.5">
        <span className={cn("h-2 w-2 rounded-full", accent)} />
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs font-semibold tabular text-muted-foreground">{count}</span>
      </header>
      <div className="flex min-h-[120px] flex-col gap-2">{children}</div>
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
        "rounded-xl border bg-card p-3 shadow-soft transition",
        dragging && "rotate-1 shadow-lift",
        order.overdue && "border-destructive/40",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
          aria-label={`Mover pedido ${formatOrderNumber(order.number)}`}
          {...handleProps}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Link href={`/pedidos/${order.id}`} className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold">{formatOrderNumber(order.number)}</span>
            <span className="text-sm font-semibold tabular">{formatMoney(order.totalCents, currency)}</span>
          </div>
          <p className="truncate text-sm">{order.customerName ?? "Cliente avulso"}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{order.itemsSummary}</p>
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-5">
        {order.scheduledLabel && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-medium",
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
      <div className="mt-2 flex items-center justify-between gap-2 pl-5">
        <PaymentStatusBadge status={order.paymentStatus} />
        {children}
      </div>
    </article>
  );
}

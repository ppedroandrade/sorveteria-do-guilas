import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/domain/labels";

const ORDER_VARIANT: Record<OrderStatus, BadgeVariant> = {
  PENDING: "caramel",
  IN_PREPARATION: "info",
  READY: "violet",
  DELIVERED: "default",
  CANCELLED: "muted",
};

const PAYMENT_VARIANT: Record<PaymentStatus, BadgeVariant> = {
  PENDING: "destructive",
  PARTIAL: "caramel",
  PAID: "success",
  REFUNDED: "muted",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={ORDER_VARIANT[status]}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {ORDER_STATUS_LABEL[status]}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge variant={PAYMENT_VARIANT[status]}>{PAYMENT_STATUS_LABEL[status]}</Badge>;
}

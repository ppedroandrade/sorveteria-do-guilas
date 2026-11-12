import type {
  FulfillmentType,
  InventoryMovementType,
  OrderStatus,
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
} from "@prisma/client";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pendente",
  IN_PREPARATION: "Em preparação",
  READY: "Pronto",
  DELIVERED: "Entregue/Retirado",
  CANCELLED: "Cancelado",
};

/** Ordem do fluxo operacional (cancelado fica fora do fluxo). */
export const ORDER_FLOW: OrderStatus[] = ["PENDING", "IN_PREPARATION", "READY", "DELIVERED"];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Pendente",
  PARTIAL: "Parcialmente pago",
  PAID: "Pago",
  REFUNDED: "Reembolsado",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  TRANSFER: "Transferência",
  OTHER: "Outro",
};

export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[];

export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = {
  PAYMENT: "Pagamento",
  REFUND: "Reembolso",
};

export const FULFILLMENT_LABEL: Record<FulfillmentType, string> = {
  PICKUP: "Retirada",
  DELIVERY: "Entrega",
};

export const MOVEMENT_LABEL: Record<InventoryMovementType, string> = {
  IN: "Entrada",
  OUT: "Saída manual",
  ADJUSTMENT: "Ajuste",
  SALE: "Venda",
  SALE_REVERSAL: "Estorno de venda",
};

export const STOCK_UNITS = ["litro", "kg", "pote", "unidade", "caixa"] as const;

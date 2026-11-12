import { formatMoney } from "@/lib/money";
import { formatOrderNumber, onlyDigits } from "@/lib/utils";
import { FULFILLMENT_LABEL, PAYMENT_STATUS_LABEL } from "./labels";
import type { FulfillmentType, PaymentStatus } from "@prisma/client";

export type WhatsAppOrder = {
  number: number;
  customerName: string | null;
  items: { productName: string; variantName: string; quantity: number; totalCents: number }[];
  subtotalCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  paidCents: number;
  paymentStatus: PaymentStatus;
  fulfillment: FulfillmentType;
  deliveryAddress: string | null;
  scheduledLabel: string | null; // já formatado no fuso do negócio
  notes: string | null;
};

export function buildWhatsAppMessage(order: WhatsAppOrder, opts: { businessName: string; currency?: string }): string {
  const cur = opts.currency ?? "BRL";
  const lines: string[] = [];
  const greeting = order.customerName ? `Olá, ${order.customerName.split(" ")[0]}!` : "Olá!";
  lines.push(greeting);
  lines.push(`Segue o resumo do seu pedido na *${opts.businessName}*:`);
  lines.push("");
  lines.push(`*Pedido ${formatOrderNumber(order.number)}*`);
  for (const it of order.items) {
    lines.push(`• ${it.quantity}x ${it.productName} (${it.variantName}) — ${formatMoney(it.totalCents, cur)}`);
  }
  lines.push("");
  if (order.discountCents > 0 || order.deliveryFeeCents > 0) {
    lines.push(`Subtotal: ${formatMoney(order.subtotalCents, cur)}`);
    if (order.discountCents > 0) lines.push(`Desconto: -${formatMoney(order.discountCents, cur)}`);
    if (order.deliveryFeeCents > 0) lines.push(`Taxa de entrega: ${formatMoney(order.deliveryFeeCents, cur)}`);
  }
  lines.push(`*Total: ${formatMoney(order.totalCents, cur)}*`);
  if (order.paymentStatus === "PARTIAL") {
    lines.push(`Pago: ${formatMoney(order.paidCents, cur)} · Falta: ${formatMoney(order.totalCents - order.paidCents, cur)}`);
  } else {
    lines.push(`Pagamento: ${PAYMENT_STATUS_LABEL[order.paymentStatus]}`);
  }
  lines.push("");
  lines.push(`${FULFILLMENT_LABEL[order.fulfillment]}${order.scheduledLabel ? `: ${order.scheduledLabel}` : ""}`);
  if (order.fulfillment === "DELIVERY" && order.deliveryAddress) lines.push(`Endereço: ${order.deliveryAddress}`);
  if (order.notes) lines.push(`Obs.: ${order.notes}`);
  lines.push("");
  lines.push("Obrigado pela preferência! 🍨");
  return lines.join("\n");
}

/** Link wa.me. Números brasileiros sem DDI recebem 55. */
export function whatsAppLink(phone: string | null | undefined, message: string): string {
  let digits = onlyDigits(phone);
  if (digits && (digits.length === 10 || digits.length === 11)) digits = `55${digits}`;
  const text = encodeURIComponent(message);
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

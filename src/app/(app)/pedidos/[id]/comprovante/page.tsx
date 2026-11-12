import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getOrderDetail } from "@/lib/services/orders";
import { getSettings } from "@/lib/services/settings";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatOrderNumber, formatPhone } from "@/lib/utils";
import { FULFILLMENT_LABEL, PAYMENT_KIND_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/domain/labels";
import { PrintButton } from "./print-button";

export const metadata = { title: "Comprovante" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [order, s] = await Promise.all([getOrderDetail(id), getSettings()]);
  if (!order) notFound();
  const cur = s.currency;
  return (
    <div className="mx-auto max-w-sm">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>
      <article className="rounded-xl border bg-white p-6 font-mono text-[13px] leading-relaxed text-black shadow-soft print:border-0 print:p-0 print:shadow-none">
        <header className="mb-3 text-center">
          {s.logoDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoDataUrl} alt="" className="mx-auto mb-2 h-14 w-14 rounded-lg object-cover" />
          )}
          <p className="text-base font-bold">{s.businessName}</p>
          {s.address && <p>{s.address}</p>}
          {s.phone && <p>{formatPhone(s.phone)}</p>}
          {s.receiptHeader && <p className="mt-1 whitespace-pre-line">{s.receiptHeader}</p>}
        </header>
        <hr className="my-2 border-dashed border-black/40" />
        <p className="font-bold">PEDIDO {formatOrderNumber(order.number)}</p>
        <p>Data: {formatDateTime(order.createdAt, s.timezone)}</p>
        <p>Cliente: {order.customer?.name ?? "Cliente avulso"}</p>
        {order.customer?.phone && <p>Tel.: {formatPhone(order.customer.phone)}</p>}
        <p>
          {FULFILLMENT_LABEL[order.fulfillment]}
          {order.scheduledFor ? ` — ${formatDate(order.scheduledFor, "dd/MM/yyyy HH:mm", s.timezone)}` : ""}
        </p>
        {order.deliveryAddress && <p>End.: {order.deliveryAddress}</p>}
        {order.status === "CANCELLED" && <p className="mt-1 font-bold">*** PEDIDO CANCELADO ***</p>}
        <hr className="my-2 border-dashed border-black/40" />
        <table className="w-full">
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id} className="align-top">
                <td className="pr-2">
                  {i.quantity}x {i.productName}
                  <br />
                  <span className="text-[11px]">
                    {i.variantName} @ {formatMoney(i.unitPriceCents, cur)}
                  </span>
                </td>
                <td className="whitespace-nowrap text-right">{formatMoney(i.totalCents, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr className="my-2 border-dashed border-black/40" />
        <Line label="Subtotal" value={formatMoney(order.subtotalCents, cur)} />
        {order.discountCents > 0 && <Line label="Desconto" value={`-${formatMoney(order.discountCents, cur)}`} />}
        {order.deliveryFeeCents > 0 && <Line label="Entrega" value={formatMoney(order.deliveryFeeCents, cur)} />}
        <Line label="TOTAL" value={formatMoney(order.totalCents, cur)} bold />
        {order.payments.length > 0 && (
          <>
            <hr className="my-2 border-dashed border-black/40" />
            {order.payments.map((p) => (
              <Line
                key={p.id}
                label={`${p.kind === "REFUND" ? PAYMENT_KIND_LABEL.REFUND + " " : ""}${PAYMENT_METHOD_LABEL[p.method]}`}
                value={`${p.kind === "REFUND" ? "-" : ""}${formatMoney(p.amountCents, cur)}`}
              />
            ))}
          </>
        )}
        <Line label="Situação" value={PAYMENT_STATUS_LABEL[order.paymentStatus]} />
        {order.notes && <p className="mt-2">Obs.: {order.notes}</p>}
        <hr className="my-2 border-dashed border-black/40" />
        <p className="text-center">{s.receiptFooter || "Obrigado pela preferência!"}</p>
        <p className="mt-1 text-center text-[10px]">Documento sem valor fiscal</p>
      </article>
    </div>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <p className={`flex justify-between ${bold ? "text-base font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </p>
  );
}

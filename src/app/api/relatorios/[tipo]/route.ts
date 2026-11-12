import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { prisma } from "@/lib/prisma";
import {
  customerRanking,
  inactiveCustomers,
  productRanking,
  receivedSummary,
  revenueByPresentation,
  salesSeries,
  type Granularity,
} from "@/lib/services/analytics";
import { formatDate, resolvePeriod } from "@/lib/dates";
import { csvMoney, toCsv } from "@/lib/csv";
import { formatOrderNumber } from "@/lib/utils";
import { FULFILLMENT_LABEL, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/domain/labels";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ tipo: string }> }) {
  if (!(await getCurrentSession())) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { tipo } = await params;
  const sp = req.nextUrl.searchParams;
  const settings = await getSettings();
  const tz = settings.timezone;
  const period = resolvePeriod({ period: sp.get("period"), from: sp.get("from"), to: sp.get("to") }, tz, new Date(), "30d");
  let csv: string;

  switch (tipo) {
    case "vendas": {
      const g = (["day", "week", "month"].includes(sp.get("agrupar") ?? "") ? sp.get("agrupar") : "day") as Granularity;
      const rows = await salesSeries(period.start, period.end, g, tz);
      csv = toCsv(
        ["Período", "Pedidos", "Vendido (R$)", "Recebido (R$)"],
        rows.map((r) => [r.key, r.orders, csvMoney(r.soldCents), csvMoney(r.receivedCents)]),
      );
      break;
    }
    case "produtos": {
      const rows = await productRanking(period.start, period.end, { includeZero: true });
      csv = toCsv(
        ["Sabor", "Quantidade", "Pedidos", "Receita bruta (R$)", "Ativo"],
        rows.map((r) => [r.name, r.quantity, r.orders, csvMoney(r.revenueCents), r.active ? "Sim" : "Não"]),
      );
      break;
    }
    case "tamanhos": {
      const rows = await revenueByPresentation(period.start, period.end);
      csv = toCsv(["Apresentação", "Quantidade", "Receita bruta (R$)"], rows.map((r) => [r.name, r.quantity, csvMoney(r.revenueCents)]));
      break;
    }
    case "clientes": {
      const rows = await customerRanking(period.start, period.end, 1000);
      csv = toCsv(
        ["Cliente", "Telefone", "Pedidos", "Total (R$)", "Ticket médio (R$)", "Última compra"],
        rows.map((r) => [r.name, r.phone, r.orders, csvMoney(r.totalCents), csvMoney(r.averageTicketCents), formatDate(r.lastOrderAt, "dd/MM/yyyy", tz)]),
      );
      break;
    }
    case "inativos": {
      const days = Math.min(365, Math.max(7, Number(sp.get("dias")) || 30));
      const rows = await inactiveCustomers(days, 1000);
      csv = toCsv(
        ["Cliente", "Telefone", "Pedidos", "Total (R$)", "Última compra"],
        rows.map((r) => [r.name, r.phone, r.orders, csvMoney(r.totalCents), formatDate(r.lastOrderAt, "dd/MM/yyyy", tz)]),
      );
      break;
    }
    case "pagamentos": {
      const s = await receivedSummary(period.start, period.end);
      csv = toCsv(
        ["Forma de pagamento", "Lançamentos", "Recebido (R$)", "Reembolsado (R$)", "Líquido (R$)"],
        s.byMethod.map((m) => [PAYMENT_METHOD_LABEL[m.method], m.count, csvMoney(m.receivedCents), csvMoney(m.refundedCents), csvMoney(m.netCents)]),
      );
      break;
    }
    case "pedidos": {
      const orders = await prisma.order.findMany({
        where: { createdAt: { gte: period.start, lt: period.end } },
        orderBy: { createdAt: "asc" },
        include: { customer: { select: { name: true } }, items: true },
        take: 20000,
      });
      csv = toCsv(
        ["Nº", "Data", "Cliente", "Itens", "Subtotal", "Desconto", "Entrega", "Total", "Recebido", "Status", "Pagamento", "Modalidade"],
        orders.map((o) => [
          formatOrderNumber(o.number),
          formatDate(o.createdAt, "dd/MM/yyyy HH:mm", tz),
          o.customer?.name ?? "Cliente avulso",
          o.items.map((i) => `${i.quantity}x ${i.productName} (${i.variantName})`).join(", "),
          csvMoney(o.subtotalCents),
          csvMoney(o.discountCents),
          csvMoney(o.deliveryFeeCents),
          csvMoney(o.totalCents),
          csvMoney(o.paidCents),
          ORDER_STATUS_LABEL[o.status],
          PAYMENT_STATUS_LABEL[o.paymentStatus],
          FULFILLMENT_LABEL[o.fulfillment],
        ]),
      );
      break;
    }
    default:
      return NextResponse.json({ error: "Relatório desconhecido" }, { status: 404 });
  }

  const filename = `${tipo}_${period.from}_a_${period.to}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

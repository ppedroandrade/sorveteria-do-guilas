import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { onlyDigits } from "@/lib/utils";
import type { z } from "zod";
import type { customerSchema } from "@/lib/validation";

type CustomerParsed = z.output<typeof customerSchema>;

export async function saveCustomer(id: string | null, input: CustomerParsed) {
  const data = { ...input, phoneDigits: onlyDigits(input.phone) || null };
  if (data.phoneDigits) {
    const dup = await prisma.customer.findFirst({
      where: { phoneDigits: data.phoneDigits, deletedAt: null, ...(id ? { id: { not: id } } : {}) },
      select: { name: true },
    });
    if (dup) {
      throw new DomainError(`Este telefone já pertence a "${dup.name}".`, { phone: "Telefone já cadastrado." });
    }
  }
  if (!id) return prisma.customer.create({ data });
  return prisma.customer.update({ where: { id }, data });
}

export function customerSearchWhere(q: string | null | undefined) {
  const term = (q ?? "").trim();
  const digits = onlyDigits(term);
  return {
    deletedAt: null,
    ...(term
      ? {
          OR: [
            { name: { contains: term, mode: "insensitive" as const } },
            ...(digits.length >= 3 ? [{ phoneDigits: { contains: digits } }] : []),
          ],
        }
      : {}),
  };
}

export async function searchCustomers(q: string, take = 8) {
  return prisma.customer.findMany({
    where: customerSearchWhere(q),
    orderBy: { name: "asc" },
    take,
    select: { id: true, name: true, phone: true, address: true, neighborhood: true, city: true, preferences: true },
  });
}

/** Indicadores do cliente — apenas pedidos válidos (não cancelados). */
export async function getCustomerStats(customerId: string) {
  const agg = await prisma.order.aggregate({
    where: { customerId, status: { not: "CANCELLED" } },
    _sum: { totalCents: true, paidCents: true },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const total = agg._sum.totalCents ?? 0;
  const count = agg._count._all;
  const openAgg = await prisma.order.findMany({
    where: { customerId, status: { not: "CANCELLED" }, paymentStatus: { in: ["PENDING", "PARTIAL"] } },
    select: { totalCents: true, paidCents: true },
  });
  return {
    totalSpentCents: total,
    orderCount: count,
    lastOrderAt: agg._max.createdAt,
    averageTicketCents: count ? Math.round(total / count) : 0,
    openBalanceCents: openAgg.reduce((s, o) => s + Math.max(0, o.totalCents - o.paidCents), 0),
  };
}

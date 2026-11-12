"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserForAction } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import { customerSchema } from "@/lib/validation";
import { saveCustomer, searchCustomers } from "@/lib/services/customers";

export type CustomerOption = Awaited<ReturnType<typeof searchCustomers>>[number];

export async function saveCustomerAction(id: string | null, input: unknown): Promise<ActionResult<CustomerOption>> {
  try {
    await requireUserForAction();
    const data = customerSchema.parse(input);
    const c = await saveCustomer(id, data);
    revalidatePath("/clientes");
    if (id) revalidatePath(`/clientes/${id}`);
    return {
      ok: true,
      data: { id: c.id, name: c.name, phone: c.phone, address: c.address, neighborhood: c.neighborhood, city: c.city, preferences: c.preferences },
      message: id ? "Cliente atualizado." : "Cliente cadastrado.",
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function searchCustomersAction(q: unknown): Promise<CustomerOption[]> {
  await requireUserForAction();
  const term = z.string().max(100).catch("").parse(q);
  return searchCustomers(term);
}

/** Resumo exibido ao selecionar o cliente no pedido. */
export async function customerQuickInfoAction(id: unknown) {
  await requireUserForAction();
  const customerId = z.string().min(1).parse(id);
  const [orders, agg] = await Promise.all([
    prisma.order.findMany({
      where: { customerId, status: { not: "CANCELLED" } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        number: true,
        createdAt: true,
        totalCents: true,
        items: { select: { productName: true, variantName: true, quantity: true } },
      },
    }),
    prisma.order.aggregate({
      where: { customerId, status: { not: "CANCELLED" } },
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
  ]);
  return {
    recent: orders.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })),
    orderCount: agg._count._all,
    totalCents: agg._sum.totalCents ?? 0,
  };
}

export async function archiveCustomerAction(id: unknown): Promise<ActionResult> {
  try {
    await requireUserForAction();
    const customerId = z.string().min(1).parse(id);
    await prisma.customer.update({ where: { id: customerId }, data: { deletedAt: new Date() } });
    revalidatePath("/clientes");
    return { ok: true, data: undefined, message: "Cliente arquivado. O histórico de pedidos foi mantido." };
  } catch (e) {
    return toActionError(e);
  }
}

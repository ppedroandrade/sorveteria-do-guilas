"use server";
import { revalidatePath } from "next/cache";
import { requireUserForAction } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import { cancelOrderSchema, orderSchema, statusChangeSchema } from "@/lib/validation";
import { cancelOrder, changeOrderStatus, createOrder, updateOrder } from "@/lib/services/orders";
import { getSettings } from "@/lib/services/settings";
import { ORDER_STATUS_LABEL } from "@/lib/domain/labels";

function revalidateOrders(id?: string) {
  revalidatePath("/", "layout");
  if (id) revalidatePath(`/pedidos/${id}`);
}

export async function createOrderAction(input: unknown): Promise<ActionResult<{ id: string; number: number }>> {
  try {
    await requireUserForAction();
    const data = orderSchema.parse(input);
    const settings = await getSettings();
    const { order, duplicated } = await createOrder(data, settings.timezone);
    revalidateOrders(order.id);
    return {
      ok: true,
      data: { id: order.id, number: order.number },
      message: duplicated ? "Este pedido já havia sido registrado." : "Pedido criado!",
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateOrderAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireUserForAction();
    const data = orderSchema.parse(input);
    const settings = await getSettings();
    await updateOrder(id, data, settings.timezone);
    revalidateOrders(id);
    return { ok: true, data: { id }, message: "Pedido atualizado." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function changeOrderStatusAction(input: unknown): Promise<ActionResult> {
  try {
    await requireUserForAction();
    const { orderId, status } = statusChangeSchema.parse(input);
    await changeOrderStatus(orderId, status);
    revalidateOrders(orderId);
    return { ok: true, data: undefined, message: `Status: ${ORDER_STATUS_LABEL[status]}` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function cancelOrderAction(input: unknown): Promise<ActionResult> {
  try {
    await requireUserForAction();
    const { orderId, reason } = cancelOrderSchema.parse(input);
    await cancelOrder(orderId, reason);
    revalidateOrders(orderId);
    return { ok: true, data: undefined, message: "Pedido cancelado." };
  } catch (e) {
    return toActionError(e);
  }
}

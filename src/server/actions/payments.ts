"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserForAction } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import { paymentSchema } from "@/lib/validation";
import { addPayment, deletePayment } from "@/lib/services/payments";
import { getSettings } from "@/lib/services/settings";

export async function addPaymentAction(input: unknown): Promise<ActionResult> {
  try {
    await requireUserForAction();
    const data = paymentSchema.parse(input);
    const settings = await getSettings();
    const { duplicated } = await addPayment(data, settings.timezone);
    revalidatePath("/", "layout");
    return {
      ok: true,
      data: undefined,
      message: duplicated ? "Este lançamento já havia sido registrado." : data.kind === "REFUND" ? "Reembolso registrado." : "Pagamento registrado.",
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deletePaymentAction(paymentId: unknown): Promise<ActionResult> {
  try {
    await requireUserForAction();
    await deletePayment(z.string().min(1).parse(paymentId));
    revalidatePath("/", "layout");
    return { ok: true, data: undefined, message: "Lançamento removido." };
  } catch (e) {
    return toActionError(e);
  }
}

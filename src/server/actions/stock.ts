"use server";
import { revalidatePath } from "next/cache";
import { requireUserForAction } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import { movementSchema } from "@/lib/validation";
import { registerManualMovement } from "@/lib/services/stock";

export async function registerMovementAction(input: unknown): Promise<ActionResult> {
  try {
    await requireUserForAction();
    const data = movementSchema.parse(input);
    await registerManualMovement(data);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined, message: "Movimentação registrada." };
  } catch (e) {
    return toActionError(e);
  }
}

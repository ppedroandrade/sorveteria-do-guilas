"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserForAction } from "@/lib/auth/session";
import { DomainError, toActionError, type ActionResult } from "@/lib/errors";
import { settingsSchema } from "@/lib/validation";

export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  try {
    await requireUserForAction();
    const data = settingsSchema.parse(input);
    try {
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: data.currency });
    } catch {
      throw new DomainError("Moeda não reconhecida.", { currency: "Código de moeda inválido." });
    }
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: data.timezone });
    } catch {
      throw new DomainError("Fuso horário inválido.", { timezone: "Use um fuso IANA, ex.: America/Sao_Paulo." });
    }
    await prisma.businessSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
    revalidatePath("/", "layout");
    return { ok: true, data: undefined, message: "Configurações salvas." };
  } catch (e) {
    return toActionError(e);
  }
}

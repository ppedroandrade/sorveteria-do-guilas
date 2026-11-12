"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserForAction } from "@/lib/auth/session";
import { DomainError, toActionError, type ActionResult } from "@/lib/errors";
import { categorySchema, presentationSchema, productSchema } from "@/lib/validation";
import { saveProduct } from "@/lib/services/products";

function revalidateCatalog() {
  revalidatePath("/", "layout");
}

export async function saveProductAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireUserForAction();
    const data = productSchema.parse(input);
    const p = await saveProduct(id, data);
    revalidateCatalog();
    return { ok: true, data: { id: p.id }, message: id ? "Produto atualizado." : "Produto cadastrado." };
  } catch (e) {
    return toActionError(e);
  }
}

const toggleSchema = z.object({ id: z.string().min(1), field: z.enum(["isAvailable", "active"]), value: z.boolean() });

/** Disponibilidade (venda agora) e ativação (soft delete) do produto. */
export async function toggleProductAction(input: unknown): Promise<ActionResult> {
  try {
    await requireUserForAction();
    const { id, field, value } = toggleSchema.parse(input);
    await prisma.product.update({ where: { id }, data: { [field]: value } });
    revalidateCatalog();
    const msg =
      field === "active" ? (value ? "Produto reativado." : "Produto desativado.") : value ? "Disponível para venda." : "Marcado como indisponível.";
    return { ok: true, data: undefined, message: msg };
  } catch (e) {
    return toActionError(e);
  }
}

export async function savePresentationAction(input: unknown): Promise<ActionResult> {
  try {
    await requireUserForAction();
    const { id, ...data } = presentationSchema.parse(input);
    if (id) await prisma.presentation.update({ where: { id }, data });
    else await prisma.presentation.create({ data });
    revalidateCatalog();
    return { ok: true, data: undefined, message: "Apresentação salva." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveCategoryAction(input: unknown): Promise<ActionResult> {
  try {
    await requireUserForAction();
    const { id, ...data } = categorySchema.parse(input);
    if (id) await prisma.category.update({ where: { id }, data });
    else await prisma.category.create({ data });
    revalidateCatalog();
    return { ok: true, data: undefined, message: "Categoria salva." };
  } catch (e) {
    return toActionError(e);
  }
}

const renameAllSchema = z.object({ presentationId: z.string().min(1) });

/** Remove nomes próprios de variantes, voltando todas a usar o nome global da apresentação. */
export async function resetVariantNamesAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  try {
    await requireUserForAction();
    const { presentationId } = renameAllSchema.parse(input);
    const exists = await prisma.presentation.findUnique({ where: { id: presentationId } });
    if (!exists) throw new DomainError("Apresentação não encontrada.");
    const r = await prisma.productVariant.updateMany({ where: { presentationId }, data: { customName: null } });
    revalidateCatalog();
    return { ok: true, data: { count: r.count }, message: `${r.count} produto(s) passaram a usar o nome global.` };
  } catch (e) {
    return toActionError(e);
  }
}

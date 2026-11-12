import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

/** Erro de regra de negócio — a mensagem é segura para mostrar ao usuário. */
export class DomainError extends Error {
  constructor(message: string, public fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "DomainError";
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function zodFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Converte qualquer erro em resposta amigável sem vazar detalhes internos. */
export function toActionError(err: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (err instanceof DomainError) return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
  if (err instanceof ZodError) {
    const fieldErrors = zodFieldErrors(err);
    return { ok: false, error: err.issues[0]?.message ?? "Dados inválidos.", fieldErrors };
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return { ok: false, error: "Já existe um registro com esses dados." };
    if (err.code === "P2025") return { ok: false, error: "Registro não encontrado." };
  }
  if (err && typeof err === "object" && "name" in err && (err as Error).name.endsWith("RuleError")) {
    return { ok: false, error: (err as Error).message };
  }
  if (err instanceof Error && err.name === "OrderCalcError") return { ok: false, error: err.message };
  console.error("[erro inesperado]", err);
  return { ok: false, error: "Não foi possível concluir a operação. Tente novamente." };
}

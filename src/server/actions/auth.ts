"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { endSession, requireUserForAction, startSession } from "@/lib/auth/session";
import { loginSchema, passwordChangeSchema } from "@/lib/validation";
import { toActionError, type ActionResult } from "@/lib/errors";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
// hash fictício para manter o tempo de resposta parecido quando o usuário não existe
const DUMMY_HASH = "$2b$12$zwlTVE34VETCyDJjvDKAB.Wdiz6zE1gUE5kFNyApvYbcT.mMhMO9q";

function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

export async function loginAction(_prev: unknown, formData: FormData): Promise<{ error?: string; login?: string }> {
  const rawLogin = String(formData.get("login") ?? "").slice(0, 200);
  const parsed = loginSchema.safeParse({ login: rawLogin, password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", login: rawLogin };
  const { login, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { login } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const min = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Muitas tentativas. Tente novamente em ${min} min.`, login: rawLogin };
  }
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    if (user) {
      const failed = user.failedLoginCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed >= MAX_ATTEMPTS ? 0 : failed,
          lockedUntil: failed >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
        },
      });
    }
    return { error: "Usuário ou senha incorretos.", login: rawLogin };
  }
  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  // limpeza oportunista de sessões vencidas
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await startSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  try {
    const me = await requireUserForAction();
    const data = passwordChangeSchema.parse(input);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await verifyPassword(data.currentPassword, user.passwordHash))) {
      return { ok: false, error: "Senha atual incorreta.", fieldErrors: { currentPassword: "Senha atual incorreta." } };
    }
    await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(data.newPassword) } });
    return { ok: true, data: undefined, message: "Senha alterada." };
  } catch (e) {
    return toActionError(e);
  }
}

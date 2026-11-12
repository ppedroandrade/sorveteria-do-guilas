import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { SESSION_TTL_DAYS } from "./constants";

const DAY = 24 * 60 * 60 * 1000;

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * DAY);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export type SessionUser = { id: string; name: string; email: string };

/**
 * Valida o token do cookie. Sessões expiradas são removidas; sessões ativas são
 * renovadas automaticamente quando passam da metade da validade.
 */
export async function validateSessionToken(
  token: string | null | undefined,
): Promise<{ user: SessionUser; sessionId: string; expiresAt: Date } | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const id = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id } }).catch(() => undefined);
    return null;
  }
  let expiresAt = session.expiresAt;
  if (expiresAt.getTime() - Date.now() < (SESSION_TTL_DAYS / 2) * DAY) {
    expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * DAY);
    await prisma.session.update({ where: { id }, data: { expiresAt } });
  }
  return { user: session.user, sessionId: id, expiresAt };
}

export async function invalidateSession(sessionId: string) {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

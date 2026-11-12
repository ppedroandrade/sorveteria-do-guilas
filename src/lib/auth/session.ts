import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "./constants";
import { DomainError } from "@/lib/errors";
import { createSession, invalidateSession, validateSessionToken, type SessionUser } from "./session-core";

export async function startSession(userId: string) {
  const { token, expiresAt } = await createSession(userId);
  const jar = await cookies();
  // "none" permite usar o sistema embutido em iframe (Hugging Face Spaces). Nesse caso o
  // cookie precisa ser Secure e é "particionado" (CHIPS) para não depender de cookies de terceiros.
  const crossSite = process.env.SESSION_COOKIE_SAMESITE === "none";
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: crossSite || (process.env.NODE_ENV === "production" && process.env.SESSION_COOKIE_SECURE !== "false"),
    sameSite: crossSite ? "none" : "lax",
    partitioned: crossSite || undefined,
    path: "/",
    expires: expiresAt,
  });
}

export const getCurrentSession = cache(async () => {
  const jar = await cookies();
  return validateSessionToken(jar.get(SESSION_COOKIE)?.value);
});

/** Para páginas: redireciona ao login se não houver sessão válida. */
export async function requireUser(): Promise<SessionUser> {
  const s = await getCurrentSession();
  if (!s) redirect("/login");
  return s.user;
}

/** Para server actions e rotas de API: lança erro em vez de redirecionar. */
export async function requireUserForAction(): Promise<SessionUser> {
  const s = await getCurrentSession();
  if (!s) throw new DomainError("Sua sessão expirou. Entre novamente.");
  return s.user;
}

export async function endSession() {
  const s = await getCurrentSession();
  if (s) await invalidateSession(s.sessionId);
  const jar = await cookies();
  const crossSite = process.env.SESSION_COOKIE_SAMESITE === "none";
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: crossSite || process.env.NODE_ENV === "production",
    sameSite: crossSite ? "none" : "lax",
    partitioned: crossSite || undefined,
    path: "/",
    maxAge: 0,
  });
}

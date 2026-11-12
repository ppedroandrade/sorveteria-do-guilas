import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createSession, hashToken, validateSessionToken } from "@/lib/auth/session-core";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hasTestDb, resetDb } from "../helpers";

const d = hasTestDb ? describe : describe.skip;

d("autenticação e sessões", () => {
  let userId: string;
  beforeEach(async () => {
    await resetDb();
    const u = await prisma.user.create({ data: { email: "dono@teste.com", name: "Dono", passwordHash: await hashPassword("senha-forte-1") } });
    userId = u.id;
  });

  it("senha é armazenada com hash e verificada corretamente", async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(u.passwordHash).not.toContain("senha-forte-1");
    expect(await verifyPassword("senha-forte-1", u.passwordHash)).toBe(true);
    expect(await verifyPassword("errada", u.passwordHash)).toBe(false);
  });

  it("sessão válida identifica o usuário; o banco guarda só o hash do token", async () => {
    const { token } = await createSession(userId);
    const s = await validateSessionToken(token);
    expect(s?.user.email).toBe("dono@teste.com");
    expect(await prisma.session.findUnique({ where: { id: token } })).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: hashToken(token) } })).not.toBeNull();
  });

  it("nega acesso sem token, com token inválido ou expirado", async () => {
    expect(await validateSessionToken(undefined)).toBeNull();
    expect(await validateSessionToken("x".repeat(43))).toBeNull();
    const { token } = await createSession(userId);
    await prisma.session.update({ where: { id: hashToken(token) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await validateSessionToken(token)).toBeNull();
    expect(await prisma.session.count()).toBe(0); // expirada é removida
  });
});

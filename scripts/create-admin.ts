/**
 * Cria ou redefine a senha da conta do proprietário.
 *   npm run create-admin -- --email dono@exemplo.com --name "Fulano"
 * A senha é pedida no terminal (não fica no histórico do shell).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  const email = (arg("email") ?? (await rl.question("E-mail: "))).trim().toLowerCase();
  const name = (arg("name") ?? "Proprietário").trim();
  const password = process.env.NEW_ADMIN_PASSWORD ?? (await rl.question("Senha (mín. 8 caracteres): "));
  rl.close();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("E-mail inválido.");
  if (password.length < 8) throw new Error("A senha precisa de pelo menos 8 caracteres.");

  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    create: { email, name, passwordHash },
  });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  console.log(`✔ Conta pronta: ${email}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

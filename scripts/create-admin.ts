/**
 * Cria ou redefine a senha da conta do proprietário.
 *   npm run create-admin -- --login guilas --name "Guilas"
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
  const login = (arg("login") ?? arg("email") ?? (await rl.question("Usuário: "))).trim().toLowerCase();
  const name = (arg("name") ?? login).trim();
  const password = process.env.NEW_ADMIN_PASSWORD ?? (await rl.question("Senha (mín. 8 caracteres): "));
  rl.close();
  if (!/^[^\s]{3,120}$/.test(login)) throw new Error("Usuário inválido (mín. 3 caracteres, sem espaços).");
  if (password.length < 8) throw new Error("A senha precisa de pelo menos 8 caracteres.");

  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { login },
    update: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    create: { login, name, passwordHash },
  });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  console.log(`✔ Conta pronta: ${login}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

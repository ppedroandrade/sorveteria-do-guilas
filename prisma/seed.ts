import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATEGORIES, FLAVORS, PRESENTATIONS } from "./catalog";

const prisma = new PrismaClient();

/**
 * Seed idempotente: pode rodar várias vezes sem duplicar nada e sem sobrescrever
 * preços ou nomes que o proprietário já tenha alterado.
 */
async function main() {
  await prisma.businessSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const presentationIds: Record<string, string> = {};
  for (const p of PRESENTATIONS) {
    const existing = await prisma.presentation.findFirst({ where: { sortOrder: p.sortOrder } });
    presentationIds[p.key] =
      existing?.id ?? (await prisma.presentation.create({ data: { name: p.name, sortOrder: p.sortOrder } })).id;
  }

  const categoryIds: Record<string, string> = {};
  for (const c of CATEGORIES) {
    const cat = await prisma.category.upsert({ where: { name: c.name }, update: {}, create: c });
    categoryIds[c.name] = cat.id;
  }

  let created = 0;
  for (const f of FLAVORS) {
    const exists = await prisma.product.findFirst({ where: { name: f.name } });
    if (exists) continue;
    await prisma.product.create({
      data: {
        name: f.name,
        isVegan: f.vegan,
        categoryId: categoryIds[f.category],
        variants: {
          create: [
            { presentationId: presentationIds.t1, priceCents: f.price1, sortOrder: 0 },
            { presentationId: presentationIds.t2, priceCents: f.price2, sortOrder: 1 },
          ],
        },
      },
    });
    created++;
  }
  console.log(`✔ Catálogo: ${created} sabores criados (${FLAVORS.length - created} já existiam).`);

  // ADMIN_LOGIN (usuário) — ADMIN_EMAIL é aceito por compatibilidade.
  const login = (process.env.ADMIN_LOGIN ?? process.env.ADMIN_EMAIL)?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!login || !password) {
    console.warn("⚠ ADMIN_LOGIN/ADMIN_PASSWORD não definidos — nenhuma conta criada. Use `npm run create-admin`.");
  } else if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD deve ter pelo menos 8 caracteres.");
  } else {
    const user = await prisma.user.findUnique({ where: { login } });
    if (!user) {
      await prisma.user.create({
        data: {
          login,
          name: process.env.ADMIN_NAME?.trim() || process.env.ADMIN_LOGIN?.trim() || "Proprietário",
          passwordHash: await bcrypt.hash(password, 12),
        },
      });
      console.log(`✔ Conta do proprietário criada: ${login}`);
    } else {
      console.log(`✔ Conta ${login} já existe (senha mantida).`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

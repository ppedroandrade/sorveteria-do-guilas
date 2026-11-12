import { execSync } from "node:child_process";
import { loadTestEnv } from "./env";

export default function setup() {
  if (!loadTestEnv()) {
    console.warn("\n⚠ TEST_DATABASE_URL não definido — testes de integração serão ignorados.\n");
    return;
  }
  // Aplica as migrations pendentes no banco de testes (não destrutivo).
  // Cada suíte limpa as tabelas do banco de TESTES com TRUNCATE (tests/helpers.ts).
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
}

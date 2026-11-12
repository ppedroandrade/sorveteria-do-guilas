import { existsSync } from "node:fs";

/** Carrega .env (se existir) e aponta DATABASE_URL para o banco de TESTES. */
export function loadTestEnv() {
  if (existsSync(".env")) {
    try {
      process.loadEnvFile(".env");
    } catch {
      /* ignora */
    }
  }
  const test = process.env.TEST_DATABASE_URL;
  if (test) {
    if (test === process.env.DATABASE_URL && !process.env.__TEST_DB_APPLIED) {
      throw new Error("TEST_DATABASE_URL não pode ser igual a DATABASE_URL — os testes apagam o banco.");
    }
    process.env.DATABASE_URL = test;
    process.env.DIRECT_URL = test;
    process.env.__TEST_DB_APPLIED = "1";
  }
  return Boolean(test);
}

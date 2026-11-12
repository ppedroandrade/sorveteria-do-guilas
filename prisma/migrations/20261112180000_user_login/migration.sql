-- Login por nome de usuário (ex.: "guilas") em vez de e-mail obrigatório.
-- Renomeia a coluna preservando os dados existentes.
ALTER TABLE "User" RENAME COLUMN "email" TO "login";
ALTER INDEX "User_email_key" RENAME TO "User_login_key";
UPDATE "User" SET "login" = lower("login");

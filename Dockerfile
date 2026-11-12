# ─────────────────────────────────────────────────────────────────────────────
# Gestão da Gelateria — imagem única (Next.js + PostgreSQL embutido)
# Pronta para Hugging Face Spaces (SDK "docker", porta 7860, usuário UID 1000).
#
# Banco de dados:
#  • Se DATABASE_URL for definido (ex.: secret no HF apontando para Neon/Supabase),
#    o PostgreSQL embutido NÃO é iniciado — recomendado para dados permanentes.
#  • Sem DATABASE_URL, sobe um PostgreSQL local dentro do contêiner, com dados em
#    /data/pgdata (armazenamento persistente do HF) ou, se /data não existir,
#    em /home/ubuntu/pgdata (PERDIDO quando o contêiner reinicia).
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-bookworm-slim AS node

FROM ubuntu:24.04 AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    DEBIAN_FRONTEND=noninteractive
# Node.js 22 (binários oficiais) + PostgreSQL 16 do repositório do Ubuntu
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
 && apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates openssl tini postgresql-common \
 && sed -i 's/^#\?\s*create_main_cluster.*/create_main_cluster = false/' /etc/postgresql-common/createcluster.conf \
 && apt-get install -y --no-install-recommends postgresql \
 && rm -rf /var/lib/apt/lists/* \
 && node --version && npm --version

# ── build ────────────────────────────────────────────────────────────────────
FROM base AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund
COPY . .
# Permite exibir o app dentro da página do Hugging Face (iframe).
ENV ALLOW_HF_IFRAME=1
RUN npx prisma generate && npx next build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=7860 \
    HOSTNAME=0.0.0.0 \
    HOME=/home/ubuntu \
    SESSION_COOKIE_SAMESITE=none
WORKDIR /app
COPY --from=build --chown=ubuntu:ubuntu /app/package.json /app/package-lock.json /app/next.config.ts /app/tsconfig.json ./
COPY --from=build --chown=ubuntu:ubuntu /app/node_modules ./node_modules
COPY --from=build --chown=ubuntu:ubuntu /app/.next ./.next
COPY --from=build --chown=ubuntu:ubuntu /app/prisma ./prisma
COPY --from=build --chown=ubuntu:ubuntu /app/scripts ./scripts
COPY --chown=ubuntu:ubuntu docker/entrypoint.sh /app/docker/entrypoint.sh
RUN chmod +x /app/docker/entrypoint.sh && mkdir -p /data && chown ubuntu:ubuntu /data

# Hugging Face executa o contêiner com UID 1000 (usuário "ubuntu" desta imagem).
USER ubuntu
EXPOSE 7860
ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker/entrypoint.sh"]

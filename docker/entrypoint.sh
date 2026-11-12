#!/usr/bin/env bash
# Inicializa o banco (embutido ou externo), aplica migrations, roda o seed e sobe o app.
set -euo pipefail

export PORT="${PORT:-7860}"
export ADMIN_LOGIN="${ADMIN_LOGIN:-Guilas}"
export ADMIN_NAME="${ADMIN_NAME:-Guilas}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-Senha123}"

PGDATA_DIR=""

stop_all() {
  local code="${1:-0}"
  echo "▸ Encerrando…"
  [[ -n "${APP_PID:-}" ]] && kill -TERM "$APP_PID" 2>/dev/null || true
  [[ -n "${APP_PID:-}" ]] && wait "$APP_PID" 2>/dev/null || true
  if [[ -n "$PGDATA_DIR" ]]; then
    "$PG_BIN/pg_ctl" -D "$PGDATA_DIR" -m fast -w stop >/dev/null 2>&1 || true
  fi
  exit "$code"
}
trap stop_all TERM INT

if [[ -z "${DATABASE_URL:-}" ]]; then
  PG_BIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
  if mountpoint -q /data 2>/dev/null && [[ -w /data ]]; then
    PGDATA_DIR="/data/pgdata"
    echo "▸ PostgreSQL embutido com armazenamento persistente em /data."
  else
    PGDATA_DIR="${HOME}/pgdata"
    echo "⚠ PostgreSQL embutido SEM armazenamento persistente (${PGDATA_DIR})."
    echo "⚠ Os dados serão perdidos quando o contêiner reiniciar. Ative o Persistent Storage"
    echo "⚠ do Space (montado em /data) ou defina o secret DATABASE_URL (ex.: Neon/Supabase)."
  fi

  if [[ ! -s "$PGDATA_DIR/PG_VERSION" ]]; then
    echo "▸ Criando cluster PostgreSQL em $PGDATA_DIR…"
    mkdir -p "$PGDATA_DIR"
    chmod 700 "$PGDATA_DIR"
    PWFILE="$(mktemp)"
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$PWFILE"
    "$PG_BIN/initdb" -D "$PGDATA_DIR" -U gelateria --pwfile="$PWFILE" --auth=scram-sha-256 \
      --encoding=UTF8 --locale=C.UTF-8 >/dev/null
    # a senha gerada fica apenas dentro do diretório de dados (permissão 600)
    mv "$PWFILE" "$PGDATA_DIR/.app_password"
    chmod 600 "$PGDATA_DIR/.app_password"
  fi
  rm -f "$PGDATA_DIR/postmaster.pid" 2>/dev/null || true

  PG_PORT="${EMBEDDED_PG_PORT:-5432}"
  PG_LOG="$(dirname "$PGDATA_DIR")/postgres.log"
  if ! "$PG_BIN/pg_ctl" -D "$PGDATA_DIR" -w -t 60 -l "$PG_LOG" \
    -o "-c listen_addresses=127.0.0.1 -p ${PG_PORT} -k /tmp -c max_connections=40 -c shared_buffers=64MB" start >/dev/null; then
    echo "✖ Falha ao iniciar o PostgreSQL embutido:"; tail -n 20 "$PG_LOG" || true; exit 1
  fi
  echo "▸ PostgreSQL embutido iniciado (porta interna ${PG_PORT})."

  DB_PASS="$(cat "$PGDATA_DIR/.app_password")"
  if ! PGPASSWORD="$DB_PASS" "$PG_BIN/psql" -h 127.0.0.1 -p "$PG_PORT" -U gelateria -d postgres -tAc \
       "SELECT 1 FROM pg_database WHERE datname='gelateria'" | grep -q 1; then
    PGPASSWORD="$DB_PASS" "$PG_BIN/createdb" -h 127.0.0.1 -p "$PG_PORT" -U gelateria gelateria
  fi
  export DATABASE_URL="postgresql://gelateria:${DB_PASS}@127.0.0.1:${PG_PORT}/gelateria?schema=public"
else
  echo "▸ Usando banco externo definido em DATABASE_URL."
fi
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

cd /app
export PATH="/app/node_modules/.bin:$PATH"
echo "▸ Aplicando migrations…"
prisma migrate deploy
echo "▸ Seed (catálogo inicial e conta do proprietário)…"
prisma db seed

if [[ "$ADMIN_PASSWORD" == "Senha123" ]]; then
  echo "⚠ Usando a senha padrão do proprietário. Defina o secret ADMIN_PASSWORD (antes do"
  echo "⚠ primeiro start) ou troque a senha em Configurações → Acesso."
fi

echo "▸ Iniciando o app na porta ${PORT}…"
next start -H 0.0.0.0 -p "$PORT" &
APP_PID=$!
EXIT=0
wait "$APP_PID" || EXIT=$?
APP_PID=""
stop_all "$EXIT"

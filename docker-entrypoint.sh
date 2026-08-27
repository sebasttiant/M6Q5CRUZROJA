#!/bin/sh
set -eu
echo "[m6q5] Aplicando migraciones..."
prisma migrate deploy
if [ "${RUN_SEED_ON_START:-false}" = "true" ]; then
  echo "[m6q5] Ejecutando seed idempotente..."
  node prisma/seed.cjs
fi
echo "[m6q5] Iniciando aplicación..."
exec "$@"

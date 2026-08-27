#!/usr/bin/env bash
set -Eeuo pipefail

# ==========================================================================
# M6Q5 — Cruz Roja Colombiana Seccional Antioquia
#
# BORRA LOS DATOS y deja el sistema en limpio.
#
# Este script es DESTRUCTIVO. Existe para dejar el VPS listo antes de la
# puesta en marcha real, después de las pruebas. Siempre respalda primero:
# un reset sin punto de retorno no es una herramienta, es un accidente.
#
# Dos modos:
#
#   ./reset-datos.sh              Vacía las tablas y reinicia el consecutivo
#                                 anual. Conserva el esquema y el volumen.
#                                 El superadministrador se vuelve a crear
#                                 desde el .env.
#
#   ./reset-datos.sh --todo       Además destruye el volumen de Postgres y
#                                 lo recrea desde cero, aplicando todas las
#                                 migraciones sobre una base vacía.
#
# Opciones:
#   --si            No preguntar (para automatizaciones). Respalda igual.
#   --sin-respaldo  Omitir el respaldo previo. Desaconsejado; hay que
#                   combinarlo con --si para que no pregunte dos veces.
# ==========================================================================

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BACKUP_DIR="$APP_DIR/backups"
APP_SERVICE="${APP_SERVICE:-app}"
DB_SERVICE="${DB_SERVICE:-db}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-240}"

MODO="tablas"
CONFIRMADO=0
RESPALDAR=1

for argumento in "$@"; do
  case "$argumento" in
    --todo)         MODO="volumen" ;;
    --si|--yes)     CONFIRMADO=1 ;;
    --sin-respaldo) RESPALDAR=0 ;;
    -h|--help)      awk 'NR<=2 {next} /^#/ {sub(/^# ?/,""); print; visto=1; next} visto {exit}' "${BASH_SOURCE[0]}"; exit 0 ;;
    *)              echo "ERROR: opción desconocida '$argumento'. Usá --help."; exit 1 ;;
  esac
done

cd "$APP_DIR"

command -v docker >/dev/null 2>&1 || { echo "ERROR: falta 'docker'."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "ERROR: se requiere 'docker compose' v2."; exit 1; }
[ -f "$APP_DIR/.env" ] || { echo "ERROR: falta $APP_DIR/.env"; exit 1; }

# --------------------------------------------------------------------------
# Confirmación explícita. Escribir "BORRAR" a mano evita el reset por reflejo:
# un sí/no se contesta sin leer, una palabra completa no.
# --------------------------------------------------------------------------
echo "=========================================================="
echo " ATENCIÓN — esto BORRA datos y no se puede deshacer"
echo "=========================================================="
if [ "$MODO" = "volumen" ]; then
  echo " Modo:  --todo"
  echo " Se destruye el volumen de Postgres completo y se recrea"
  echo " la base desde cero aplicando todas las migraciones."
else
  echo " Modo:  tablas"
  echo " Se vacían Analysis, CategoryAssessment, Subcause, MainCause,"
  echo " AnnualSequence y AdminUser. El esquema queda intacto."
fi
echo
echo " Se pierden TODOS los análisis registrados y sus códigos."
echo " Carpeta: $APP_DIR"
echo "=========================================================="
echo

if [ "$CONFIRMADO" -eq 0 ]; then
  read -r -p "Escribí BORRAR (en mayúsculas) para continuar: " respuesta
  if [ "$respuesta" != "BORRAR" ]; then
    echo "Cancelado. No se tocó nada."
    exit 0
  fi
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "==> Levantando la base si estuviera detenida..."
docker compose up -d "$DB_SERVICE" >/dev/null

echo "==> Esperando a que la base acepte conexiones..."
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
until docker compose exec -T "$DB_SERVICE" sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "ERROR: la base no respondió a tiempo."
    docker compose logs --tail=60 "$DB_SERVICE"
    exit 1
  fi
  sleep 2
done

# --------------------------------------------------------------------------
# Respaldo previo, verificado. Es lo único que permite deshacer este script.
# --------------------------------------------------------------------------
if [ "$RESPALDAR" -eq 1 ]; then
  DUMP="$BACKUP_DIR/m6q5-db-before-reset-$STAMP.sql.gz"
  echo "==> Respaldando la base antes de borrar: $DUMP"
  if ! docker compose exec -T "$DB_SERVICE" sh -lc \
         'pg_dump --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
       | gzip > "$DUMP"; then
    echo "ERROR: falló el respaldo. No se borra nada."
    rm -f "$DUMP"
    exit 1
  fi
  if ! gzip -t "$DUMP" 2>/dev/null || [ ! -s "$DUMP" ]; then
    echo "ERROR: el respaldo quedó vacío o corrupto. No se borra nada."
    exit 1
  fi
  echo "    ✓ Respaldo verificado ($(du -h "$DUMP" | cut -f1))"
  echo "      Para restaurar:"
  echo "        gunzip -c '$DUMP' | docker compose exec -T $DB_SERVICE sh -lc 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\"'"
else
  echo "==> Respaldo omitido por --sin-respaldo."
fi

if [ "$MODO" = "volumen" ]; then
  # ------------------------------------------------------------------------
  # Reset total: se destruye el volumen. `down -v` borra los volúmenes
  # declarados en el compose de este proyecto, no los de otros proyectos.
  # ------------------------------------------------------------------------
  echo "==> Deteniendo servicios y destruyendo el volumen de Postgres..."
  docker compose down -v

  echo "==> Recreando la base vacía..."
  docker compose up -d "$DB_SERVICE"
  deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
  until docker compose exec -T "$DB_SERVICE" sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
    if [ "$(date +%s)" -ge "$deadline" ]; then
      echo "ERROR: la base nueva no respondió a tiempo."
      docker compose logs --tail=60 "$DB_SERVICE"
      exit 1
    fi
    sleep 2
  done

  echo "==> Aplicando migraciones sobre la base vacía..."
  docker compose run --rm --no-deps --entrypoint sh "$APP_SERVICE" -lc 'prisma migrate deploy'
else
  # ------------------------------------------------------------------------
  # Reset de datos: TRUNCATE con CASCADE y RESTART IDENTITY en una sola
  # transacción. El esquema, el trigger y las migraciones aplicadas quedan
  # como están, así que no hace falta volver a migrar.
  # ------------------------------------------------------------------------
  echo "==> Vaciando las tablas..."
  docker compose exec -T "$DB_SERVICE" sh -lc \
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '"'"'
      TRUNCATE TABLE
        "Subcause", "CategoryAssessment", "MainCause",
        "Analysis", "AnnualSequence", "AdminUser"
      RESTART IDENTITY CASCADE;
    '"'"''
  echo "    ✓ Tablas vacías. El consecutivo anual vuelve a M6Q5-0001-<año>."
fi

# --------------------------------------------------------------------------
# Recrear el superadministrador. Sin esto nadie puede entrar al sistema.
# --------------------------------------------------------------------------
if grep -qE '^ADMIN_EMAIL=.+' "$APP_DIR/.env" && grep -qE '^ADMIN_PASSWORD=.+' "$APP_DIR/.env"; then
  echo "==> Recreando el superadministrador desde el .env..."
  docker compose run --rm --no-deps --entrypoint sh "$APP_SERVICE" -lc 'node prisma/seed.cjs'
  echo "    ✓ Superadministrador listo."
else
  echo "==> ADMIN_EMAIL o ADMIN_PASSWORD no están definidos en el .env."
  echo "    No se creó ningún usuario: NADIE va a poder entrar al sistema."
  echo "    Definilos y ejecutá:  docker compose run --rm --no-deps --entrypoint sh $APP_SERVICE -lc 'node prisma/seed.cjs'"
fi

echo "==> Levantando la aplicación..."
docker compose up -d "$APP_SERVICE"

echo "==> Esperando a que '$APP_SERVICE' quede healthy..."
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
until status="$(docker compose ps -q "$APP_SERVICE" | xargs -r docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null)"; [ "$status" = "healthy" ]; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "ERROR: '$APP_SERVICE' no llegó a 'healthy' (estado: ${status:-desconocido})."
    docker compose logs --tail=60 "$APP_SERVICE"
    exit 1
  fi
  sleep 3
done

echo "==> Estado final de los datos:"
docker compose exec -T "$DB_SERVICE" sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "
     select '"'"'analisis: '"'"' || (select count(*) from \"Analysis\")
         || '"'"' | usuarios: '"'"' || (select count(*) from \"AdminUser\")
         || '"'"' | consecutivos: '"'"' || (select count(*) from \"AnnualSequence\");"' \
  || echo "    (no se pudo consultar el conteo)"

echo
echo "=========================================================="
echo " Sistema en limpio."
if [ "$RESPALDAR" -eq 1 ]; then
  echo "   Respaldo previo: $DUMP"
fi
echo "=========================================================="

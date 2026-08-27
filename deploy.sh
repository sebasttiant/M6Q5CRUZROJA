#!/usr/bin/env bash
set -Eeuo pipefail

# ==========================================================================
# M6Q5 — Cruz Roja Colombiana Seccional Antioquia — deploy en VPS
#
# Flujo: backup código -> pull -> .env -> build -> db up -> dump BD verificado
#        -> migraciones -> app up -> healthy -> verificaciones post-deploy
#
# IMPORTANTE sobre la arquitectura de este repo:
#   - Solo hay dos servicios: `db` (postgres) y `app` (Next.js standalone).
#   - No existen servicios `migrate` ni `seed` separados: el entrypoint del
#     contenedor `app` ejecuta `prisma migrate deploy` al arrancar, y el seed
#     solo si RUN_SEED_ON_START=true.
#   - Aun así las migraciones se corren ACÁ de forma explícita y ANTES de
#     levantar la app. Si una migración falla, el deploy se detiene con la
#     versión anterior todavía en pie, en vez de dejar la app a medio arrancar.
#
# Acceso final:  http://<ip-vps>:${APP_PORT}   (por defecto 3536 -> interno 3000)
# ==========================================================================

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BACKUP_DIR="$APP_DIR/backups"
BRANCH="${BRANCH:-main}"
APP_SERVICE="${APP_SERVICE:-app}"
DB_SERVICE="${DB_SERVICE:-db}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-240}"   # segundos a esperar a que `app` quede healthy
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"        # cuántos respaldos de cada tipo conservar

cd "$APP_DIR"

# --------------------------------------------------------------------------
# Prerrequisitos. Fallar acá es barato; fallar a mitad del deploy no lo es.
# --------------------------------------------------------------------------
echo "==> Verificando prerrequisitos..."
for binario in docker git tar gzip; do
  command -v "$binario" >/dev/null 2>&1 || { echo "ERROR: falta '$binario' en el sistema."; exit 1; }
done
docker compose version >/dev/null 2>&1 || { echo "ERROR: se requiere 'docker compose' v2."; exit 1; }
[ -f "$APP_DIR/docker-compose.yml" ] || { echo "ERROR: no se encontró docker-compose.yml en $APP_DIR."; exit 1; }

if [ ! -f "$APP_DIR/.env" ]; then
  echo "ERROR: falta $APP_DIR/.env"
  echo "       Generalo con claves seguras (solo pregunta la contraseña de acceso):"
  echo "         ./init-env.sh"
  exit 1
fi

# Un .env con los valores de ejemplo es un despliegue inseguro disfrazado de
# despliegue exitoso: se corta antes de exponer nada.
if grep -qE '^(POSTGRES_PASSWORD|SESSION_SECRET|ADMIN_PASSWORD)=replace-with' "$APP_DIR/.env"; then
  echo "ERROR: .env todavía tiene valores de ejemplo ('replace-with-...')."
  echo "       Definí POSTGRES_PASSWORD, SESSION_SECRET y ADMIN_PASSWORD reales antes de desplegar."
  exit 1
fi

# SESSION_SECRET corto vuelve falsificable la cookie de sesión firmada.
session_secret="$(grep -E '^SESSION_SECRET=' "$APP_DIR/.env" | head -1 | cut -d= -f2-)"
if [ "${#session_secret}" -lt 32 ]; then
  echo "ERROR: SESSION_SECRET debe tener al menos 32 caracteres (tiene ${#session_secret})."
  echo "       Generá uno con:  openssl rand -base64 48"
  exit 1
fi

APP_PORT="$(grep -E '^APP_PORT=' "$APP_DIR/.env" | head -1 | cut -d= -f2- || true)"
APP_PORT="${APP_PORT:-3536}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"

# --------------------------------------------------------------------------
# 1. Respaldo del CÓDIGO. No incluye los datos: Postgres vive en un volumen
#    de Docker, fuera de APP_DIR. El respaldo de datos es el paso 4.
# --------------------------------------------------------------------------
echo "==> Respaldando el código..."
CODE_BACKUP="$BACKUP_DIR/m6q5-code-before-deploy-$STAMP.tar.gz"
tar --exclude='./backups' \
    --exclude='./node_modules' \
    --exclude='./.next' \
    --exclude='./.git' \
    --exclude='./.env' \
    -czf "$CODE_BACKUP" .
echo "    ✓ Código respaldado: $CODE_BACKUP ($(du -h "$CODE_BACKUP" | cut -f1))"
echo "      (el .env queda fuera a propósito: contiene secretos)"

# --------------------------------------------------------------------------
# 2. Traer el código nuevo.
# --------------------------------------------------------------------------
echo "==> Actualizando el código desde origin/$BRANCH..."
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "ERROR: hay cambios locales sin commitear en archivos versionados."
  git status --short --untracked-files=no
  echo "       Resolvelos antes de desplegar (git stash / git checkout -- .)."
  exit 1
fi
git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH"

APP_COMMIT="$(git rev-parse --short HEAD)"
export APP_COMMIT
echo "==> Desplegando commit $APP_COMMIT"

# --------------------------------------------------------------------------
# 3. Construir la imagen. Se hace antes de tocar la base: si el build falla,
#    la versión anterior sigue corriendo intacta.
# --------------------------------------------------------------------------
echo "==> Construyendo la imagen de '$APP_SERVICE'..."
docker compose build "$APP_SERVICE"

echo "==> Levantando la base de datos..."
docker compose up -d "$DB_SERVICE"

echo "==> Esperando a que la base acepte conexiones..."
db_deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
until docker compose exec -T "$DB_SERVICE" sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
  if [ "$(date +%s)" -ge "$db_deadline" ]; then
    echo "ERROR: la base no aceptó conexiones a tiempo; no se puede respaldar."
    docker compose logs --tail=80 "$DB_SERVICE"
    exit 1
  fi
  sleep 2
done

# --------------------------------------------------------------------------
# 4. Punto de restauración de la BASE DE DATOS.
#
#    Sin esto, una migración que salga mal deja los análisis registrados sin
#    forma de volver atrás. Las migraciones que eliminan columnas (como la que
#    quitó why4/why5) NO se revierten solas: el único rollback real es este
#    archivo. Si el dump falla, el deploy se detiene ANTES de migrar.
# --------------------------------------------------------------------------
DB_DUMP="$BACKUP_DIR/m6q5-db-before-deploy-$STAMP.sql.gz"
echo "==> Respaldando la base en $DB_DUMP ..."
if ! docker compose exec -T "$DB_SERVICE" sh -lc \
       'pg_dump --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
     | gzip > "$DB_DUMP"; then
  echo "ERROR: falló el respaldo de la base. El deploy se detiene ANTES de migrar."
  rm -f "$DB_DUMP"
  exit 1
fi

# Un dump vacío o truncado es peor que no tener dump: da falsa tranquilidad.
if ! gzip -t "$DB_DUMP" 2>/dev/null || [ ! -s "$DB_DUMP" ]; then
  echo "ERROR: el respaldo quedó vacío o corrupto ($DB_DUMP). El deploy se detiene."
  exit 1
fi
echo "    ✓ Respaldo verificado: $DB_DUMP ($(du -h "$DB_DUMP" | cut -f1))"
echo "      Para restaurar:"
echo "        gunzip -c '$DB_DUMP' | docker compose exec -T $DB_SERVICE sh -lc 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\"'"

# --------------------------------------------------------------------------
# 5. Migraciones, explícitas y antes de levantar la app.
#    El entrypoint las volverá a ejecutar al arrancar: `migrate deploy` es
#    idempotente, así que la segunda pasada no aplica nada.
# --------------------------------------------------------------------------
echo "==> Aplicando migraciones de Prisma..."
docker compose run --rm --no-deps --entrypoint sh "$APP_SERVICE" -lc 'prisma migrate deploy'

# --------------------------------------------------------------------------
# 6. Seed. Solo corre si el operador lo pidió explícitamente en el .env.
#    Es idempotente: crea o actualiza el superadministrador desde ADMIN_EMAIL
#    y ADMIN_PASSWORD, y de paso revoca sus sesiones anteriores.
# --------------------------------------------------------------------------
if grep -qE '^RUN_SEED_ON_START=true' "$APP_DIR/.env"; then
  echo "==> RUN_SEED_ON_START=true — el entrypoint ejecutará el seed al arrancar."
  echo "    Recordá volver a ponerlo en false y quitar ADMIN_PASSWORD del .env después."
else
  echo "==> Seed omitido (RUN_SEED_ON_START distinto de true)."
fi

echo "==> Levantando '$APP_SERVICE'..."
docker compose up -d --no-deps "$APP_SERVICE"

echo "==> Esperando a que '$APP_SERVICE' quede healthy (timeout ${HEALTH_TIMEOUT}s)..."
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
until status="$(docker compose ps -q "$APP_SERVICE" | xargs -r docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null)"; [ "$status" = "healthy" ]; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "ERROR: '$APP_SERVICE' no llegó a 'healthy' (estado: ${status:-desconocido}). Últimos logs:"
    docker compose logs --tail=80 "$APP_SERVICE"
    echo
    echo "    Para volver atrás:"
    echo "      git reset --hard $(git rev-parse --short HEAD@{1}) && ./deploy.sh"
    echo "      gunzip -c '$DB_DUMP' | docker compose exec -T $DB_SERVICE sh -lc 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\"'"
    exit 1
  fi
  sleep 3
done
echo "    ✓ '$APP_SERVICE' está healthy."

# ==========================================================================
# Verificaciones post-deploy.
#
# Son informativas: nunca abortan un deploy que ya está healthy, pero avisan
# fuerte si algo quedó mal. Cubren lo que un healthcheck genérico no ve.
# ==========================================================================

db_query() {
  docker compose exec -T "$DB_SERVICE" sh -lc \
    "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"$1\"" 2>/dev/null
}

schema_ok=1

check_table() {
  local table="$1" exists
  if ! exists="$(db_query "select to_regclass('public.\\\"$table\\\"') is not null;")"; then
    echo "    ⚠ No se pudo verificar la tabla '$table'."; schema_ok=0; return
  fi
  if [ "$exists" = "t" ]; then echo "    ✓ Tabla '$table' presente."
  else echo "    ⚠ Falta la tabla '$table' — revisá el paso de migración."; schema_ok=0; fi
}

check_columns() {
  local table="$1" expected="$2" missing
  if ! missing="$(db_query "select coalesce(string_agg(c, ', '), '') from unnest(array[$expected]) as c where c not in (select column_name from information_schema.columns where table_schema='public' and table_name='$table');")"; then
    echo "    ⚠ No se pudieron verificar las columnas de '$table'."; schema_ok=0; return
  fi
  if [ -z "$missing" ]; then echo "    ✓ '$table' tiene todas las columnas esperadas."
  else echo "    ⚠ '$table' no tiene: $missing — revisá el paso de migración."; schema_ok=0; fi
}

# Las columnas que una migración ELIMINÓ deben seguir ausentes. Si reaparecen,
# la base no está en la versión que el código espera.
check_columns_absent() {
  local table="$1" unexpected="$2" present
  if ! present="$(db_query "select coalesce(string_agg(column_name, ', '), '') from information_schema.columns where table_schema='public' and table_name='$table' and column_name = any(array[$unexpected]);")"; then
    echo "    ⚠ No se pudo verificar la ausencia de columnas en '$table'."; schema_ok=0; return
  fi
  if [ -z "$present" ]; then echo "    ✓ '$table' no arrastra columnas retiradas."
  else echo "    ⚠ '$table' todavía tiene: $present — la migración no se aplicó."; schema_ok=0; fi
}

echo "==> Post-deploy: verificando el esquema..."
if ! db_query "select 1;" >/dev/null; then
  echo "    (verificación omitida — no se pudo consultar la base; '$APP_SERVICE' ya está healthy)"
else
  check_table "AdminUser"
  check_table "Analysis"
  check_table "CategoryAssessment"
  check_table "Subcause"
  check_table "MainCause"
  check_table "AnnualSequence"
  # Roles, alcance por creador y revocación de sesiones.
  check_columns "AdminUser" "'role','active','sessionVersion'"
  check_columns "Analysis" "'creatorId','code','rootCause'"
  # Tres porqués: why4 y why5 fueron retirados.
  check_columns "MainCause" "'why1','why2','why3'"
  check_columns_absent "MainCause" "'why4','why5'"

  # El límite de tres subcausas por categoría vive en un trigger, no en el
  # esquema de Prisma: si falta, la app acepta datos que el formato no admite.
  if trigger="$(db_query "select count(*) from pg_trigger where tgname = 'Subcause_max_three_per_assessment';")" && [ "$trigger" = "1" ]; then
    echo "    ✓ Trigger de máximo 3 subcausas activo."
  else
    echo "    ⚠ Falta el trigger 'Subcause_max_three_per_assessment'."; schema_ok=0
  fi

  # Debe existir exactamente un superadministrador activo o nadie podrá entrar.
  supers="$(db_query "select count(*) from \\\"AdminUser\\\" where role='SUPERADMIN' and active;" || echo "?")"
  if [ "$supers" = "1" ]; then
    echo "    ✓ Hay un superadministrador activo."
  else
    echo "    ⚠ Superadministradores activos: ${supers}. Si es 0, poné RUN_SEED_ON_START=true"
    echo "      con ADMIN_EMAIL y ADMIN_PASSWORD en el .env y volvé a desplegar."
  fi

  if [ "$schema_ok" -eq 1 ]; then
    echo "    ✓ Esquema aplicado por completo."
  else
    echo "    ⚠ El esquema quedó incompleto. El deploy sigue porque '$APP_SERVICE' está healthy,"
    echo "      pero puede fallar en runtime. Revisá los avisos de arriba."
  fi
fi

# --------------------------------------------------------------------------
# Rutas clave. Se consultan desde adentro del contenedor, igual que el
# healthcheck, para no depender de la red del host ni del firewall del VPS.
# 307 es correcto en las rutas protegidas: redirigen al login sin sesión.
# --------------------------------------------------------------------------
echo "==> Post-deploy: verificando rutas..."
check_route() {
  local ruta="$1" esperado="$2" code
  if code="$(docker compose exec -T "$APP_SERVICE" node -e \
       "fetch('http://127.0.0.1:3000$ruta',{redirect:'manual'}).then(r=>{console.log(r.status);process.exit(r.status>=500?1:0)}).catch(()=>{console.log('sin-respuesta');process.exit(1)})" \
       2>/dev/null)"; then
    echo "    ✓ $ruta responde HTTP $code ($esperado)"
  else
    echo "    ⚠ $ruta devolvió un problema (HTTP ${code:-sin-respuesta})."
    docker compose logs --tail=40 "$APP_SERVICE"
  fi
}
check_route "/api/health"    "esperado 200"
check_route "/login"         "esperado 200"
check_route "/reportes"      "esperado 200, formulario público"
check_route "/dashboard"     "esperado 307 sin sesión"
check_route "/analisis"      "esperado 307 sin sesión"

# --------------------------------------------------------------------------
# Rotación de respaldos: sin esto el disco del VPS se llena en silencio.
# --------------------------------------------------------------------------
echo "==> Rotando respaldos (se conservan los $KEEP_BACKUPS más recientes de cada tipo)..."
for patron in "m6q5-code-before-deploy-*.tar.gz" "m6q5-db-before-deploy-*.sql.gz"; do
  # shellcheck disable=SC2012
  ls -1t "$BACKUP_DIR"/$patron 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | while read -r viejo; do
    rm -f "$viejo" && echo "    - eliminado $(basename "$viejo")"
  done
done

echo "==> Estado final:"
docker compose ps

echo
echo "=========================================================="
echo " Deploy completado — commit $APP_COMMIT"
echo "   Aplicación:      http://<ip-vps>:$APP_PORT"
echo "   Formulario libre: http://<ip-vps>:$APP_PORT/reportes"
echo "   Salud:            http://<ip-vps>:$APP_PORT/api/health"
echo "   Respaldo de BD:   $DB_DUMP"
echo "=========================================================="

#!/usr/bin/env bash
set -Eeuo pipefail

# ==========================================================================
# M6Q5 — Cruz Roja Colombiana Seccional Antioquia
#
# Genera el archivo .env del servidor.
#
# Todas las claves técnicas se generan solas, largas y aleatorias. Lo único
# que se escribe a mano es la contraseña de acceso del superadministrador,
# porque es la única que una persona necesita recordar.
#
# Uso:
#
#   ./init-env.sh              Crea el .env para el primer despliegue.
#                              Pregunta la contraseña del superadministrador.
#
#   ./init-env.sh --asegurar   Después del primer despliegue exitoso: apaga
#                              el seed automático y quita ADMIN_PASSWORD del
#                              archivo. La contraseña ya vive como hash en
#                              la base; no hace falta conservarla en texto.
#
# Opciones:
#   --forzar        Sobrescribir un .env existente (respalda el anterior).
#                   Ver la advertencia sobre POSTGRES_PASSWORD más abajo.
#   --correo <mail> Correo del superadministrador (por defecto pregunta).
# ==========================================================================

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
ENV_FILE="$APP_DIR/.env"
BACKUP_DIR="$APP_DIR/backups"

MODO="crear"
FORZAR=0
CORREO=""

while [ $# -gt 0 ]; do
  case "$1" in
    --asegurar|--harden) MODO="asegurar" ;;
    --forzar|--force)    FORZAR=1 ;;
    --correo|--email)    shift; CORREO="${1:-}" ;;
    -h|--help)           awk 'NR<=2 {next} /^#/ {sub(/^# ?/,""); print; visto=1; next} visto {exit}' "${BASH_SOURCE[0]}"; exit 0 ;;
    *)                   echo "ERROR: opción desconocida '$1'. Usá --help."; exit 1 ;;
  esac
  shift
done

# --------------------------------------------------------------------------
# Generación de secretos.
#
# POSTGRES_PASSWORD termina embebida dentro de una URL de conexión, así que
# se genera en hexadecimal: base64 puede traer '/', '+' o '=' y partir la URL.
# SESSION_SECRET no viaja en ninguna URL, así que puede usar el alfabeto
# completo y aprovechar más entropía por carácter.
# --------------------------------------------------------------------------
secreto_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

secreto_base64() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 "$1" | tr -d '\n'
  else
    head -c "$1" /dev/urandom | base64 | tr -d '\n'
  fi
}

# ==========================================================================
# Modo --asegurar: endurecer un .env que ya existe.
# ==========================================================================
if [ "$MODO" = "asegurar" ]; then
  [ -f "$ENV_FILE" ] || { echo "ERROR: no existe $ENV_FILE. Ejecutá primero ./init-env.sh"; exit 1; }

  mkdir -p "$BACKUP_DIR"
  cp "$ENV_FILE" "$BACKUP_DIR/env-before-harden-$(date +%Y%m%d-%H%M%S).bak"
  chmod 600 "$BACKUP_DIR"/env-before-harden-*.bak 2>/dev/null || true

  tmp="$(mktemp)"
  chmod 600 "$tmp"
  # Se descarta ADMIN_PASSWORD y se apaga el seed. El resto queda intacto.
  grep -v -E '^ADMIN_PASSWORD=' "$ENV_FILE" \
    | sed 's/^RUN_SEED_ON_START=.*/RUN_SEED_ON_START=false/' > "$tmp"
  mv "$tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"

  echo "✓ .env asegurado:"
  echo "    - RUN_SEED_ON_START=false"
  echo "    - ADMIN_PASSWORD eliminado del archivo"
  echo
  echo "  La contraseña sigue vigente: vive como hash scrypt en la base."
  echo "  Para cambiarla más adelante, entrá como superadministrador a /usuarios,"
  echo "  o volvé a poner ADMIN_PASSWORD y RUN_SEED_ON_START=true por un despliegue."
  echo "  Respaldo del archivo anterior en $BACKUP_DIR (contiene la contraseña: borralo cuando no lo necesites)."
  exit 0
fi

# ==========================================================================
# Modo crear.
# ==========================================================================

# --------------------------------------------------------------------------
# Sobrescribir un .env existente es peligroso y no por el archivo: al generar
# una POSTGRES_PASSWORD nueva, el volumen de Postgres conserva la ANTERIOR.
# La aplicación deja de conectar y los análisis quedan inaccesibles hasta
# restaurar la contraseña vieja. Por eso se exige --forzar explícito.
# --------------------------------------------------------------------------
if [ -f "$ENV_FILE" ] && [ "$FORZAR" -eq 0 ]; then
  echo "=========================================================="
  echo " Ya existe $ENV_FILE — no se toca."
  echo "=========================================================="
  echo
  echo " Si lo regenerás, se crea una POSTGRES_PASSWORD nueva, pero la base"
  echo " de datos ya existente conserva la anterior. La aplicación dejaría de"
  echo " conectar y los análisis quedarían inaccesibles."
  echo
  echo " Opciones:"
  echo "   - Para endurecerlo tras el primer despliegue:  ./init-env.sh --asegurar"
  echo "   - Para editarlo a mano:                        nano .env"
  echo "   - Para regenerarlo de todas formas:            ./init-env.sh --forzar"
  echo "     (solo tiene sentido en una instalación nueva o junto con ./reset-datos.sh --todo)"
  exit 1
fi

echo "=========================================================="
echo " M6Q5 — generación del .env del servidor"
echo "=========================================================="
echo
echo " Se generan solas y al azar:"
echo "   POSTGRES_PASSWORD   48 caracteres hexadecimales"
echo "   SESSION_SECRET      64 caracteres"
echo
echo " Se escribe a mano únicamente:"
echo "   ADMIN_PASSWORD      la contraseña con la que se entra al sistema"
echo

if [ -z "$CORREO" ]; then
  read -r -p "Correo del superadministrador [admin@ilasesorias.com]: " CORREO
  CORREO="${CORREO:-admin@ilasesorias.com}"
fi
if ! printf '%s' "$CORREO" | grep -qE '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'; then
  echo "ERROR: '$CORREO' no parece un correo válido."
  exit 1
fi

# --------------------------------------------------------------------------
# Contraseña del superadministrador. Se pide dos veces y sin eco.
# El mínimo de 12 caracteres es el que exige el seed (prisma/seed.ts).
# --------------------------------------------------------------------------
while true; do
  read -rsp "Contraseña para $CORREO (mínimo 12 caracteres): " CLAVE; echo
  read -rsp "Repetila: " CLAVE2; echo

  if [ "$CLAVE" != "$CLAVE2" ]; then
    echo "  ✗ No coinciden. Probá de nuevo."; echo; continue
  fi
  if [ "${#CLAVE}" -lt 12 ]; then
    echo "  ✗ Tiene ${#CLAVE} caracteres; el sistema exige 12 o más."; echo; continue
  fi
  # Docker Compose interpola ${...} y $VAR al leer el .env, así que un '$'
  # dentro de la contraseña llegaría alterado al contenedor.
  case "$CLAVE" in
    *'$'*) echo "  ✗ No puede contener '\$': docker compose lo interpreta como variable."; echo; continue ;;
    *'#'*) echo "  ✗ No puede contener '#': se lee como comentario dentro del .env."; echo; continue ;;
  esac
  if [ "$CLAVE" != "${CLAVE#[[:space:]]}" ] || [ "$CLAVE" != "${CLAVE%[[:space:]]}" ]; then
    echo "  ✗ No puede empezar ni terminar con espacios."; echo; continue
  fi
  break
done

if [ -f "$ENV_FILE" ]; then
  mkdir -p "$BACKUP_DIR"
  respaldo="$BACKUP_DIR/env-before-init-$(date +%Y%m%d-%H%M%S).bak"
  cp "$ENV_FILE" "$respaldo"
  chmod 600 "$respaldo"
  echo
  echo "  .env anterior respaldado en $respaldo"
fi

POSTGRES_PASSWORD="$(secreto_hex 24)"
SESSION_SECRET="$(secreto_base64 48)"

# Se escribe con permisos restrictivos ANTES de volcar los secretos, para que
# el archivo nunca exista siquiera un instante con permisos abiertos.
umask 177
cat > "$ENV_FILE" <<ENVFILE
# Generado por init-env.sh el $(date '+%Y-%m-%d %H:%M:%S').
# Contiene secretos: no lo subas a git (ya está en .gitignore) ni lo compartas.
#
# DATABASE_URL no aparece a propósito: dentro de Docker la arma docker-compose.yml
# a partir de POSTGRES_USER, POSTGRES_PASSWORD y POSTGRES_DB, apuntando al
# servicio 'db'. Definirla acá solo confunde.

POSTGRES_USER=cruzroja
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=m6q5

SESSION_SECRET=$SESSION_SECRET

APP_PORT=3536

# El seed crea o actualiza el superadministrador en el próximo arranque.
# Tras el primer despliegue exitoso, ejecutá:  ./init-env.sh --asegurar
ADMIN_EMAIL=$CORREO
ADMIN_PASSWORD=$CLAVE
RUN_SEED_ON_START=true

# Análisis de demostración. Dejar en false para un servidor real.
SEED_DEMO=false
ENVFILE
umask 022
chmod 600 "$ENV_FILE"

unset CLAVE CLAVE2 POSTGRES_PASSWORD SESSION_SECRET

# --------------------------------------------------------------------------
# Verificación: que el archivo quedó completo y utilizable. Se comprueban las
# longitudes sin imprimir jamás los valores.
# --------------------------------------------------------------------------
echo
echo "==> Verificando el archivo generado..."
faltantes=0
for clave in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB SESSION_SECRET APP_PORT ADMIN_EMAIL ADMIN_PASSWORD RUN_SEED_ON_START SEED_DEMO; do
  if ! grep -qE "^$clave=.+" "$ENV_FILE"; then
    echo "    ✗ falta $clave"; faltantes=1
  fi
done
[ "$faltantes" -eq 0 ] && echo "    ✓ Están las 9 claves."

largo_sesion="$(grep -E '^SESSION_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\n' | wc -c)"
if [ "$largo_sesion" -ge 32 ]; then
  echo "    ✓ SESSION_SECRET: $largo_sesion caracteres."
else
  echo "    ✗ SESSION_SECRET quedó corto ($largo_sesion)."; faltantes=1
fi

largo_pg="$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\n' | wc -c)"
echo "    ✓ POSTGRES_PASSWORD: $largo_pg caracteres hexadecimales (seguros dentro de una URL)."

if grep -qE '^(POSTGRES_PASSWORD|SESSION_SECRET|ADMIN_PASSWORD)=replace-with' "$ENV_FILE"; then
  echo "    ✗ quedaron valores de ejemplo."; faltantes=1
fi

permisos="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE")"
[ "$permisos" = "600" ] && echo "    ✓ Permisos $permisos (solo el dueño puede leerlo)." \
                        || echo "    ⚠ Permisos $permisos — se esperaba 600."

if [ "$faltantes" -ne 0 ]; then
  echo
  echo "ERROR: el .env no quedó utilizable. Revisá los puntos marcados con ✗."
  exit 1
fi

echo
echo "=========================================================="
echo " .env listo en $ENV_FILE"
echo
echo " Siguiente paso:"
echo "   ./deploy.sh"
echo
echo " Y cuando confirmes que podés entrar con $CORREO:"
echo "   ./init-env.sh --asegurar"
echo "   (apaga el seed y borra la contraseña del archivo)"
echo "=========================================================="

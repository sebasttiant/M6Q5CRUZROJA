# M6Q5 · Análisis de causa raíz

MVP institucional para **Cruz Roja Colombiana Seccional Antioquia**. Digitaliza el análisis de causas con metodología 6M, valoración por impacto y cinco porqués.

## Funcionalidades

- Código anual concurrente `M6Q5-0001-2026` mediante secuencia atómica en PostgreSQL.
- Registro completo: responsable, proceso, fecha, hallazgo, seis categorías, máximo dos causas principales, cinco porqués y causa raíz.
- Dashboard con KPIs, estados, valoración 6M, impacto, tendencia, filtros y registros recientes.
- Listado, búsqueda, consulta de detalle, actualización de estado y exportación Excel.
- Autenticación con contraseña scrypt y cookie HTTP-only firmada con expiración verificable de 12 horas.
- Gestión de usuarios con roles `SUPERADMIN`, `ADMIN` y `USER`, desactivación inmediata y contraseñas de mínimo 12 caracteres.
- Alcance por creador para `USER`; `ADMIN` y `SUPERADMIN` conservan la visión institucional completa.
- Validación Zod en cliente y servidor.

## Requisitos

- Node.js 24 y pnpm 11.7, o Docker con Compose.
- PostgreSQL 18 (versiones recientes compatibles también deberían funcionar).

## Inicio con Docker

```bash
cp .env.example .env
# Reemplace TODOS los valores de ejemplo. Use secretos largos y únicos.
docker compose up --build
```

Para crear o actualizar el superadministrador, defina `ADMIN_EMAIL`, `ADMIN_PASSWORD` (mínimo 12 caracteres) y `RUN_SEED_ON_START=true`. El seed es idempotente, mantiene un único `SUPERADMIN` y actualiza su acceso desde variables locales. Después del arranque retire la contraseña del `.env` y vuelva a `RUN_SEED_ON_START=false`. `SEED_DEMO=true` agrega un análisis demostrativo idempotente.

El puerto público se configura con `APP_PORT` (por defecto `3536`); el contenedor mantiene el puerto interno `3000`.

Aplicación: <http://localhost:3536> · Salud: <http://localhost:3536/api/health>

## Desarrollo local

```bash
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm dev
```

## Verificación

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
docker compose config
docker build --target runner -t m6q5-cruzroja:local .
```

## Modelo de valoración

Para cada categoría 6M se multiplican únicamente los impactos diligenciados (1 bajo, 2 medio, 3 alto). Si no hay impactos, la valoración es 0. Este comportamiento replica las fórmulas del Excel fuente.

## Seguridad y operación

- El repositorio no contiene contraseñas ni secretos reales; `.env` está ignorado.
- Las migraciones se ejecutan explícitamente antes de iniciar el contenedor.
- El seed es opcional e idempotente; las credenciales del superadministrador se leen únicamente del entorno local.
- Solo `SUPERADMIN` administra usuarios. `ADMIN` opera todos los análisis y `USER` consulta y exporta únicamente los propios.
- La exportación Excel requiere una sesión activa y aplica el mismo alcance de autorización que dashboard, listado y detalle.
- La prueba concurrente del consecutivo queda como integración pendiente: requiere una instancia PostgreSQL aislada para coordinar transacciones reales sin volver frágil la suite unitaria.

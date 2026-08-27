# M6Q5 · Análisis de causa raíz

MVP institucional para **Cruz Roja Colombiana Seccional Antioquia**. Digitaliza el análisis de causas con metodología 6M, valoración por impacto y cinco porqués.

## Funcionalidades

- Código anual concurrente `M6Q5-0001-2026` mediante secuencia atómica en PostgreSQL.
- Registro completo: responsable, proceso, fecha, hallazgo, seis categorías, máximo dos causas principales, cinco porqués y causa raíz.
- Dashboard con KPIs, estados, valoración 6M, impacto, tendencia, filtros y registros recientes.
- Listado, búsqueda, consulta de detalle, actualización de estado y exportación Excel.
- Autenticación con contraseña scrypt y cookie HTTP-only firmada con expiración verificable de 12 horas.
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

Para crear el primer usuario, defina `ADMIN_EMAIL`, `ADMIN_PASSWORD` (mínimo 12 caracteres) y `RUN_SEED_ON_START=true`. Después del primer arranque puede retirar la contraseña del `.env` y volver a `RUN_SEED_ON_START=false`. `SEED_DEMO=true` agrega un análisis demostrativo idempotente.

Aplicación: <http://localhost:3000> · Salud: <http://localhost:3000/api/health>

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
- El seed es opcional e idempotente. No actualiza contraseñas existentes.
- La exportación Excel requiere sesión activa e incluye el análisis completo: 6M, subcausas, impactos, valoraciones, causas principales, cinco porqués y causa raíz.
- La prueba concurrente del consecutivo queda como integración pendiente: requiere una instancia PostgreSQL aislada para coordinar transacciones reales sin volver frágil la suite unitaria.

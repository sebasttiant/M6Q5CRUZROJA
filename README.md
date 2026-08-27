# M6Q5 · Análisis de causa raíz

MVP institucional para **Cruz Roja Colombiana Seccional Antioquia**. Digitaliza el análisis de causas con metodología 6M, valoración por impacto y tres porqués.

## Funcionalidades

- Código anual concurrente `M6Q5-0001-2026` mediante secuencia atómica en PostgreSQL.
- Registro completo: responsable, proceso, fecha, hallazgo, seis categorías con máximo tres subcausas cada una, dos causas principales, tres porqués y causa raíz.
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

Cada categoría 6M admite máximo tres subcausas, igual que las tres filas que el formato reserva por bloque (`AC-43!A30:A47`).

La valoración multiplica únicamente los impactos diligenciados (1 bajo, 2 medio, 3 alto) y vale 0 cuando no hay ninguno. Reproduce exactamente `AC-43!G30`:

```
=SI(Y(F30<>"";F31<>"";F32<>"");F30*F31*F32;
 SI(Y(F30<>"";F31<>"";F32="");F30*F31;
 SI(Y(F30<>"";F31="";F32<>"");F30*F32;
 SI(Y(F30<>"";F31="";F32="");F30;
 SI(Y(F30="";F31<>"";F32<>"");F31*F32;
 SI(Y(F30="";F31<>"";F32="");F31;
 SI(Y(F30="";F31="";F32<>"");F32;0)))))))
```

La columna `F` del formato valida contra la lista `"1, 2, 3"` con `allowBlank`, así que una celda de impacto solo puede estar vacía o valer 1, 2 o 3. `calculateValuation` se compara contra una transcripción literal de `G30` en las 64 combinaciones que esas tres celdas pueden alcanzar, además de una prueba por cada una de las ocho ramas.

Las seis categorías usan la misma fórmula sobre su propio bloque (`G30`, `G33`, `G36`, `G39`, `G42`, `G45`), y cada resultado ocupa una celda combinada de tres filas (`G30:G32`): una valoración por categoría.

## Reporte público

`/reportes` es la única ruta abierta: no lee sesión, no muestra navegación interna y solo expone las cuatro etapas del formulario. Al enviar devuelve el código institucional y nada más — nunca el identificador interno del registro.

Controles aplicados:

- El estado se fuerza a `EN_ANALISIS` en el servidor, así nadie puede radicar un análisis ya cerrado.
- El registro queda sin `creatorId`, por lo que solo `ADMIN` y `SUPERADMIN` lo ven; un `USER` sigue viendo únicamente los propios.
- Límite de 20 envíos por hora y por dirección, en memoria del proceso.

El límite depende de que el proxy inverso reenvíe `X-Forwarded-For` (o `X-Real-IP`). Sin esa cabecera todos los envíos comparten un mismo contador. Como vive en memoria, no se comparte entre réplicas ni sobrevive a un reinicio; si el servicio escala horizontalmente hay que moverlo a un almacén compartido.

El consecutivo anual se reserva de forma atómica, así que un envío descartado deja un hueco en la numeración. Es el comportamiento correcto para una secuencia auditable.

## Causas principales

El formato deja las dos causas principales para que alguien las escriba a mano tras leer la columna de valoración (`AC-43!A54` es `=D49`). El sistema las deriva: toma las dos categorías 6M con mayor valoración, de mayor a menor, y desempata con el orden canónico del formato. La subcausa asociada se propone con la de mayor impacto de esa categoría y se puede editar. Cada causa principal admite tres porqués, como las columnas `POR QUÉ 1`, `POR QUÉ 2` y `POR QUÉ 3` de `AC-43!C53:G53`.

## Seguridad y operación

- El repositorio no contiene contraseñas ni secretos reales; `.env` está ignorado.
- Las migraciones se ejecutan explícitamente antes de iniciar el contenedor.
- El seed es opcional e idempotente; las credenciales del superadministrador se leen únicamente del entorno local.
- Solo `SUPERADMIN` administra usuarios. `ADMIN` opera todos los análisis y `USER` consulta y exporta únicamente los propios.
- La exportación Excel requiere una sesión activa y aplica el mismo alcance de autorización que dashboard, listado y detalle.
- La prueba concurrente del consecutivo queda como integración pendiente: requiere una instancia PostgreSQL aislada para coordinar transacciones reales sin volver frágil la suite unitaria.

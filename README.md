# M6Q5 · Análisis de causa raíz

MVP institucional para **Cruz Roja Colombiana Seccional Antioquia**. Digitaliza el análisis de causas con metodología 6M, valoración por impacto y los porqués del programa 6MQ5.

## Funcionalidades

- Código anual concurrente `M6Q5-0001-2026` mediante secuencia atómica en PostgreSQL.
- Registro completo: responsable, proceso, fecha, hallazgo, seis categorías con máximo tres subcausas cada una, dos causas principales, sus porqués y causa raíz.
- Exportación institucional a Excel (consolidado) y a PDF (un análisis por documento, listo para firmar).
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
./init-env.sh              # genera .env con claves seguras
docker compose up --build
```

Para crear o actualizar el superadministrador, defina `ADMIN_EMAIL`, `ADMIN_PASSWORD` (mínimo 12 caracteres) y `RUN_SEED_ON_START=true`. El seed es idempotente, mantiene un único `SUPERADMIN` y actualiza su acceso desde variables locales. Después del arranque retire la contraseña del `.env` y vuelva a `RUN_SEED_ON_START=false`. `SEED_DEMO=true` agrega un análisis demostrativo idempotente.

El puerto público se configura con `APP_PORT` (por defecto `3536`); el contenedor mantiene el puerto interno `3000`.

Aplicación: <http://localhost:3536> · Salud: <http://localhost:3536/api/health>

## Desarrollo local

```bash
./init-env.sh              # genera .env con claves seguras
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm dev
```

Fuera de Docker, Prisma necesita además una `DATABASE_URL` apuntando a su PostgreSQL local, por ejemplo:

```bash
echo "DATABASE_URL=postgresql://cruzroja:LA_CLAVE@localhost:5432/m6q5?schema=public" >> .env
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

## Despliegue en el VPS

Primer despliegue:

```bash
cd /opt/docker/m6q5cruzroja
./init-env.sh     # genera las claves; solo pregunta la contraseña de acceso
./deploy.sh
./init-env.sh --asegurar   # una vez que confirmes que podés entrar
```

Despliegues siguientes:

```bash
./deploy.sh
```

### init-env.sh

Genera el `.env` con `POSTGRES_PASSWORD` (48 hexadecimales) y `SESSION_SECRET` (64 caracteres) aleatorios. Lo único que se escribe a mano es la contraseña del superadministrador, que se pide dos veces y se valida: mínimo 12 caracteres, sin el signo de dólar (docker compose lo interpolaría) ni almohadilla (el `.env` la leería como comentario).

`POSTGRES_PASSWORD` se genera en hexadecimal a propósito: termina embebida en la URL de conexión, y un `/`, `+` o `=` de base64 la partiría.

No escribe `DATABASE_URL`: dentro de Docker la arma `docker-compose.yml` apuntando al servicio `db`.

**Se niega a sobrescribir un `.env` existente.** Regenerar `POSTGRES_PASSWORD` contra un volumen de Postgres que ya existe deja la aplicación sin poder conectar y los análisis inaccesibles. `--forzar` lo permite igual, respaldando el anterior; solo tiene sentido en una instalación nueva o junto a `./reset-datos.sh --todo`.

`--asegurar` es el paso de cierre: pone `RUN_SEED_ON_START=false` y borra `ADMIN_PASSWORD` del archivo. La contraseña sigue vigente como hash scrypt en la base.

### Dejar el sistema en limpio

```bash
./reset-datos.sh          # vacía las tablas, conserva el esquema
./reset-datos.sh --todo   # además destruye el volumen y migra desde cero
./reset-datos.sh --help
```

Borra los análisis y los usuarios, reinicia el consecutivo anual a `M6Q5-0001-<año>` y recrea el superadministrador desde el `.env`. Respalda y verifica el dump antes de borrar, y exige escribir `BORRAR` en mayúsculas salvo que se pase `--si`.

## Orden institucional de las 6M

Las seis categorías se numeran `M1` a `M6` y ese orden es único en todo el producto: formulario, detalle, gráfica del dashboard, columnas del Excel, tabla del PDF y desempate entre dos categorías con la misma valoración.

| | | | |
|---|---|---|---|
| **M1** | Mano de obra | **M4** | Materiales |
| **M2** | Método | **M5** | Medio ambiente |
| **M3** | Maquinaria/equipos | **M6** | Medición |

En pantallas anchas el formulario coloca M1–M3 en la columna izquierda y M4–M6 en la derecha, de modo que cada par queda enfrentado. Por debajo de 1280 px las seis tarjetas se apilan en una sola columna.

Este orden reemplaza al del Excel fuente (`AC-43`, que lista Medición en segundo lugar). El cambio solo afecta la presentación y el desempate; la fórmula, las valoraciones y los datos almacenados son los mismos.

Cada categoría lleva una ayuda con las variables que suelen considerarse en ella. Está plegada por omisión detrás de «¿Qué va aquí?»: seis bloques de guía siempre visibles convierten la sección en un muro de texto y empujan los campos fuera de la pantalla.

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

El formato deja las dos causas principales para que alguien las escriba a mano tras leer la columna de valoración (`AC-43!A54` es `=D49`). El sistema las deriva: toma las dos categorías 6M con mayor valoración, de mayor a menor, y desempata con el orden canónico del formato. La subcausa asociada se propone con la de mayor impacto de esa categoría y se puede editar. Cada causa principal admite tres campos de porqué, como las columnas `POR QUÉ 1`, `POR QUÉ 2` y `POR QUÉ 3` de `AC-43!C53:G53`.

La interfaz habla de «cinco porqués» porque así se llama el programa institucional (6M + Q + 5). El formato fuente aporta tres columnas y el sistema conserva esas tres; la diferencia es de marca, no de datos.

## Exportación a PDF

`GET /api/export/pdf?id=<id>` entrega un documento A4 por análisis: encabezado con el logo y el código en cada página, identificación, la tabla 6M con valoraciones, las causas principales con sus porqués, la causa raíz destacada y un bloque de firmas.

Requiere sesión y aplica `analysisScope`: un `USER` solo exporta los análisis que creó. Sin sesión responde `401`, sin identificador `400` y fuera de alcance `404`.

Se genera con `pdfkit`. Sus métricas de fuente `.afm` se resuelven en tiempo de ejecución por una ruta que el trazado de Next no sigue, así que `next.config.ts` las incluye explícitamente con `outputFileTracingIncludes`; sin eso el build `standalone` falla al exportar. El smoke de integración lo verifica dentro del contenedor, no solo en local.

## Seguridad y operación

- El repositorio no contiene contraseñas ni secretos reales; `.env` está ignorado.
- Las migraciones se ejecutan explícitamente antes de iniciar el contenedor.
- El seed es opcional e idempotente; las credenciales del superadministrador se leen únicamente del entorno local.
- Solo `SUPERADMIN` administra usuarios. `ADMIN` opera todos los análisis y `USER` consulta y exporta únicamente los propios.
- La exportación Excel requiere una sesión activa y aplica el mismo alcance de autorización que dashboard, listado y detalle.
- La prueba concurrente del consecutivo queda como integración pendiente: requiere una instancia PostgreSQL aislada para coordinar transacciones reales sin volver frágil la suite unitaria.

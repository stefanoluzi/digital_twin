# Históricos de Repuestos Críticos — LC1C

## Arquitectura y reglas

Se agrega la vista `HISTORY` sin cambiar los selectores ni el comportamiento del Dashboard, Repuestos, Seguimiento o Configuración. Usa React/TypeScript y Recharts ya presentes. El histórico se lee exclusivamente por API/PostgreSQL; no existe respaldo histórico en IndexedDB/localStorage.

`captureCoverage` reutiliza `coverageSummary`, `coverageByArea` y `coverageByGmb`. Un repuesto está cubierto cuando tiene al menos una unidad en `WAREHOUSE` o `MACHINE_SIDE`. El porcentaje entero conserva exactamente el redondeo del Dashboard. Se guardan total/cubiertos/descubiertos, no solamente el porcentaje. Los campos auxiliares `repair` y `purchase` son cantidades de unidades, como en `coverageSummary`, no cantidades de repuestos distintos.

## Migración y tablas

Migración aditiva: `prisma/migrations/202609250001_coverage_history/migration.sql`.

- `CoverageSnapshot`: id, capturedAt, revision, signature SHA-256, total, covered, uncovered, percent, repair, purchase.
- `CoverageSnapshotGroup`: snapshotId, dimension (`AREA`/`GMB`), key, name, responsibleId, responsibleName, areaIds, los mismos indicadores, trackedSince, lastImprovedAt.
- Índices `(capturedAt,id)` y `(dimension,key,snapshotId)`. Restricciones de integridad de cantidades y dimensiones.
- La única FK de los desgloses apunta al snapshot; nombres, identificadores y asignaciones históricos son copias sin FK a los catálogos mutables. Renombrar, reasignar o eliminar un responsable no modifica filas anteriores.

Despliegue: ejecutar `npm run db:generate`, `npm run db:migrate`, compilar y reiniciar la API. El arranque guarda un primer snapshot del estado real si todavía no hay uno, sin fabricar fechas anteriores. El flujo Docker existente ejecuta las migraciones antes de iniciar el servidor.

## Cuándo se captura

`mutateState` conserva su bloqueo de revisión, If-Match y transacción. Se registra el estado anterior (solo si no estaba registrado) y el resultado de la escritura dentro de esa misma transacción. Un fallo revierte datos, auditoría, revisión y snapshots juntos.

Las altas/bajas, unidades, estados, importaciones y cambios de configuración pasan por este punto. La firma de indicadores y asignaciones se compara con la última captura: sin cambios no se inserta. Un comentario/foto no reinicia la fecha de mejora ni genera una captura. Volver de A a B y después A sí conserva las tres situaciones. La inicialización repetida tampoco duplica.

Los snapshots son append-only desde la aplicación: no se expone edición/borrado de historia. Importar un respaldo operativo registra el nuevo estado, pero no sustituye ni borra snapshots anteriores.

## API

`GET /api/coverage-history?period=30`

Períodos: `7`, `30`, `90`, `180` (6 meses aproximados), `365` (1 año), `ALL`, `CUSTOM`.

Personalizado: `?period=CUSTOM&from=2026-09-01&until=2026-09-24`.

Devuelve `availableSince`, `from`, `until`, `baseline`, `current`, `thirtyDaysAgo`, `points`, `warningDays`, `criticalDays`. Cada punto contiene sus desgloses históricos. La consulta usa una transacción RepeatableRead e índices; no recorre repuestos para reconstruir la historia. Fechas UTC, inicio inclusivo mediante baseline, fin inclusivo limitado al presente. Parámetros inválidos responden 422.

## Lectura de gestión

- Cambios en puntos porcentuales: 50→60 = +10 pp; 60→50 = −10 pp.
- Reducción: descubiertos al cierre menos descubiertos iniciales; negativo es reducción.
- Si falta baseline se compara desde el primer registro real del intervalo, indicándolo. Con una sola captura no se inventa variación. Falta de datos a 30 días se muestra como “—”.
- La línea escalonada mantiene el último estado hasta el cierre: no agrega capturas ficticias. No dibuja porcentaje para grupos sin repuestos.
- Por defecto se seleccionan hasta tres áreas/GMB con datos y más descubiertos; se pueden seleccionar varios o todos.
- “Última mejora” es el último aumento del porcentaje publicado. No se considera mejora una edición de comentario. Al comenzar sin mejora conocida, los días cuentan desde el primer registro observado y se explica en pantalla.
- Umbrales centralizados en `coverageHistory.ts`: advertencia 14 días, crítico 30. Grupos sin repuestos y grupos totalmente cubiertos no se consideran estancados. Los retrocesos a 30 días se identifican separadamente.
- Un cambio de universo o asignación puede mejorar/empeorar un porcentaje sin movimiento físico de stock. Los tooltips muestran cantidades y asignaciones de esa fecha; no se atribuye una evaluación subjetiva al GMB.
- El heatmap mensual opcional no se agregó para evitar redundancia con los tres gráficos y la tabla.

## Archivos

- `src/spares/domain/coverageHistory.ts`: captura, tipos, intervalos, comparación y estancamiento.
- `server/coverageHistory.ts`: persistencia y consulta agregada.
- `server/sparesDatabase.ts`, `server/index.ts`, `server/app.ts`: integración transaccional, inicialización y ruta.
- `prisma/schema.prisma` y migración: tablas e índices.
- `src/spares/components/CoverageHistoryView.tsx`, `coverageHistory.css`: pantalla, KPIs, gráficos, tabla y tarjetas.
- `src/spares/CriticalSparesApp.tsx`, `types.ts`, `domain/dashboardFilters.ts`: navegación/URL.
- `tests/coverageHistory.test.ts`, `tests/server/coverageHistory.test.ts`: regresiones de reglas, períodos, persistencia, responsabilidad y rollback.

## Verificación y operación

Comandos: `npm test`, `npm run test:postgres` (solo base terminada en `_test`), `npx tsc -b`, `npm run typecheck:server`, `npm run build`, `npm run build:spares`.

Validación local de esta entrega: 158 tests generales aprobados; 24 tests PostgreSQL aprobados. TypeScript de frontend y servidor, build general y build:spares verificados. Prueba visual en 1366×768, 1600×900 y 1920×1080, rango anterior al primer snapshot vacío, fechas inválidas con error visible y Dashboard conservando los mismos indicadores. El build general mantiene la advertencia de chunks mayores de 500 kB.

El respaldo **PostgreSQL completo** (`pg_dump`) incluye las tablas históricas. El JSON de respaldo operativo existente **no incluye snapshots**; no sirve como respaldo del histórico. No publicar dumps en GitHub. En esta instalación se guardó un dump previo a la migración en `tmp/pre-history-20260925.dump` (ignorado por Git).

Límites: `ALL` devuelve todas las capturas agregadas; si se acumulan cientos de miles conviene añadir paginación/agregación temporal conservando extremos. No hay cron ni captura diaria redundante. La fecha de una captura es la escritura en el servidor, no la fecha retroactiva de un formulario. El reloj del servidor debe estar sincronizado. Acceso/autenticación conservan el alcance de la API existente; este cambio no agrega nuevas garantías de seguridad.

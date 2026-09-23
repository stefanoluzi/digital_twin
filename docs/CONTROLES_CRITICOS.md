# Controles Críticos: Acoplamientos

Se preservan sinóptico, seguimiento por antigüedad, historial, filtros, fotos,
edición de controles, recambios individuales/de alunga y exportación Excel/JSON.
Las posiciones son fijas: 8 jaulas, 16 alungas, 32 acoplamientos. No se agrega un
CRUD artificial de posiciones. Un control nuevo es una ejecución/inspección.

## Modelo relacional

- LcoConfig: singleton, revisión, umbrales y fingerprints legacy.
- LcoCage → LcoShaft → LcoCoupling: definiciones, claves únicas y FK restrictivas.
- LcoEvent: inspección, recambio de acoplamiento o de alunga; fecha, técnico,
  observaciones/OT/motivo según el tipo. Objetivo validado por constraint.
- LcoReading: PK evento/acoplamiento, desgaste 1–5, condición y nota.
- LcoPhoto: fotos generales o por lectura, orden, nombre, MIME, data URL y caption.
- LcoEventVersion: snapshots inmutables desde API por evento/revisión, acción y actor.
- LcoImportReceipt: hash SHA256 único, cantidad de eventos y revisión de importación.

Migración: `prisma/migrations/202609240001_lco_controls/migration.sql`.
Crea estructura y posiciones, NO inspecciones demo. Conserva tablas Repuestos.
Los vínculos opcionales jaula→asset externo son texto, no FK a Repuestos.

Correcciones agregan versión antes de reemplazar el estado corriente; las versiones
anteriores se conservan con sus fotos. El borrado total es lógico; quitar una lectura
también queda versionado. Historial normal muestra ejecuciones vigentes; auditoría de
correcciones se consulta mediante el endpoint de versiones (sin visor específico nuevo).

## API

Prefijo: `/api/controles-criticos/acoplamientos`.

| Método/ruta | Función |
| --- | --- |
| GET /state | Snapshot completo y revision |
| GET /topology | Definiciones de posiciones |
| GET /summary?date=YYYY-MM-DD | Indicadores derivados |
| POST /events | Alta, ID y createdAt generados por servidor |
| PUT /events/:id | Corrección versionada, no cambia tipo ni createdAt |
| DELETE /events/:id | Borrado lógico |
| DELETE /events/:id?couplingId=... | Quitar lectura con auditoría |
| GET /events/:id/versions | Todas las versiones, incluso de eventos borrados |
| PUT /config | Configuración atómica |
| POST /import | Importación aditiva transaccional |
| GET /imports/:hash | Comprobante persistido |

Escrituras exigen `If-Match: <revision>`; actor opcional `X-Actor-Id`.
428 sin revisión; 409 revisión/conflicto de importación; 422 datos inválidos;
404 inexistente; 413 límite de cuerpo; 503 DB no disponible.
Errores se muestran en pantalla; formularios no se cierran si falla el guardado.
Ante pérdida de respuesta, Actualizar y comprobar antes de repetir un alta.
Importación sí permite reintento idempotente mediante comprobante.

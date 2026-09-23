# Handoff: Repuestos Críticos centralizados

Actualizado el 23/09/2026. La migración de código a PostgreSQL/API está implementada.
**Los datos reales del usuario siguen intactos en IndexedDB y todavía NO fueron
importados a PostgreSQL.** No confundir la DB vacía de desarrollo con pérdida de datos.

## Arquitectura actual

- React 18 + TypeScript + Vite; misma UI y selectores de cobertura.
- Zustand es estado de pantalla, no persistencia. El servicio llama al repository HTTP;
  no suscribe autosave ni utiliza IndexedDB como fallback operativo.
- Express/Node + Prisma 6.19.3 + PostgreSQL 16. Tablas relacionales de repuestos,
  unidades, áreas, GMB, equipos, relaciones N:M, categorías, usuarios, historial y audit_log.
- GMB pertenece a Área; cobertura sigue derivada de unidades WAREHOUSE/MACHINE_SIDE.
- Cada escritura exige revisión (If-Match); transacción con bloqueo y auditoría.
  HTTP 409 ante cliente obsoleto; no se pisa la escritura anterior.
- Lecturas completas consistentes; actualización entre PCs al abrir/refrescar o con
  Actualizar datos, sin realtime. La UI espera confirmación antes de cerrar editores.
- Docker Compose app + postgres; solo publica app (8080 configurable), volumen de DB.
- Digital Twin, Planner y Acoplamientos no migraron: mantienen persistencia anterior.
- Guía completa: [docs/REPUESTOS_CENTRALIZADOS.md](docs/REPUESTOS_CENTRALIZADOS.md).

## Cambios de esta sesión

- Esquema Prisma y migraciones versionadas, API REST, validación estricta de estructura
  y relaciones, auditoría por campo, importación transaccional y control de concurrencia.
- Reutilización de mutaciones de dominio mediante stores aislados dentro de transacciones.
- Repository HTTP para CRUD/unidades/config/import; las pantallas no llaman fetch.
- Import/export JSON compatible v1/v2; nunca normalizar un snapshot corrupto a datos demo.
- Descarga readonly de respaldo IndexedDB original, incluso si la API no está disponible.
- Selector de usuario ahora es preferencia local (no cambia la sesión de las demás PCs).
- UI conserva tema, layout, tipografía, dashboard/filtros; solo agrega conexión/error,
  espera de guardado, actualizar datos y recuperación del respaldo anterior.
- Actualizaciones npm compatibles de seguridad. No se forzaron upgrades mayores.

## IndexedDB legado y migración real pendiente

- Origen original: http://127.0.0.1:5176 (mismo navegador/perfil).
- DB LACO1_MAINTENANCE, versión 3, store criticalSparesState, clave active.
- La aplicación central NO escribe allí. El adaptador antiguo queda archivado en código.
- Configuración → Descargar respaldo local anterior (IndexedDB): exporta raw, readonly.
- Guardar original fuera de la VM; luego Importar en la aplicación central.
- La importación reemplaza datos compartidos tras confirmación y preserva auditoría;
  si falla se revierte todo. No borra IndexedDB.
- Validación exige GMB activo para áreas con repuestos, referencias correctas y IDs únicos.
  SAP duplicado sigue permitido según modelo anterior. Backups v1 ambiguos deben corregirse.
- Exportar respaldo consulta al servidor. JSON operacional no incluye audit_log;
  pg_dump es el backup completo de DB. Tema/layout/filtros permanecen locales.

## Archivos clave

- server/app.ts: endpoints, validación, respuestas de error.
- server/sparesDatabase.ts: transacciones, escritura relacional, control de revisión, auditoría.
- server/index.ts, server/db.ts: arranque y cliente Prisma.
- prisma/schema.prisma, prisma/migrations/: modelo y migraciones.
- src/spares/domain/sparesValidation.ts: formatos, import v1/v2 e integridad.
- src/spares/repositories/HttpCriticalSparesRepository.ts: contrato central y cliente REST.
- src/spares/services/criticalSparesPersistenceService.ts: carga, comandos y backups.
- src/spares/store/criticalSparesStore.ts: estado y mutaciones de dominio reutilizadas en API.
- src/spares/types.ts: modelo conservado; selectores en src/spares/domain/.
- src/spares/CriticalSparesApp.tsx: composición UI, espera de confirmación y errores.
- Dockerfile, docker-compose.yml, .env.example, scripts/start-container.mjs.
- scripts/backup-db.sh, scripts/restore-db.sh, scripts/test-postgres.ts.
- tests/server/postgres.test.ts, tests/sparesValidation.test.ts, tests/sparesHttpPersistence.test.ts.

## Validación realizada

- Suite general: 130 tests aprobados, 8 tests PostgreSQL omitidos deliberadamente en npm test.
- npm run test:postgres: los 8 tests aprobaron contra PostgreSQL real (no mock).
  Incluyen A crea → consulta directa DB → B lee, conflictos simultáneos, relaciones,
  import/export, validación y rollback inducido DESPUÉS de escribir datos.
- npm run typecheck:server y TypeScript del frontend aprobados.
- npm run build y npm run build:spares aprobados; advertencia de chunks >500 kB.
- No existe script lint.
- Navegador contra API/DB de pruebas: dashboard, lista, alta, edición, búsqueda y recarga
  confirmados. El diálogo manual de eliminación bloqueó la herramienta; no contar ese
  paso manual como aprobado. Eliminación validada por test API/DB.
- pg_dump/pg_restore real a otra DB: 6 repuestos, 9 unidades y auditoría recuperados.
- Docker Compose NO ejecutado: Docker no está instalado en esta PC. Verificar en VM.

## Entorno local preparado (no producción)

- PostgreSQL portable oficial en tmp/postgres-runtime/extracted/pgsql (ignorado por Git).
- Clúster de desarrollo/validación en tmp/postgres-runtime/validation-data,
  escucha SOLO 127.0.0.1:55432; autenticación trust únicamente para pruebas locales.
- DB critical_spares_test para tests, critical_spares_restore_test para restore,
  critical_spares_dev vacía para uso local/migración explícita del respaldo del usuario.
- .env local ignorado apunta a DB dev y configura TEST_DATABASE_URL independiente.
- API de desarrollo en 127.0.0.1:3001; frontend Vite existente en 5176 proxy /api a 3001.
- Nada de este runtime temporal, credenciales, dumps ni datos del usuario va a Git.
- Tras reiniciar PC, arrancar PostgreSQL local antes de npm run dev:server;
  preferir Docker para un entorno reproducible. No copiar trust a la VM.

## Git

- Repo: stefanoluzi/digital_twin, rama codex/editor-upgrades; no se tocó main ni portable.
- Base previa: 325c89b (presentación de Repuestos).
- Commits de implementación: 387d0d6 (Prisma), f9a85f3 (API/auditoría),
  daa935e (frontend HTTP), 34c327f (deploy/docs), 77d8930 (tests/endurecimiento).
- Consultar git log -1 para el commit final de documentación que contiene este handoff.
- La rama portable antigua codex/repuestos-criticos-portable sigue siendo estática/IndexedDB,
  NO representa la nueva arquitectura. Publicación remota debe verificarse con git status.

## Riesgos y siguientes pasos

- Importar y verificar el JSON real del usuario: todavía pendiente, sin inventar datos.
- Verificar Docker build/up/health/backup/restore en VM con Docker y firewall interno.
- Identidad declarada X-Actor-Id, NO autenticación/autorización real. No exponer a Internet.
- audit_log no es antimanipulación ante un DBA; adjuntos auditados por hash y longitud.
- Revisión global y snapshot completo: correctos para esta escala, conservadores en conflictos.
- Fotos/PDF base64; límite petición 100 MB, imagen 20 MB y PDF 40 MB de texto.
- npm audit: quedan 5 avisos (2 moderados, 3 altos) en cadenas de herramientas
  Prisma/deepmerge-ts y Vitest/mocker; actualización mayor pendiente. Sin aviso crítico.
- No idempotency keys: ante pérdida de respuesta, refrescar antes de reintentar.
- Restore puede retroceder revisión: detener app y recargar clientes después.
- Backups deben copiarse fuera de la VM; volumen Docker no sustituye backup.

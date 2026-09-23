# Auditoría y destino: Controles Críticos

## Encontrado (antes de la migración)

- Repuestos: React/Zustand → repository HTTP `/api` → Express/Prisma/PostgreSQL.
  Revisión global, If-Match, transacciones y audit_log. Docker publica solo 8080;
  migraciones al arrancar y volumen postgres_data. No modificar tablas ni reglas.
- Acoplamientos: LcoCouplingsScreen + LcoHistoryWorkspace + LcoInspectionTracking;
  estado en maintenanceStore y autosave por suscripción en lcoPersistenceService.
- IndexedDB LACO1_MAINTENANCE v3: lcoEvents (id), lcoAttachments (id, índice eventId,
  Blob y readingId opcional), lcoConfig (clave module). localStorage solo tema
  `laco1-lco-theme`; sesiones antiguas .laco3d pueden contener lcoCouplings.
- Topología fija: 8 jaulas, 16 alungas, 32 posiciones de acoplamiento. IDs J1_SUP_RED,
  etc. No hay alta/baja libre de posiciones. Jaulas pares norte, impares sur.
- Eventos: inspección con varias lecturas (desgaste 1–5, nota, condición y fotos),
  recambio individual (desgaste retirado, OT, motivo, técnico, notas) y recambio de
  alunga (afecta ambos extremos). Fotos generales y por lectura; fecha civil separada
  de createdAt/updatedAt. Técnico es texto, no una entidad de usuarios/GMB.
- Config: umbrales de antigüedad/frescura, vínculo opcional jaula→asset externo,
  fingerprints legacy. Indicadores derivados por fecha/createdAt/id; recambio reciente
  implica nuevo, sin sustituir la fecha real de la última inspección.
- Historial deriva de eventos, edición sobrescribe el evento y borrado puede quitar
  una lectura o el evento completo. No conserva versiones de correcciones.
- Fotos comprimidas en navegador (máximo 1800 px, PNG/JPEG/WebP), backup JSON y
  exportación Excel/CSV. El backend no puede leer DB de otro origen/navegador.

## Problemas reales

Autosave optimista antes de confirmar; errores de guardado no impiden cerrar formularios;
normalizador puede descartar lecturas/fotos inválidas o reemplazar fechas por hoy;
recuperación legacy automática y fingerprints parciales; IDs con fallback Math.random;
historial de correcciones inexistente. No asumir que el origen contiene solo demo.

## Arquitectura destino

Un shell Mantenimiento LC1C con `/`, `/repuestos`, `/controles-criticos` y
`/controles-criticos/acoplamientos`. Registro de tipos para ampliar navegación sin
convertir Acoplamientos en el único tipo posible. Un backend y una DB; dominio LCO
separado en tablas prefijadas Lco y rutas `/api/controles-criticos/acoplamientos`.

Definiciones de jaulas/alungas/posiciones inicializadas por migración. Eventos, lecturas,
fotos y configuración relacionales; revisión LCO independiente. Correcciones conservan
snapshot histórico inmutable en LcoEventVersion (JSON apropiado para auditoría), borrado
lógico del evento. IDs de eventos nuevos en servidor. Validación estricta antes de escribir.
Selectores puros compartidos: cálculo en servidor disponible por API, sin almacenar KPIs.

Frontend espera respuestas confirmadas; sin autosave ni fallback operativo IndexedDB.
Migración explícita readonly desde origen legacy o backup portable: hash canónico SHA256,
importación transaccional aditiva, IDs existentes idénticos se omiten, distintos dan 409;
receipt persistido y verificado antes de marcar éxito. Nunca borrar originales. Config
incompatible en servidor con datos requiere revisión, no sobrescritura silenciosa.

## Validación y límites

Tests existentes antes/después, PostgreSQL real dedicado, CRUD/historial/revisiones/FK,
importación repetida y rollback. Validación manual dos clientes y reinicio backend.
Esta PC no tiene Docker Engine: validación Compose estática no equivale a ejecución
de contenedores/reinicio VM. Backup pg_dump cubre todas las tablas de la misma DB.
Sin autenticación real ni HTTPS aún: solo LAN confiable, no Internet.

# Tareas Globales REX — propuesta de implementación

Estado: fase 1 (análisis). No hay todavía migración aplicada, endpoints ni UI REX.
Fecha de análisis: 28/09/2026.

## Arquitectura comprobada

- Entrada de la plataforma: `spares-standalone/src/main.tsx` y
  `src/platform/MaintenancePlatform.tsx`. Pese al nombre histórico de la carpeta,
  este build ya sirve la plataforma integrada, no solo Repuestos.
- Barra, tema y usuario informativo: `src/shared/AppShell.tsx`.
- React/TypeScript; API Express única en `server/app.ts`; cliente Prisma y
  PostgreSQL compartidos. No introducir otra app, servidor, base o persistencia local.
- Reparaciones usa router modular, validación Zod, transacciones, revisión propia
  y bloqueo del catálogo compartido antes del bloqueo del módulo.
- API: `If-Match`, errores 409/428/422 y respuesta confirmada por servidor.
- Catálogos existentes: `Area`, `Equipment`, `Responsible`, `AppUser`.
- Calendario civil español y ejercicio julio–junio: `src/repairs/calendar.ts`.
  Extraer las funciones genéricas a un calendario compartido manteniendo exports
  compatibles para Reparaciones; no duplicar cálculos ni cambiar su comportamiento.
- UX reutilizable: `PageTransition`, `ModuleLoading`, `DashboardSkeleton`,
  `TableSkeleton`, `RefreshStatus`, `BusyButton`. No existe aún un toast común en
  este archivo: usar feedback contextual accesible; no asumir una biblioteca existente.
- Docker actual sirve `dist-spares` desde el mismo Express. Incluir los archivos
  de dominio REX usados por backend en la imagen final, no solamente en el build.
- `HANDOFF.md` quedó anterior a Taller, LCO centralizado y barra global; el código
  actual es la referencia para esta propuesta.
- Hay cambios locales anteriores de UX/shell: preservarlos; no hacer reset ni push.

## Modelo relacional propuesto

Nombres propuestos para Prisma; no son aún cambios al schema.

| Entidad | Contenido y relaciones |
| --- | --- |
| `RexConfig` | Singleton con revisión del módulo. Inicialización vacía, sin tareas demo. |
| `RexTask` | UUID; código opcional, línea, `areaId`, equipo opcional, especialidad, nombre, descripción, impacto, criticidad, activa. Datos de frecuencia, técnicos y recursos. Relación 1:N con alcance, documentos y ejecuciones. |
| `RexTaskScopeItem` | UUID estable, taskId, descripción, orden, obligatorio, cantidad prevista Decimal positiva, unidad, observaciones, activo. Archivar ítems retirados; nunca reutilizar sus IDs. |
| `RexTaskDocument` | taskId, nombre, URL/ruta, tipo opcional y observación. Solo referencias, sin copiar archivos. |
| `RexEvent` | UUID, nombre, tipo REX/BO/PARADA/EXTRAORDINARIA/OTRA, inicio y fin opcionales, ejercicio inicial opcional, estado y notas. |
| `RexExecution` | taskId, eventId opcional, intención FULL_TASK/PENDING_RESOLUTION, fechas reales opcionales, OT, responsable opcional, fuente, estado, observaciones, snapshot técnico de tarea/frecuencia. |
| `RexExecutionItem` | executionId, ID maestro de origen opcional, snapshot de descripción/orden/obligatorio/cantidad/unidad, cantidad realizada, estado, motivo pendiente y observaciones. |
| `RexPending` | Un pendiente por ítem de ejecución origen (unique); cantidad restante inicial, motivo y fecha real de origen si conocida. El origen nunca se borra. |
| `RexPendingResolution` | pendingId + ítem de otra ejecución que lo resuelve, cantidad aplicada, fecha real opcional, nota y actor. Permite resolver 4 de 8 y luego los otros 4 sin perder trazabilidad. |
| `RexExecutionVersion` | Revisiones append-only: acción, actor declarado, fecha de registro, detalle y snapshot. Actualizar una intervención en curso conserva cada versión anterior. |
| `RexImportBatch` | Huella de archivo/lote y decisiones de mapeo, reporte, estado; protección contra importar dos veces el mismo lote confirmado. |
| `RexImportIssue` | Lote, hoja, fila, columna, valor original, motivo, vínculo opcional a tarea/ejecución, estado de revisión. También aloja filas de bitácora pendientes de asociación. |

Entidades operativas con `createdAt`, `updatedAt`, `createdBy`, `updatedBy` cuando
corresponda. Fechas reales como `DateTime? @db.Date`; timestamps de auditoría con
hora. Identidad declarada, no autenticación. Cantidades/costos con `Decimal`, no
aritmética flotante para cerrar cantidades. Serializar decimales explícitamente.

### Campos de frecuencia

- `frequencyType`: PERIODIC, CONDITION_BASED, COUNTER_BASED, NO_FIXED_FREQUENCY.
- `intervalMonths`: entero positivo, solo para periodicidad inequívoca.
- `frequencyCriteria`: texto técnico, permite «24 meses o 480 KTN».
- `counterThreshold`, `counterUnit`: opcionales. No inventar lecturas ni vencimientos
  por contador cuando no existe medición registrada.
- `legacyFrequency`, `legacyMetadata`: valor original y procedencia.
- Los criterios combinados pueden tener período y umbral. Se calcula solamente
  la parte temporal comprobable y se muestra el criterio restante.
- Valores E, <1, >10 o ambiguos no se convierten silenciosamente a meses exactos.

### Datos técnicos y secundarios

OT de referencia, tiempo estimado y unidad/texto original, plan, datos de control,
justificación y documentos. Recursos/costos: MRO, terceros MEC/ELE/total, HH, MOA,
servicios, labor propia y total; moneda opcional y valores originales. No asumir
moneda ni recalcular silenciosamente el total importado. UI en sección plegable.

### Reutilización y protección de catálogos

- `RexTask.areaId` apunta a `Area`; equipo opcional a `Equipment`; responsable
  opcional a `Responsible`. No exigir perfil de Reparaciones Taller.
- FK restrictivas: no permitir eliminar un área/equipo/responsable referenciado.
  Revisar también las importaciones/borrados de catálogos en
  `server/sparesDatabase.ts` para devolver mensajes útiles y rollback completo.
- No asumir que ZTYD=ZTREF o SHAC=SHA. Proponer equivalencias en la importación y
  exigir confirmación. SERV puede no tener equivalente. Conservar sector original.
- Las descripciones históricas se guardan en snapshots aunque cambie el catálogo.
- No añadir ahora vínculo obligatorio ni proceso paralelo de taller. `RexPending`
  queda como entidad identificable a la que se podrá asociar una reparación futura.

## Reglas que deben quedar garantizadas en backend

1. Al planificar una ejecución, snapshotear el alcance vigente en una transacción.
   Modificar el maestro después no cambia ese alcance.
2. Sin subtareas, generar un ítem de actividad única (1 unidad) para usar las
   mismas reglas de ejecución, pendientes e historial.
3. Cantidad realizada entre cero y prevista. Los ítems completos tienen su
   cantidad prevista realizada; validar coherencia de estado y cantidades.
4. Todos los obligatorios completos => COMPLETED; avance con obligatorios
   pendientes => PARTIAL; sin avance => PLANNED/NOT_STARTED/NOT_PERFORMED según
   contexto explícito. No convertir un plan futuro en una deuda ya ejecutada.
5. Un resultado PARCIAL/NOT_PERFORMED o postergación de trabajo ya debido conserva
   sus pendientes abiertos. Cerrar/cancelar un evento nunca los cierra.
   Registrar motivos también en omisiones opcionales, distinguiéndolas de la
   condición necesaria para completar la tarea.
6. No permitir override COMPLETED con obligatorios pendientes en esta primera
   versión. Así no se requiere implementar una excepción técnica prematura.
7. Una resolución es una nueva intervención con referencia al pendiente origen;
   nunca cambia la cantidad realizada ni el estado histórico de la intervención
   original. No es suficiente marcar una casilla «resuelto» sin ejecución.
8. Saldo pendiente = cantidad inicial menos resoluciones confirmadas. Impedir
   sobre-resolver, reutilizar la misma cantidad de un ítem para deudas distintas,
   duplicar resolución o crear una nueva deuda duplicada al trasladar la existente.
9. Resolver todos los pendientes históricos no convierte retroactivamente aquel
   REX parcial en completo y no reinicia la frecuencia del conjunto.
10. La última ejecución completa del ciclo considera FULL_TASK/COMPLETED, no una
    intervención PENDING_RESOLUTION que completó solamente un componente.
11. Intervenciones sin avance (planificadas, canceladas, no realizadas) no son
    «última intervención realizada», aunque se muestran siempre en el historial.
12. Sin fecha exacta de ejecución completa: mostrar evento histórico; próxima
    fecha = null. Tener historia sin fecha no equivale a no tener historia, pero
    impide asegurar que el ciclo está al día. Mostrar «Fecha por confirmar».
13. Si existe una ejecución completa más reciente de fecha incierta, no calcular
    el ciclo a partir de otra antigua como si fuera la última conocida. Mantener
    precisión/orden histórico explícitos y señalar la incertidumbre.
14. Meses calendario con ajuste al último día válido del mes; probar 31 de enero
    y años bisiestos. Próxima en <=90 días; vencida si fecha requerida < hoy.
15. Mostrar PARCIAL PENDIENTE como atención prioritaria sin ocultar si además está
    vencida. Filtros/KPIs pueden coincidir; no presentarlos como sumandos exclusivos.
16. Ejercicio desconocido permanece null. «REX 2021» por sí solo no determina
    fecha exacta ni si corresponde a 2020/21 o 2021/22.
17. Ejecuciones cerradas no se sobrescriben. Correcciones explícitas versionadas
    y auditadas; si afectan una deuda ya resuelta, rechazar ajustes incompatibles.

## API propuesta (mismo Express, prefijo /api/rex)

| Método y ruta | Función |
| --- | --- |
| GET /catalogs | Catálogos compartidos, opciones y revisión REX. |
| GET /dashboard | KPIs y pendientes prioritarios con filtros. |
| GET /tasks | Parque paginado con búsqueda, filtros y orden estable. |
| POST /tasks | Alta de tarea, alcance y documentos. |
| GET /tasks/:id | Detalle, estado calculado y datos técnicos. |
| PUT /tasks/:id | Edición auditada del maestro, sin alterar snapshots. |
| GET /tasks/:id/history | Timeline paginada, incluidas resoluciones vinculadas. |
| GET/POST /events | Consultar/crear ventanas sin inventar fechas. |
| PUT /events/:id | Modificar/cerrar ventana sin cerrar pendientes. |
| POST /executions | Planificar/registrar intervención y snapshot. |
| GET /executions/:id | Resultado, alcance y versiones. |
| POST /executions/:id/actions | Avance/finalización/corrección explícitos y auditados. |
| GET /pending | Deudas abiertas y saldo por origen. |
| POST /pending/:id/resolutions | Nueva intervención + resolución atómica. |
| GET /matrix | Filas paginadas y eventos seleccionados; ninguna columna anual física. |
| POST /imports/preview | Validar lote normalizado y devolver reporte, sin altas operativas. |
| POST /imports/commit | Importar lote confirmado de forma transaccional e idempotente. |

Escrituras con If-Match/revisión propia; bloqueo en el mismo orden que Taller
(catálogo global, después revisión REX). 428 sin revisión, 409 por conflicto, 422
por datos inválidos. Devolver nueva revisión y entidades afectadas; frontend
espera confirmación. En conflicto conservar formulario, no reintentar a ciegas.
GET de detalle/dashboard/matriz consistentes. Errores visibles y sin fallback local.

Índices: tarea por área/activa, especialidad, criticidad; ejecuciones por
(taskId, fecha real, id), (eventId, status), (status, fecha real); pendientes por
origen único; resoluciones por pendiente/ítem; eventos por ejercicio/estado;
versiones por executionId/revisión. Paginar parque/historial; filtrar eventos
en matriz. No prohibir dos intervenciones de una tarea en el mismo evento:
celda con varias abre su lista, sin ocultar resultados parciales anteriores.

## UI propuesta

Ruta `/tareas-globales-rex`, lazy loaded dentro de MaintenancePlatform y AppShell.
Tarjeta Home: «Historial, frecuencia y cumplimiento de tareas globales de mantenimiento.»

- **Resumen:** seis KPIs pedidos, pendientes heredados destacados, vencidas/próximas.
- **Parque de tareas:** filtros pedidos, búsqueda, paginación y detalle clickable.
- **Pendientes:** origen, componente, cantidad restante, motivo, antigüedad fiable
  y acción «Registrar resolución». Sin fecha conocida, mostrar evento y no edad ficticia.
- **Eventos:** CRUD de ventanas y ejercicio explícito cuando no se puede calcular.
- **Matriz histórica:** estados con texto/icono además de color y leyenda visible.
- **Detalle:** información general, estado, alcance, datos técnicos, timeline;
  recursos/costos plegables. Formularios para tarea/intervención/resolución.
- **Importación:** preview, mapeos, incidencias y confirmación; no importación automática.

Tema/paleta/tipografía compartidos. Encabezado local solo con navegación/acciones
del módulo. Conservar datos durante recarga; skeleton inicial; BusyButton y
bloqueo sincrónico de submit. Mensajes accesibles para éxito/error. No volver a
agregar Actualizar datos, Guardado permanente, usuario o tema locales.

## Importación legacy (fase 7)

- Script con argumento de archivo; sin ruta Windows fija. Lectura A:AJ y hojas
  explícitas con detección/confirmación de fila cabecera. No asumir títulos/fechas
  no observados. No se recibió aquí el Excel para inspección/importación real.
- SI => COMPLETED histórico; NO => NOT_PERFORMED; P => PLANNED, nunca PARTIAL.
- -, 0, o, números y otros textos => NEEDS_REVIEW, valor original intacto. No
  clasificarlos como realizados o pendientes operativos hasta revisión.
- Un SI legacy no demuestra un detalle de subtareas: conservar evidencia a nivel
  tarea, no inventar que componentes del maestro actual se ejecutaron en 2021.
- Conservar coordenadas, cabeceras y valores originales; normalizar solamente
  equivalencias conocidas (Alta/Alto, Baja/Bajo, INOS/COSTO(S)).
- Frecuencias ambiguas se revisan, no se calculan fechas ficticias.
- Documentos como referencias; rutas internas se pueden copiar, no ejecutar;
  URLs clickeables solo con esquemas permitidos, nunca javascript/data.
- Bitácora sin asociación inequívoca queda en staging/pendiente de asociar, no en
  una segunda bitácora operacional ni mediante fuzzy matching automático.
- Reporte: tareas/ejecuciones importadas, desconocidos, faltantes, duplicados y
  bitácora por asociar. Reimportar lote confirmado no duplica historia.

## Orden y verificación

1. Este análisis/modelo (sin modificar arquitectura ni datos en ejecución).
2. Schema, migración aditiva, validaciones, servicios/router y pruebas PostgreSQL.
3. Home, dashboard, parque, detalle y CRUD.
4. Eventos, intervenciones y timeline.
5. Alcance, pendientes y resolución posterior; validación del caso del cilindro.
6. Matriz dinámica.
7. Importador y reporte con revisión previa.

Cubrir los diez casos pedidos y además: cantidades fraccionarias/resoluciones
parciales, doble resolución concurrente, evento cerrado, responsable eliminado,
rollback, cliente obsoleto 409, falta If-Match 428, datos 422, catálogo compartido,
fechas inciertas, límites julio/junio, fin de mes/bisiestos, doble importación y
segunda PC. PostgreSQL real en base `_test`, nunca limpieza de base del usuario.

Al implementar: ejecutar tests generales, `test:postgres`, `typecheck:server`,
`build`, `build:spares`; prueba de navegación/formularios y revisión de imagen
Docker. Las pruebas/builds no se han reejecutado en esta fase documental.

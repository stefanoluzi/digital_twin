# Reparaciones Taller — Mantenimiento LC1C

## Refinamiento: plan del ejercicio y calendario

La pantalla operativa inicial ahora es **Plan del ejercicio**. La navegación conserva Resumen, Plan del ejercicio, Reparaciones, Históricos y Configuración. La utilidad compartida `src/repairs/calendar.ts` determina el año de inicio: desde julio usa el año actual; de enero a junio usa el año anterior. No hay ejercicio hardcodeado. El reloj usa la fecha real en `America/Argentina/Buenos_Aires`, se reevalúa cada 30 segundos y al volver a la pestaña. Si se mantiene el ejercicio automático, pasa al siguiente cuando comienza julio; una selección histórica explícita se conserva.

`RepairCalendar.tsx` contiene selector de ejercicio, selector mensual Julio–Junio y un calendario liviano propio del módulo. Usa `Intl.DateTimeFormat` con `es-AR`, lunes primero y DD/MM/AAAA; no depende del idioma del calendario nativo del sistema operativo ni incorpora una librería spreadsheet. El calendario se posiciona en el mes de la celda, en la fecha existente o en el mes actual para un alta general.

`ExercisePlan.tsx` muestra el parque del catálogo compartido, incluso sin necesidades. Equipos sin perfil reparable se identifican y ofrecen vincularse, sin duplicarlos. Se ocultan perfiles inactivos de la carga operativa. Cabecera y cuatro columnas identificatorias son sticky, con scroll de matriz. Flechas/Tab recorren celdas; Enter/click abren; números inician cantidad; Escape cierra. La columna actual se indica con HOY y una línea, sin reemplazar colores de estado.

Una celda vacía abre un editor compacto: cantidad, fecha opcional y criticidad. Equipo/mes son implícitos y el taller usa el primero configurado. Más detalles conserva ese borrador en el modal completo. Celdas ocupadas muestran estado y acciones; múltiples necesidades del mismo equipo/mes se agregan visualmente pero permanecen separadas en detalle e historial. Las escrituras siguen usando `/api/repairs/requests` y las acciones existentes con revisión y eventos; no hay escritura local alternativa.

Migración adicional: `202609250003_repair_optional_required_date`, que solo elimina NOT NULL de `RepairRequest.requiredDate`. No transforma ni borra registros ni snapshots. Las nuevas altas/ediciones/importaciones rechazan un día exacto fuera de su mes objetivo. Datos legacy existentes se preservan; una edición de fechas incoherentes deberá corregirlas explícitamente.

Sin día exacto, la fecha límite derivada es el último día del mes. Una unidad queda vencida por Planta al día siguiente de esa fecha, o antes por un compromiso de taller vencido. El dato continúa siendo NULL: no se inventa un día en PostgreSQL.

Los KPIs del ejercicio cuentan unidades. Cumplimiento a fecha = unidades exigibles ya entregadas a hoy / unidades cuyo día exacto o cierre de mes es <= hoy. Cuenta entregas tardías ya realizadas como cumplimiento de volumen, no como puntualidad; puntualidad original/actual sigue en Históricos. Cancelaciones permanecen en el plan y nunca cuentan como entregas. Si no hay unidades exigibles se muestra —, no 0%. Los filtros afectan el resumen visible.

Históricos admite `GET /api/repairs/history?exercise=YYYY`: doce meses Julio–Junio, con fases Cerrado/En curso/Pendiente. Los meses futuros muestran lo planificado conocido pero no porcentaje de cumplimiento, entregas, vencidas ni backlog ficticio. Se mantienen los cierres basados en eventos, la fecha de primera observación y la consulta por rango anterior para compatibilidad.

Archivos del refinamiento: `calendar.ts`, `RepairCalendar.tsx`, `ExercisePlan.tsx`, `RepairsApp.tsx`, `RepairHistory.tsx`, `RepairImport.tsx`, `domain.ts`, `types.ts`, `repairs.css`, router de reparaciones, schema/migración y tests de calendario/dominio/PostgreSQL. Las secciones siguientes describen la implementación inicial; ante diferencias de fecha obligatoria/período inicial, prevalecen las reglas de esta sección.

Validación del refinamiento: 199 tests generales y 35 PostgreSQL; typecheck servidor y builds general/plataforma aprobados. Prueba en navegador con base de pruebas: alta de 2 unidades sin fecha en Marzo, persistencia tras reiniciar, inicio, entrega parcial 1/2, teclado hacia Abril y Más detalles precompletado. Calendario en español/Lunes primero y futuro pendiente en Históricos verificados. Revisado a 1366/1600/1920. Las fixtures se retiraron de la base de pruebas; la base real no recibió datos ficticios. Se conserva el aviso preexistente de chunks grandes del build general.

El cierre histórico de cada día se convierte desde el huso horario argentino a UTC mediante `businessDayEnd`, evitando perder eventos registrados después de medianoche UTC pero antes de medianoche local. Se agregó una regresión específica para ese límite.

## Integración y arquitectura

Módulo integrado en `/reparaciones-taller`, accesible desde el inicio de la plataforma. No es otra aplicación ni utiliza una base separada en producción. React/TypeScript consume Express/Prisma sobre el PostgreSQL existente. Reutiliza los catálogos `Equipment`, `Area`, `Responsible` y `AppUser`, la navegación de plataforma, las clases y tokens visuales de Repuestos Críticos, su tipografía y preferencia de tema. Los gráficos usan Recharts, ya instalado.

Vistas: Dashboard, Plan mensual, Reparaciones, Históricos y Configuración. La matriz inicial cubre julio de 2026 a junio de 2027; el inicio del período es editable y genera doce meses dinámicos. Los filtros permiten área, rubro, mes, estado, criticidad, responsable del bloqueo, taller, GMB, vencidas y búsqueda IDREP/descripción.

La API y PostgreSQL son la fuente de verdad. No hay fallback a IndexedDB/localStorage para datos. El frontend aplica la respuesta confirmada del servidor; los errores conservan el formulario y se muestran al usuario. El tema visual sí conserva la preferencia existente del navegador.

## Modelo y migración

Migración aditiva: `prisma/migrations/202609250002_workshop_repairs/migration.sql`. Deben desplegarse todas las migraciones pendientes en orden, incluida la anterior de históricos de cobertura si corresponde.

| Entidad | Función |
| --- | --- |
| RepairEquipmentProfile | Extensión 1:1 del equipo compartido: IDREP único, sector, rubro, activo. |
| RepairConfig | Revisión, días de aviso crítico, talleres y categorías de bloqueo configurables. |
| RepairRequest | Necesidad, cantidad, mes objetivo, fecha de Planta, criticidad, GMB opcional, taller y notas. |
| RepairItem | Unidad individual, ordinal único dentro de la necesidad, estado y fechas de envío/inicio. |
| RepairCommitment | Compromisos por unidad, secuencia append-only, motivo, usuario y fecha de registro. |
| RepairBlock | Episodios de bloqueo, responsabilidad, categoría, descripción, inicio, resolución y duración. |
| RepairDelivery | Entrega real única por unidad. |
| RepairEvent | Evento con datos de la acción y snapshot completo de la necesidad para reconstrucción histórica. |

Fechas de negocio son `DATE`; el mes se almacena como primer día del mes, nunca como columnas por mes. Los eventos conservan timestamps de registro. Hay índices de consulta, FK restrictivas, restricciones de cantidades/estados y un índice único parcial que impide dos bloqueos abiertos para una unidad.

## Endpoints

Prefijo `/api/repairs`:

- `GET /state`: configuración, catálogos y necesidades con unidades.
- `GET /requests/:id/events`: timeline completo.
- `GET /history?from=YYYY-MM-DD&until=YYYY-MM-DD`: métricas y cierres mensuales, máximo diez años y sin fechas futuras.
- `POST /equipment`: crear equipo compartido o vincular/actualizar su perfil de taller. No sobrescribe nombre/área de un equipo existente.
- `PUT /config`: talleres, categorías y ventana de aviso.
- `POST /requests`: crear necesidad y sus N unidades.
- `PUT /requests/:id`: editar fechas, criticidad, asignación y notas, con motivo obligatorio.
- `POST /requests/:id/actions`: `START`, `SENT`, `COMMIT`, `BLOCK`, `RESOLVE`, `DELIVER`, `CANCEL`, `COMMENT`.
- `POST /import`: lote legacy revisado y confirmado.

Escrituras requieren `If-Match: <revision>` y usan `X-Actor-Id` conforme al patrón de la plataforma. Falta de revisión: 428; conflicto concurrente: 409; validación: 422. Se bloquea la revisión compartida antes de la revisión del módulo, dentro de una transacción. Altas/vínculos de equipos e importación también avanzan la revisión del catálogo compartido para invalidar ediciones viejas. Acciones sobre varias unidades son atómicas: si falla una, se revierte todo el lote.

## Reglas funcionales

- Crear cantidad N genera N unidades; se pueden seleccionar una, varias o todas al actuar. Entregar una de tres muestra `1/3`, no marca toda la necesidad entregada.
- Estados almacenados: planificada, en curso, bloqueada, entregada, cancelada. Vencida se calcula por fecha, no necesita cron ni escritura diaria.
- Se distinguen atraso contra compromiso del taller y contra necesidad de Planta. Compromiso posterior a necesidad se advierte incluso antes de vencer.
- Bloqueada y vencida pueden coexistir. La matriz conserva una franja de estados mixtos y un detalle por unidad.
- Reprogramar agrega una fecha con motivo; original y actual nunca se confunden. Los desvíos firmados negativos representan anticipación.
- Resolver un bloqueo conserva el episodio, su duración y el usuario; recupera el estado anterior. No permite entregar con bloqueo abierto. Cancelar cierra el bloqueo sin inventar entrega ni borrar historia.
- Se valida la cronología de envío, inicio, bloqueos, resolución y entrega. Fechas reales no pueden ser futuras, pero pueden registrarse retroactivamente. El evento conserva la fecha real de registro: no fabrica conocimiento anterior.
- Criticidad alta/crítica requiere motivo. Se incluyen motivos sugeridos; la fecha crítica y la condición inamovible son explícitas. La ventana de riesgo es configurable (inicial siete días).
- La cantidad y el equipo de una necesidad ya creada son inmutables para conservar identidad de sus unidades. Para corregir alcance, cancelar unidades justificadamente y crear otra necesidad.

## Históricos y cumplimiento

Los cierres mensuales se reconstruyen con el último snapshot registrado antes de cada cierre. Los meses anteriores a la primera observación aparecen sin datos, no como ceros inventados. Se conserva nombre, área, asignación y estado conocidos en aquel momento.

El plan cuenta unidades cuyo mes objetivo pertenece al período. El cumplimiento del plan es la parte de esa cohorte entregada al cierre. Las entregas efectivas del período son otra métrica: pueden pertenecer a planes de otros meses. Las canceladas no se convierten en entregadas ni desaparecen del denominador del plan registrado.

El cumplimiento de fechas compara entregas reales contra el compromiso original y el vigente por separado. Solo entran entregas con compromiso conocido; se informa el denominador. Media y mediana de atraso incluyen cero para entregas en fecha y no descuentan anticipaciones de otros atrasos.

Los bloqueos se presentan por Planta, Taller, Compras, Ingeniería, Externo y Otro. Su duración es días calendario transcurridos (mismo día = 0); la suma de varias unidades es **días-unidad**, no días únicos de calendario. Se recorta al período consultado. No se culpa automáticamente al Taller por bloqueos externos ni se resta todo bloqueo de su compromiso: los indicadores son brutos y la causalidad/SLA ajustado requiere reglas de negocio futuras.

## Excel legacy: revisión antes de importar

Se analizó `Template_Reparaciones_CRONOGRAMA.xlsx`, hoja `Reparaciones`: 607 filas de equipos; 128 corresponden a LC1C. La extracción LC1C detectó 123 necesidades/unidades potenciales. Tres celdas contienen `Cruceta` y una `N/A`: se reportan como ambiguas, no se convierten en cantidades. Solo el encabezado Septiembre 2026 trae año explícito. Las celdas mensuales no tienen rellenos de estado ni formato condicional: no existe evidencia confiable para deducir entregas/bloqueos por color en este archivo.

1. Instalar Python y `openpyxl` en el entorno que preparará el archivo (no requerido por la aplicación): `python -m pip install openpyxl`.
2. Ejecutar `python scripts/prepare-repairs-import.py "Template_Reparaciones_CRONOGRAMA.xlsx" "reparaciones-revisar.json" --sector LC1C`.
3. Revisar los avisos. Completar por fila `area` desde el catálogo compartido, `targetMonth` con año confirmado y día 01, `requiredDate` concreta y `workshop` válido. Revisar IDREP, descripción, rubro y cantidades. `X`/`x` equivale a 1; enteros positivos son cantidades. No inferir área desde rubro ni inventar fechas.
4. En Reparaciones Taller → Configuración → Importar lote revisado, elegir el JSON. Revisar el resumen, confirmar el lote y guardar. La UI envía `confirmed: true` solamente después de la confirmación.
5. La API valida todo y crea necesidades **planificadas**. Una falla revierte el lote completo. El mismo contenido ordenado se reconoce por hash y se rechaza si ya fue importado; modificar/reordenar un lote no constituye un mecanismo general de deduplicación, por lo que el operador debe revisar cargas repetidas.

Límites: 1.000 unidades por necesidad; 1.000 filas y 2.000 unidades por lote. El borrador analizado está en `tmp/repairs-review-lc1c.json`, ignorado por Git. **No se importaron esos datos a la base real.** El script no conecta a PostgreSQL ni modifica el Excel.

## Archivos principales

- `src/repairs/RepairsApp.tsx`: shell, dashboard, tabla, matriz, detalle, formularios y configuración.
- `src/repairs/RepairHistory.tsx`: métricas y gráficos históricos.
- `src/repairs/RepairImport.tsx`: revisión y envío del lote legacy.
- `src/repairs/domain.ts`, `types.ts`: contratos y cálculo compartido de estados/métricas.
- `src/repairs/repository.ts`: cliente API y revisión.
- `src/repairs/repairs.css`: estilos acotados al módulo; reutiliza `criticalSpares.css`.
- `server/repairs/router.ts`: validación, transacciones y persistencia.
- `server/app.ts`, `server/index.ts`: montaje API e inicialización idempotente.
- `src/platform/MaintenancePlatform.tsx`: ruta, breadcrumb y acceso integrado.
- `prisma/schema.prisma`, migración mencionada y `Dockerfile`: datos y empaquetado.
- `tests/repairs.test.ts`, `tests/server/repairs.test.ts`: pruebas unitarias y PostgreSQL real.

## Operación, validación y límites actuales

Despliegue con la infraestructura existente: generar Prisma, aplicar migraciones y reconstruir/reiniciar la app. El Dockerfile incluye `src/repairs` porque el servidor reutiliza los contratos/cálculos TypeScript.

Comandos de validación: `npm test`, `npm run test:postgres` (solo base cuyo nombre termine en `_test`), `npm run typecheck:server`, `npm run build`, `npm run build:spares`.

Resultado al entregar: 185 tests generales aprobados y 34 tests PostgreSQL aprobados (27 unitarios y 10 PostgreSQL del nuevo módulo). Typecheck del servidor, build general y build de plataforma aprobados. El build general conserva el aviso no bloqueante de chunks mayores a 500 kB.

Además de los tests automatizados, se probó en navegador contra PostgreSQL de pruebas: vincular equipo, crear tres unidades, comprometer fecha, iniciar, entregar una, bloquear dos por Planta, resolverlas, ver matriz y métricas. No se mezcló esa prueba con los datos del usuario.

El backup completo es el backup PostgreSQL existente (`pg_dump`); incluye todas estas tablas. El respaldo JSON específico de Repuestos no respalda Reparaciones. Antes de aplicar la migración local se guardó `tmp/pre-repairs-20260925.dump` (ignorado por Git).

Limitaciones heredadas/explicitas: selección de usuario y `X-Actor-Id` son auditoría declarada, **no autenticación/autorización real**. No exponer la aplicación a Internet sin resolver acceso. No se agregó infraestructura, adjuntos, SLA ajustado, importación automática de estados sin evidencia ni datos históricos ficticios. El endpoint de estado y la reconstrucción histórica cargan conjuntos completos; para volúmenes grandes conviene paginación y agregación/materialización futura. Fechas de negocio y cálculos usan días UTC para evitar desplazamientos; revisar la política de corte de día antes de operación en otros husos horarios.
# Refinamiento operativo (25/09/2026)

- Selector visible en el popup de la matriz, detalle y fichas por unidad. Guarda por API, espera la respuesta transaccional y actualiza la matriz sin recarga.
- Estados persistidos: PENDING, IN_PROGRESS, BLOCKED, DELIVERED y CANCELLED. La migración `202609250004_repair_pending_status` renombra PLANNED en los registros vigentes y el estado previo de los bloqueos; NO modifica snapshots históricos. El lector histórico normaliza el nombre legacy en memoria.
- El selector pide inicio editable (hoy por defecto); bloqueo con responsable/motivo configurado/comentario/fecha; entrega con cantidad y selección de unidades; cancelación con motivo. Volver a pendiente no exige datos adicionales. Reanudar una bloqueada cierra su bloqueo con comentario, conserva el inicio original y registra el cambio.
- Cambios masivos: todas las unidades elegibles o selección explícita. Entregadas y canceladas son inmutables por este flujo; la API también las rechaza atómicamente. Para entregar una bloqueada primero hay que resolverla.
- Estado operativo y cumplimiento se muestran separados. Colores calculados: vencida > bloqueada > en curso > completamente entregada > pendiente. Los días de atraso consideran tanto necesidad como compromiso.
- Detalle operativo con planificación, criticidad, bloqueos, fichas compactas y timeline legible; sin JSON, UUID ni propiedades técnicas. El evento conserva snapshot completo y transiciones por ordinal, estado anterior/nuevo, usuario, fecha y datos asociados.
- Componentes: `RepairStatusControl.tsx`, `RepairDetail.tsx`, `presentation.ts`, integrados en `RepairsApp.tsx` y `ExercisePlan.tsx`. PostgreSQL sigue siendo la fuente de verdad.

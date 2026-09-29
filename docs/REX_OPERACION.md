# Tareas Globales REX — MVP operacional

Incluido en el despliegue de la plataforma. Esta guía describe lo que existe, a diferencia
de `TAREAS_GLOBALES_REX.md`, que conserva la propuesta general y fases futuras.

## Alcance

- Home → Tareas Globales REX: `/tareas-globales-rex`.
- Resumen, Parque de tareas (25 filas por página), Pendientes y Eventos.
- Alta/edición/inactivación de tareas, alcance ordenable, referencias documentales,
  datos técnicos y recursos/costos secundarios.
- Crear eventos con fechas opcionales. Julio–junio; sin fecha ni ejercicio
  explícito, el ejercicio queda desconocido.
- Planificar una intervención, luego confirmar su resultado desde el historial;
  o registrar directamente un resultado. El backend calcula completo/parcial/no
  realizado, valida cantidades y exige motivo para obligatorios incompletos.
- Pendientes heredados, resoluciones totales o parciales y timeline con origen.
- PostgreSQL único; misma API, AppShell, tema y calendario español. Sin datos demo
  automáticos, importación Excel, matriz histórica, auth o integración con Taller.

## Archivos

- `prisma/schema.prisma`, `prisma/migrations/202609280001_rex_tasks/migration.sql`:
  nueve tablas relacionales nuevas, FKs restrictivas, índices y restricciones de cantidad.
- `server/rex/router.ts`, `server/rex/validation.ts`: transacciones, Zod, API y auditoría.
- `server/app.ts`, `server/index.ts`: registro e inicialización del módulo.
- `src/rex/{types,domain,repository}.ts`: contratos, ciclos e interfaz HTTP.
- `src/rex/{RexApp,RexForms}.tsx`, `src/rex/rex.css`: vistas y formularios.
- `src/platform/MaintenancePlatform.tsx`: entrada integrada/lazy load.
- `Dockerfile`: incluye código REX requerido por backend en imagen final.
- `tests/rexDomain.test.ts`, `tests/server/rex.test.ts`: pruebas de dominio y PostgreSQL.

## API implementada

### Estimación de recursos (29/09/2026)

- Acción local **Configuración REX**: jornada (9 h por defecto), tarifa explícita
  (inicialmente sin definir) y moneda (USD). `PUT /api/rex/config`, con If-Match.
- En Recursos y costos se ingresan días (hasta 3 decimales, coma o punto), personas
  MEC/ELE enteras y MRO/Servicios/Labor propia monetarios. Sin separadores de miles.
- `src/rex/estimation.ts` usa Decimal compartido por navegador y servidor. El API
  recibe únicamente entradas; rechaza totales/tarifas suministrados en `estimate`.
- HH = días × jornada × (MEC + ELE). MOA se redondea half-up a 2 decimales;
  total = MRO + MOA + Servicios + Labor propia. Servicios excluye la MOA calculada.
- Migración aditiva `202609290001_rex_estimates`: configuración y `RexEstimate`
  con columnas DECIMAL y restricciones de consistencia. Cada reestimación agrega
  una versión, no sobrescribe la anterior. El maestro muestra la más reciente.
- Editar solo nombre/alcance no cambia la estimación. Editar recursos o pulsar
  **Reestimar con configuración vigente** crea una estimación con parámetros actuales.
- Cada intervención nueva calcula su estimación con configuración vigente y la
  congela en `taskSnapshot.estimate`; finalizar una planificación conserva su snapshot.
  Es estimación del alcance completo, no gasto ejecutado ni costo prorrateado por avance.
- Cambiar moneda no convierte importes: revisarlos explícitamente antes de reestimar.
- `resources` legacy permanece intacto y visible en un desplegable separado. No se
  recalcula, suma a la estimación ni convierte automáticamente. Intervenciones antiguas
  sin estimación permanecen sin estimación. Resolver pendientes no duplica el costo total.
- Versiones anteriores del maestro se conservan en PostgreSQL/AuditLog; no se agregó
  todavía un explorador específico de versiones de estimación.
- UI: `src/rex/RexEstimate.tsx`; tests: `tests/rexEstimation.test.ts` y los casos
  adicionales de `tests/server/rex.test.ts` (PostgreSQL real, segundo cliente, snapshots,
  rollback, entradas adulteradas y cambios de tarifa).

Todas las rutas debajo de `/api/rex`:

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/state` | Snapshot consistente, revisión, catálogos, tareas, eventos, intervenciones y saldos. |
| POST | `/tasks` | Crear tarea, alcance y documentos. |
| PUT | `/tasks/:id` | Editar/inactivar maestro, archivar actividades retiradas. |
| GET | `/tasks/:id/history?page=0` | Hasta 50 intervenciones por página (orden de registro). |
| POST | `/events` | Crear ventana. |
| PUT | `/events/:id` | Editar/cerrar ventana sin cerrar pendientes. |
| POST | `/executions` | Modo PLAN o RESULT; snapshot del alcance. |
| POST | `/executions/:id/finalize` | Confirmar resultado de una planificación una sola vez. |
| POST | `/pending/:id/resolutions` | Crear nueva intervención y aplicar cantidad al pendiente atómicamente. |

Escrituras con `If-Match` y actor declarado `X-Actor-Id`; 428 sin revisión,
409 si quedó obsoleta, 422 si los datos son inválidos. La respuesta incluye la
nueva revisión. Nunca sobrescribir una ejecución con resultado confirmado.

## Decisiones MVP

- Auditoría append-only en `AuditLog` existente: snapshots del maestro,
  planificación, confirmación de resultado y resolución. No se añade otro
  sistema de versiones. Las ejecuciones confirmadas son inmutables; un editor de
  correcciones auditadas queda fuera de esta primera versión.
- El saldo se deriva con Decimal de origen menos resoluciones; no almacenar un
  booleano que pueda contradecir las cantidades. No se permite sobrerresolver.
- Resolver un componente produce `PENDING_RESOLUTION + COMPLETED`, no una
  ejecución completa del conjunto. El origen sigue PARTIAL.
- Solo `FULL_TASK + COMPLETED` reinicia frecuencia. Si hay una completa sin fecha
  exacta, se informa incertidumbre y no se inventa próximo vencimiento.
- Para fecha desconocida se muestra evento. Resoluciones se ordenan después de
  su origen por el vínculo explícito; para otros registros inciertos se usa orden
  de registro, sin presentar esa fecha como fecha de ejecución.
- Toda omisión confirmada queda visible, incluidas actividades opcionales; estas
  últimas no impiden completar el alcance obligatorio.
- Catálogos compartidos leídos desde la API; no se crean áreas/equipos ni GMB en
  paralelo. Si no hay áreas, configurarlas en Repuestos antes del alta REX.
- En este MVP `/state` carga un snapshot completo siguiendo el patrón actual de
  Taller. La tabla pagina la presentación; antes de escalar mucho más allá de
  200–300 tareas y muchos años de historial, paginar consultas/filtrar en servidor.
- Sin índice único artificial tarea/evento: pueden existir varias intervenciones
  de una tarea en una misma ventana.
- La API permite registrar un resultado histórico en evento cerrado; cerrarlo no
  equivale a bloquear la carga retrospectiva ni a saldar sus pendientes.

## Arranque local

Requisitos: Node compatible con el proyecto, dependencias instaladas y PostgreSQL
en ejecución. `.env` debe tener `DATABASE_URL` apuntando a la base que corresponda.
No utilizar reset, db push ni una base de producción para tests.

```powershell
npm ci
npm run db:generate
npm run db:migrate
npm run build:spares
npm run start:server
```

Si ya corre `start:server`, detener solamente ese proceso antes de regenerar Prisma
en Windows (la DLL está en uso), y reiniciarlo al terminar.

Abrir `http://127.0.0.1:3001/tareas-globales-rex`. La ejecución local preparada
usa PostgreSQL portable en 127.0.0.1:55432 y la base de desarrollo existente.

En una instalación con Docker, el flujo existente sigue siendo:

```sh
docker compose up -d --build
docker compose ps
docker compose logs --tail=80 app
```

El contenedor aplica migraciones con el script existente. No se agregan servicios,
puertos ni volúmenes. Se actualizó la imagen, pero su ejecución requiere validación
en una máquina con Docker: esta PC no dispone de Docker Engine.

Respaldo: usar el backup completo PostgreSQL (`pg_dump` / scripts de backup del
proyecto). El JSON de respaldo específico de Repuestos no incluye las tablas REX.

## Prueba manual del cilindro

1. Home → **Tareas Globales REX** → **Nueva tarea**.
2. Nombre **Cambio conjunto transferidor**, área **LCO**, periódica **24 meses**.
3. Agregar cuatro actividades obligatorias, cantidad 1: Estructura, Reductor,
   Acoplamiento y Cilindro hidráulico. Guardar.
4. **Eventos → Nuevo evento**: **REX Abril/Mayo 2026**, tipo REX. Las fechas pueden
   quedar vacías. Guardar.
5. **Parque de tareas → Cambio conjunto transferidor → Registrar intervención**.
6. Elegir ese REX y operación **Registrar resultado**. Marcar completas las primeras
   tres actividades. Cilindro: realizado 0, motivo **Taller**, observación
   **Taller no llegó con la reparación**. Confirmar.
7. Ver **Parcial** y el pendiente del cilindro. En **Eventos**, cerrar el REX.
   Volver a **Pendientes**: sigue abierto. Cerrar/reabrir la pestaña: sigue abierto.
8. **Registrar resolución**: calendario 18/08/2026, cantidad 1, fuera de parada,
   observación **Cilindro hidráulico reemplazado**. Confirmar.
9. Ya no aparece entre abiertos. **Incluir resueltos** permite verlo con saldo 0.
10. **Ver tarea**: la resolución tiene vínculo al origen y el REX original sigue
    **Parcial, 3/4**. No hay una ejecución completa del conjunto ni reinicio de ciclo.

Para probar planificación: registrar otra intervención con **Planificar intervención**;
editar el alcance maestro; abrir el historial y **Registrar resultado** de aquella
planificación. Debe conservar su alcance anterior.

## Verificación

```powershell
npm test
npm run test:postgres
npm run typecheck:server
npm run build
npm run build:spares
```

`test:postgres` exige `TEST_DATABASE_URL` con nombre terminado en `_test`. Sus fixtures
no van a la base del usuario. La prueba manual de UI también se realiza en una
instancia temporal 3002 contra `_test`, no cargando demos en 3001.

No se implementa `seed:rex-demo`: no es necesario para usar el módulo ni para ejecutar
la suite. No se modifica IndexedDB ni se migra contenido local previo.

### Resultado verificado el 28/09/2026

Actualización del estimador, 29/09/2026: 230 tests generales y 51 tests PostgreSQL
(13 REX) aprobados. Typecheck servidor, build general y build:spares correctos.
Navegador contra `_test`: alta con 3 días, MEC 12/ELE 1; 351 HH y USD 45.275;
MEC 14 actualiza inmediatamente a 405 HH y USD 46.625; guardar y recargar
conserva el cálculo. Valores verificados directamente en PostgreSQL. Fixture QA
retirado al finalizar, sin cargar ejemplos ni tarifa ficticia en la base de trabajo.
La tarifa de desarrollo continúa sin definir; jornada 9 h/día. API 3001 healthy.

- `npm test`: 226 aprobados; 49 de servidor omitidos aquí y ejecutados por separado.
- `npm run test:postgres`: 49 aprobados contra PostgreSQL real, incluidos 11 REX.
- Nuevos tests: 9 de dominio/validación + 11 API/PostgreSQL.
- `typecheck:server`, `build` y `build:spares`: correctos. El build principal
  conserva su advertencia de chunks mayores a 500 kB.
- Navegador: alta de tarea con cuatro actividades, evento sin fecha ficticia,
  resultado 3/4, cierre/reapertura de pestaña, persistencia del pendiente,
  resolución 18/08/2026, saldo cero e historial parcial conservado. Temas claro y oscuro.
- Cierre de evento y conservación del pendiente, cambio de maestro sin cambiar
  snapshot, cliente independiente y concurrencia cubiertos por tests PostgreSQL.
- Pruebas manuales ejecutadas en `_test`; fixtures retirados al terminar.
  La base local de desarrollo queda con cero tareas REX y sus módulos previos intactos.
- API local 3001 responde healthy con PostgreSQL. No se hizo commit ni push.

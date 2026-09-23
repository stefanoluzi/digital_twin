# Repuestos Críticos centralizados

## Arquitectura

Navegadores → frontend React existente → `/api` (Express/Node) → Prisma → PostgreSQL.
En producción un único contenedor `app` sirve frontend compilado y API; otro contenedor
`postgres` usa un volumen persistente. No se necesita otro servidor Node ni modificar
los servicios existentes de la VM. El puerto externo predeterminado es **8080**.

Solo Repuestos Críticos cambió de persistencia. Planner, Acoplamientos y Digital Twin
conservan sus mecanismos actuales. La rama estática portable antigua **no** es el nuevo
despliegue centralizado; descargar solo `dist-spares` ya no alcanza para este módulo.

### Modelo y concurrencia

- GMB → Área → Repuesto; nunca FK GMB directamente en cada repuesto.
- `SpareEquipment` implementa equipos compatibles N:M. `Unit` representa stock físico.
- Cobertura se sigue calculando en el dominio: WAREHOUSE/MACHINE_SIDE son disponibles.
  No se inventaron campos de criticidad ni stock mínimo que no existían en el modelo.
- IDs, fechas originales, campos opcionales, comentarios, fotos/PDF y movimientos se
  conservan. Las fechas se almacenan como strings validados para mantener el formato.
- `History.unitId` y `History.equipmentId` son referencias históricas, no FKs que
  obliguen a borrar eventos cuando desaparezca una unidad/equipo. El borrado de un
  repuesto elimina sus movimientos como hacía la app; `audit_log` no se elimina.
- SAP no tenía unicidad en el módulo anterior: se permiten varios registros con el
  mismo SAP (por ejemplo distintas áreas). Sí se rechazan IDs y vínculos duplicados.
- Cada lectura consistente devuelve `revision`. Cada escritura exige `If-Match`.
  Una transacción bloquea la fila `Revision`, valida la versión, escribe y audita.
  Conflicto: HTTP 409, sin cambios parciales ni reintento automático. Actualizar datos,
  revisar el borrador y volver a guardar. La revisión es global (conservadora): incluso
  cambios en distintos repuestos pueden requerir refrescar.
- No hay autosave del snapshot desde el navegador ni fallback local silencioso.
  La UI solo aplica respuestas confirmadas; errores quedan visibles y no cierran el editor.
- Otra PC ve los cambios al abrir, recargar o pulsar **Actualizar datos**. No hay push
  en tiempo real ni polling que cambie un formulario mientras se edita.

## Levantar en la VM con Docker

Requiere Docker Engine/Desktop con Compose v2 y permiso para ejecutar contenedores Linux.
Descargar el código de **codex/editor-upgrades**, no el ZIP de la rama portable antigua.

```sh
git clone --single-branch --branch codex/editor-upgrades https://github.com/stefanoluzi/digital_twin.git
cd digital_twin
cp .env.example .env
# Editar .env: elegir contraseña real y un APP_PORT libre.
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app
```

En PowerShell usar `Copy-Item .env.example .env` en lugar de `cp` si se prefiere.
Abrir `http://IP_DE_LA_VM:8080`. El arranque ejecuta `prisma migrate deploy` antes
de iniciar la API. Una instalación nueva está **vacía**, con áreas y usuario local;
no crea repuestos de demostración ni importa automáticamente datos de una PC.

No detener, reemplazar ni reiniciar el otro servidor Node. Elegir otro `APP_PORT`
si 8080 está ocupado. No se usa `network_mode: host`, ni se publica el puerto 5432.
Restringir el firewall al puerto elegido y a las PCs autorizadas de la red interna.
Para actualizar: hacer backup, `git pull --ff-only`, `docker compose up -d --build`.
**Nunca ejecutar `docker compose down -v` en producción**: borra el volumen.

### Variables

| Variable | Uso |
| --- | --- |
| POSTGRES_DB | Nombre de DB (por defecto critical_spares) |
| POSTGRES_USER | Usuario DB (por defecto spares) |
| POSTGRES_PASSWORD | Obligatoria; reemplazar el ejemplo antes de iniciar |
| APP_PORT | Puerto publicado de app, por defecto 8080 |
| APP_BIND_ADDRESS | Opcional; interfaz VM, por defecto 0.0.0.0 |
| DATABASE_URL | Solo ejecución nativa: URL PostgreSQL; en Docker se construye internamente con credenciales codificadas |
| HOST / PORT | API nativa, por defecto 127.0.0.1:3001 |
| STATIC_DIR | Frontend compilado, por defecto dist-spares |
| TEST_DATABASE_URL | Exclusivamente tests; el nombre de DB debe terminar en `_test` |

`.env` está ignorado por Git y excluido del contexto Docker. El password debe ser
fuerte; no usar el placeholder. No cambiar POSTGRES_PASSWORD en un volumen existente
esperando que rote automáticamente la contraseña de PostgreSQL.

## Desarrollo sin Docker

Usar Node 24 y PostgreSQL 16. Crear una DB propia vacía (no la de producción).

```sh
npm ci
npm run db:generate
# Configurar DATABASE_URL en .env
npm run db:migrate
npm run dev:server
# En otra terminal:
npm run dev:spares
```

Frontend `http://127.0.0.1:5176`; proxy `/api` → `127.0.0.1:3001`.
La aplicación madre (`npm run dev`) tiene el mismo proxy. No se necesita CORS.
Para servir el build nativamente: `npm run build:spares` y `npm run start:server`.

Crear una migración únicamente contra DB de desarrollo:

```sh
npm run db:migrate:dev -- --name descripcion_del_cambio
npm run db:generate
```

Versionar SQL generado y schema. Producción usa `migrate deploy`, nunca `db push`
ni `migrate reset`.

## Migrar los datos que ya están en IndexedDB

1. **No borrar caché, datos del sitio ni el perfil del navegador.** Abrir el mismo
   navegador/origen que contenía los datos, por ejemplo `http://127.0.0.1:5176`.
2. Descargar desde Configuración **Descargar respaldo local anterior (IndexedDB)**.
   También está disponible en la pantalla de error si la API todavía no funciona.
   Es una lectura `readonly` del snapshot `active`, sin normalización ni escritura.
   Un origen distinto (IP de VM, localhost vs 127.0.0.1, otro puerto) no tiene acceso
   a esa IndexedDB: volver al origen original para exportar.
3. Conservar ese archivo original fuera de la VM. No editarlo en su lugar.
4. Abrir la aplicación centralizada, Configuración → **Importar**, seleccionar JSON.
   Se valida en cliente y otra vez en servidor. La confirmación indica que reemplaza
   información compartida para todos. Exportar antes los datos centrales si ya existen.
5. Se aceptan envelopes `LACO1_CRITICAL_SPARES` v1/v2. v1 migra responsabilidad por
   área solo si es inequívoca. Datos incompletos, IDs duplicados, referencias inválidas,
   fechas corruptas o áreas con repuestos sin GMB activo bloquean la importación.
   Ante ambigüedad, corregir asignaciones en la app antigua y exportar de nuevo, o
   corregir una **copia** del JSON revisando el diagnóstico. Nunca se inventa un GMB.
6. La importación reemplaza las tablas operativas dentro de una transacción; conserva
   la auditoría central previa. Si falla, rollback completo. IndexedDB permanece intacta.
7. Comparar cantidades, SAP, unidades, historial y adjuntos; abrir desde una segunda PC.
   Solo después considerar retirar la instancia antigua. Evitar seguir cargando en ella.

**Exportar respaldo** ahora consulta PostgreSQL, no el estado potencialmente viejo de
la pestaña. Mantiene el JSON v2 compatible con el dominio anterior. Este JSON no incluye
auditoría central, ni preferencias locales de tema/filtros/geometría; para recuperación
completa del servidor usar `pg_dump`.

## Comprobar datos y API

```sh
curl http://127.0.0.1:8080/api/health
curl http://127.0.0.1:8080/api/spares
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Dentro de psql:

```sql
SELECT count(*) FROM "Spare";
SELECT count(*) FROM "Unit";
SELECT a.code, r.name FROM "Area" a LEFT JOIN "Responsible" r ON r.id = a."responsibleGmbId";
SELECT "user", entity, "entityId", action, field, "oldValue", "newValue", "createdAt"
FROM audit_log ORDER BY "createdAt" DESC LIMIT 20;
```

### Contrato REST

- GET `/api/state` → `{data, revision}` consistente; GET `/api/backup` → JSON v2.
- GET `/api/spares`, `/api/spares/:id`, `/api/units`, `/api/areas`, `/api/responsibles`, `/api/equipment`.
- POST `/api/spares`, PUT/DELETE `/api/spares/:id`.
- POST `/api/units` (incluye `spareTypeId`), PUT/DELETE `/api/units/:id`.
- PUT `/api/config`: catálogo de áreas/GMB/equipos/categorías/usuarios, acorde al flujo
  existente de la UI. Se valida el catálogo contra todos los repuestos/unidades.
- POST `/api/import`: envelope JSON; transaccional, reemplaza los datos operativos.
- GET `/api/audit?entityId=...&cursor=...`: páginas de 100, con `nextCursor`.
- Escrituras: `If-Match: <revision>` y opcional `X-Actor-Id`. 422 validación; 409 conflicto;
  428 falta revisión; 413 más de 100 MB; 503 DB no disponible. No expone SQL/credenciales.

## Backups de PostgreSQL y restauración

Linux/VM (desde la raíz; usar `sh` evita depender del bit ejecutable de Git):

```sh
sh scripts/backup-db.sh
# Copiar el .dump generado a OTRA máquina / almacenamiento de respaldo.
# Antes de restaurar, guardar también un backup del estado actual.
sh scripts/restore-db.sh backups/critical-spares-FECHA.dump --confirm-replace
```

El backup usa formato custom `pg_dump -Fc`, es consistente y no requiere parar la app.
El restore verifica la cabecera, detiene **solo app de este Compose**, restaura en una
transacción con `--clean --if-exists --single-transaction --exit-on-error` y levanta app.
Ante error deja app detenida; revisar logs y no borrar volúmenes. No afecta otros proyectos.

Windows/PowerShell: para evitar corromper un dump binario por redirección en versiones
viejas de PowerShell, generar dentro del contenedor y copiarlo:

```powershell
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/spares.dump'
docker compose cp postgres:/tmp/spares.dump ./spares.dump
# Restauración DESTRUCTIVA del estado actual; primero hacer backup:
docker compose cp ./spares.dump postgres:/tmp/restore.dump
docker compose stop app
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error /tmp/restore.dump'
# SOLO si el comando anterior terminó correctamente:
docker compose up -d app
```

Los dumps contienen datos privados y adjuntos. Proteger permisos, mantener varias
generaciones fuera de la VM y probar regularmente restauración en otra DB.

## Tests y límites conocidos

```sh
npm test
npm run typecheck:server
npm run build
npm run build:spares
# Crear previamente una DB vacía exclusiva, por ejemplo critical_spares_test.
# Configurar TEST_DATABASE_URL, sin usar producción:
npm run test:postgres
```

La suite general omite intencionalmente los tests destructivos de PostgreSQL. El comando
`test:postgres` exige una base cuyo nombre termina en `_test`, aplica migraciones y
ejecuta CRUD, relaciones, A→DB→B, concurrencia, backup y rollback real (trigger temporal
que falla en auditoría después de escribir datos). No hay script lint en el proyecto.

Validación del 23/09/2026: **130 tests generales + 8 tests PostgreSQL aprobados**,
TypeScript y ambos builds correctos. Se probó pg_dump/restore a otra base y se recuperaron
6 repuestos, 9 unidades y la auditoría de prueba. En navegador se verificaron dashboard,
alta, edición, búsqueda y recarga; el diálogo automatizado del borrado se bloqueó,
por lo que ese paso manual no se cuenta como aprobado (sí pasó el test API/DB).

Limitaciones deliberadas:

- Sin autenticación real: `X-Actor-Id`/selector local es identidad declarada y falsificable,
  no un permiso de seguridad. Roles de UI no sustituyen autorización. Solo red interna
  confiable/firewall; **no exponer a Internet**. Añadir autenticación/HTTPS antes de ampliar acceso.
- Revisión global, snapshot de lectura completo y validación completa por escritura;
  adecuados para el volumen actual, no optimizados para catálogos enormes.
- Fotos/PDF siguen en data URLs; límite request 100 MB, imagen individual 20 MB y PDF
  40 MB de texto base64. La auditoría de adjuntos conserva hash/longitud, no duplica binarios.
- `audit_log` es append-only desde API, no un registro antimanipulación frente al DBA.
- No hay idempotency key: si se pierde la respuesta tras confirmar una escritura,
  actualizar y comprobar el dato antes de repetirla.
- Una restauración de DB puede retroceder revisión: detener app y recargar todas las
  pestañas después de restaurar. No mantener clientes editando durante un restore.
- El bundle standalone mantiene advertencia >500 kB.
- Docker Compose está preparado, pero no fue ejecutado en esta PC (no tiene Docker).
  Validación runtime realizada con PostgreSQL portable real + API nativa y navegador.
- `npm audit` conserva avisos de herramientas Prisma/Vitest cuya solución exige cambios
  mayores; no se forzaron upgrades. No iniciar Vitest UI en una interfaz pública.

Referencias: [Prisma 6 migrations](https://www.prisma.io/docs/orm/v6/prisma-migrate/understanding-prisma-migrate/migration-histories),
[PostgreSQL para Windows](https://www.postgresql.org/download/windows/).

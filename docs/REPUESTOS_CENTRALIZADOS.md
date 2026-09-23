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

## Despliegue operativo en VM

### 1. Preparar la VM (una sola vez, tarea de TI)

Instalar Git y un motor Docker para **contenedores Linux**, con Docker Compose v2 o
posterior. No instalar Node ni PostgreSQL por separado. Las PCs cliente solo necesitan
un navegador actualizado y acceso a la red interna.

- **Linux (recomendado para servidor):** instalar [Docker Engine](https://docs.docker.com/engine/install/)
  y el [plugin Compose](https://docs.docker.com/compose/install/linux/). Instalar Git con
  el gestor de paquetes de la distribución. En una VM con systemd, TI debe habilitar
  el arranque de Docker: `sudo systemctl enable --now docker`.
- **Windows 10/11 compatible:** instalar Git y [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/)
  con motor Linux/WSL2 o Hyper-V; la VM necesita virtualización anidada soportada.
  Configurar inicio de Docker y comprobarlo después de reiniciar; Docker Desktop puede
  depender del inicio de sesión. No prometer arranque desatendido sin probarlo con TI.
- **Windows Server:** Docker Desktop no está soportado oficialmente. No basta con
  instalar un motor de contenedores Windows para estas imágenes Linux. TI debe
  proporcionar un host Linux compatible (por ejemplo VM Linux en Hyper-V). Se usa
  exactamente este mismo Compose, no una segunda arquitectura.

Verificar en la VM:

```sh
git --version
docker version
docker compose version
```

`docker version` debe mostrar también **Server**. Si no, el motor no está arrancado.

### 2. Descargar y configurar

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
Editar `.env` con el editor de texto de la VM. Para producción interna usar:

```dotenv
POSTGRES_DB=critical_spares
POSTGRES_USER=spares
POSTGRES_PASSWORD=REEMPLAZAR_POR_UNA_CLAVE_LARGA_Y_UNICA
APP_BIND_ADDRESS=0.0.0.0
APP_PORT=8080
```

No copiar el `.env` de desarrollo de la PC personal. `DATABASE_URL`, `HOST` y `PORT`
del ejemplo solo son para ejecución nativa; Compose establece esos valores internamente.
En Linux proteger `.env` con `chmod 600 .env`. No subirlo a Git.

### 3. Iniciar, verificar y abrir desde otra PC

```sh
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app postgres
```

Esperar `app` y `postgres` en estado **healthy**. Compose espera el healthcheck de
PostgreSQL; app ejecuta las migraciones y recién después inicia Express, que sirve
el frontend y `/api` en el mismo puerto. No ejecutar comandos npm manualmente.

En el navegador de cualquier PC de la LAN abrir:

```text
http://IP_DE_LA_VM:8080/api/health
http://IP_DE_LA_VM:8080
```

Health debe responder `{"status":"ok","database":"postgresql"}`. No se necesita SSH,
localhost, HTTPS, ni procesos en la PC personal. `0.0.0.0` es el bind, **no** la dirección
que se escribe en el navegador. No hay URLs API absolutas apuntando a localhost en
el frontend desplegado: el repository usa `/api`.

**HTTP por IP:** Configuración usa una abstracción UUID v4 con fallback criptográfico
`getRandomValues` cuando `randomUUID` no está disponible. Las altas de repuestos/unidades
se procesan en backend. No se requieren APIs de secure context para el flujo operacional.
HTTPS queda como mejora futura. HTTP no cifra el tráfico: limitarlo a una LAN confiable.

### 4. Firewall y primera carga

TI debe permitir únicamente **TCP 8080** (o `APP_PORT`) desde las PCs/subredes autorizadas
hacia la VM, tanto en el firewall del SO como en el hipervisor si aplica. No abrir 5432
ni 3001. PostgreSQL no tiene `ports` en Compose; solo está en la red Docker del proyecto.
No modificar las reglas ni los servicios del otro servidor Node existente.

La base empieza vacía de repuestos. No importar IndexedDB ni pulsar Restablecer demo.
En Configuración crear categoría y GMB activo, asignar el GMB a un área y, opcionalmente,
crear un equipo. Luego Repuestos → Nuevo repuesto → guardar.

Verificar desde la VM (con los nombres recomendados arriba):

```sh
docker compose exec postgres psql -U spares -d critical_spares
```

Dentro de psql: `SELECT id, name, area FROM "Spare";` y `\q` para salir.
Desde PC B abrir la misma URL por IP y pulsar Actualizar datos: debe aparecer el registro.

### 5. Backup, actualización y reinicio

Primer backup Linux: `sh scripts/backup-db.sh`. En Windows usar los comandos
`pg_dump` + `docker compose cp` de la sección Backups más abajo. Copiar el dump fuera
de la VM; el volumen no sustituye al backup.

Actualizar siempre desde la misma carpeta/proyecto Compose, después de un backup:

```sh
git pull --ff-only origin codex/editor-upgrades
docker compose up -d --build
docker compose ps
```

`app` y `postgres` tienen `restart: unless-stopped`. Con el motor Docker arrancando
al iniciar la VM, los contenedores no detenidos manualmente volverán a levantarse.
Si PostgreSQL demora en estar listo al reiniciar el motor, el arranque de app puede
fallar temporalmente y la política reintentará. Verificar ambos healthchecks.

Prueba de aceptación con un repuesto guardado (hacerla en horario acordado):

```sh
docker compose restart app
docker compose up -d --build --force-recreate app
```

Refrescar desde PC B después de cada comando y confirmar el mismo registro. Luego TI
debe reiniciar la VM y repetir `docker compose ps`, `/api/health` y la consulta del repuesto.
La prueba real de reinicio/reconstrucción Docker queda a realizar donde exista el motor.

### 6. Qué no hacer

- Reconstruir/recrear **app** no borra PostgreSQL: el named volume `postgres_data` es independiente.
- `docker compose down` retira contenedores/red pero **conserva** el volumen. Para volver:
  `docker compose up -d`. Un proyecto bajado con `down` no reaparece solo al reiniciar.
- **`docker compose down -v` sí elimina el volumen y sus datos. No usar en producción.**
- No borrar volúmenes con Docker Desktop/prune ni cambiar el nombre del proyecto Compose.
- No ejecutar `prisma migrate reset`, no publicar PostgreSQL ni exponer la app a Internet.
- No detener el otro servidor Node ni reutilizar un puerto ocupado.

### Auditoría de dependencias del navegador

Se revisó `src/` completo: los dos puntos del módulo Repuestos que invocaban directamente
`crypto.randomUUID()` ahora usan `src/spares/domain/createUuid.ts`. La API fetch es relativa.
Los usos de IndexedDB se limitan al respaldo legado y preferencias; los datos operativos
no dependen de él. No hay clipboard, service worker, geolocalización, mediaDevices ni
File System Access API requeridos por este standalone. Los selectores de archivo son HTML.
Se detectaron UUID/clipboard en módulos del Digital Twin/Maintenance ajenos al standalone;
no se cambiaron porque no forman parte de este despliegue. Los launchers estáticos antiguos
en `spares-standalone/public` y puertos Vite son herramientas locales, no el arranque Compose.

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

## Importación opcional de IndexedDB (no necesaria para este despliegue)

La decisión actual es empezar PostgreSQL vacío. Omitir esta sección; queda únicamente
como referencia de recuperación futura, sin migración automática ni pendiente.

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
npm run check:compose
# Crear previamente una DB vacía exclusiva, por ejemplo critical_spares_test.
# Configurar TEST_DATABASE_URL, sin usar producción:
npm run test:postgres
```

La suite general omite intencionalmente los tests destructivos de PostgreSQL. El comando
`test:postgres` exige una base cuyo nombre termina en `_test`, aplica migraciones y
ejecuta CRUD, relaciones, A→DB→B, concurrencia, backup y rollback real (trigger temporal
que falla en auditoría después de escribir datos). No hay script lint en el proyecto.

Validación del 23/09/2026: **134 tests generales + 10 tests PostgreSQL aprobados**,
TypeScript y ambos builds correctos. Se probó pg_dump/restore a otra base y se recuperaron
6 repuestos, 9 unidades y la auditoría de prueba. En navegador se verificaron dashboard,
alta, edición, búsqueda y recarga; el diálogo automatizado del borrado se bloqueó,
por lo que ese paso manual no se cuenta como aprobado (sí pasó el test API/DB).

Se verificaron además bind 0.0.0.0, frontend/API en el mismo puerto, persistencia tras
recrear app/cliente Prisma y fallback UUID sin randomUUID. El test PostgreSQL requiere
`npm run build:spares` previo para comprobar el frontend compilado. En navegador real
por IP LAN/HTTP se crearon categoría, GMB y equipo, confirmados tras recarga.
`npm run check:compose` validó el modelo con la CLI oficial de Compose sin Docker Engine:
puerto único 8080, PostgreSQL no publicado, volumen, healthchecks y restart policies.

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
- No se ejecutaron contenedores Docker en esta PC (no tiene Docker Engine).
  Build/up, reconstrucción Docker y reinicio real de VM deben verificarse en la VM.
  Validación runtime realizada con PostgreSQL portable real + API nativa y navegador.
- `npm audit` conserva avisos de herramientas Prisma/Vitest cuya solución exige cambios
  mayores; no se forzaron upgrades. No iniciar Vitest UI en una interfaz pública.

Referencias: [Prisma 6 migrations](https://www.prisma.io/docs/orm/v6/prisma-migrate/understanding-prisma-migrate/migration-histories),
[PostgreSQL para Windows](https://www.postgresql.org/download/windows/).

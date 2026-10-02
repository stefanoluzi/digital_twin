# Despliegue único: Mantenimiento LC1C

> **Validación 30/09/2026:** gateway HTTP, app y DB funcionan en Docker. El aislamiento
> de salida requiere las reglas Linux indicadas abajo. No es aprobación de seguridad:
> faltan auth/TLS/mínimo privilegio DB y resolver hallazgos del escaneo de imágenes.
> Ver [validación real](security/DOCKER_LOCAL_VALIDATION.md). No exponer a Internet.

Requiere Git y Docker Engine + Compose v2 ya instalados. No necesita Node en el host.
No detener servicios ajenos ni usar un puerto ocupado.

Seguridad/offline: ver `security/SECURITY_AUDIT.md` y `security/OFFLINE_VERIFICATION.md`.
Las imágenes están fijadas por digest y `pull_policy: never`. En la PRIMERA instalación
conectada, antes de `up`, aprovisionar explícitamente PostgreSQL y gateway:

```sh
docker pull postgres:16-bookworm@sha256:efedf3595f1d6f415c08568ba171029bf54052e754cc9f030e3f2412b21f3d67
docker pull nginxinc/nginx-unprivileged:stable-alpine@sha256:ed04ec1ff34502c339ee5c3ae3f855442398edc1d05591e2b98981dcbbd20b1e
```

Construir app con conexión una vez. Para reinicios offline usar `docker compose up -d`
sin --build, con las tres imágenes presentes. Si se actualiza el digest de PostgreSQL en
una instalación existente, predescargar esa referencia ANTES de la ventana offline.
Las redes internas/capabilities/root read-only fueron probadas en WSL2. IT debe
validar la VM destino, firewall entrante y riesgos antes de aplicar a producción.

```sh
git clone --branch codex/editor-upgrades --single-branch https://github.com/stefanoluzi/digital_twin.git
cd digital_twin
cp .env.example .env
```

Completar `.env`:

- POSTGRES_DB=critical_spares (nombre histórico, contiene todos los módulos).
- POSTGRES_USER=spares.
- POSTGRES_PASSWORD: contraseña fuerte propia; nunca el ejemplo ni subir .env a Git.
- APP_PORT=8080 o un puerto libre.
- APP_BIND_ADDRESS=IP_LAN_DE_LA_VM para limitar interfaz; 127.0.0.1 para prueba local;
  0.0.0.0 publica en todas las interfaces y exige firewall LAN.
- DATABASE_URL, PORT y HOST del ejemplo son para desarrollo nativo; Compose construye
  DATABASE_URL internamente con las credenciales anteriores y host `postgres`.

Antes del primer arranque en **host Docker Linux con systemd y backend iptables**:

```sh
sudo bash scripts/install-egress-policy.sh
```

Esto agrega reglas solo para lc1c-edge/lc1c-front/lc1c-runtime (IPv4 e IPv6), sin
flush ni cambios de políticas globales. Instala dependencias systemd previas a Docker;
no reinicia otros servicios. Con nombres de bridge personalizados, adaptar también
las instancias systemd antes de arrancar. No aplicarlo a Docker Desktop ni a un
host con backend nftables nativo sin revisión IT. Compose por sí solo NO bloquea
salida del gateway. No retirar estas reglas para resolver un error de conexión.

```sh
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app
curl --fail http://127.0.0.1:8080/api/health
```

Si se enlazó exclusivamente IP LAN, usar esa IP en curl y navegador.
El arranque aplica `prisma migrate deploy` antes de servir frontend/API.
PostgreSQL no publica puerto; volumen `postgres_data`; healthchecks y restart
unless-stopped. Mantener el nombre Compose `critical-spares`: cambiarlo crea otro
volumen y parece una pérdida de datos. No usar `docker compose down -v`.

URLs (sustituir host/puerto):

- http://IP_VM:8080/
- http://IP_VM:8080/repuestos
- http://IP_VM:8080/controles-criticos
- http://IP_VM:8080/controles-criticos/acoplamientos
- http://IP_VM:8080/reparaciones-taller
- http://IP_VM:8080/tareas-globales-rex

Crear un control, recargar y abrir desde otra PC (recargar o reingresar al módulo). Repetir con
un dato de Repuestos. Consultar directamente PostgreSQL:

```sh
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

```sql
SELECT id, type, date, inspector FROM "LcoEvent" WHERE "deletedAt" IS NULL;
SELECT revision FROM "LcoConfig";
SELECT count(*) FROM "Spare";
```

Salir con `\q`. Verificar persistencia después de `docker compose restart app`,
después de `docker compose restart postgres app` y después de reiniciar la VM.
Pruebas de contenedores y daemon aprobadas en WSL2; reinicio completo de VM destino
y segunda PC física deben validarse allí.

## Desarrollo nativo

Con PostgreSQL propio y DATABASE_URL configurado en .env:

```sh
npm ci
npm run db:generate
npm run db:migrate
npm run build:spares
npm run start:server
```

Abrir http://127.0.0.1:3001/ (PORT configurable). Para hot reload, mantener backend
y ejecutar `npm run dev:spares` en otra terminal. El build:spares incluye la plataforma
con Repuestos, Acoplamientos, Reparaciones Taller y Tareas Globales REX.

Antes de actualizar: backup. Luego `git pull --ff-only`, `docker compose up -d --build`.
No migrar automáticamente IndexedDB: seguir CONTROLES_CRITICOS_MIGRACION.md.

## Actualizar una instalación existente a la versión REX

Ejecutar desde el mismo checkout/directorio Compose de la instalación actual.
Conservar `.env`, nombre del proyecto Compose y volumen existentes. No copiar encima
el `.env.example` ni cambiar credenciales de una base ya inicializada.

```sh
sh scripts/backup-db.sh
git switch codex/editor-upgrades
git pull --ff-only origin codex/editor-upgrades
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app
```

El arranque aplica las migraciones de tareas REX y estimaciones antes de iniciar la
API. No requiere reset, seed ni importar datos demo. Nunca ejecutar `down -v`.
Guardar el dump también fuera de la VM antes de actualizar. No detener otros servicios.

Verificar `/api/health` (status `ok`) y `/api/rex/state`. Abrir Tareas Globales REX:
en **Configuración REX** definir la tarifa real. Jornada inicial: 9 h/día, moneda USD;
la tarifa comienza vacía deliberadamente. Si faltan áreas, crearlas en Configuración
de Repuestos. Crear una tarea y verificarla tras recargar y desde otra PC.

La configuración y todas las tablas REX se incluyen en el backup completo PostgreSQL;
no forman parte del respaldo JSON exclusivo de Repuestos. Los datos locales no viajan
con Git: un clon en un servidor nuevo inicia una base vacía, salvo restauración explícita.

No hay autenticación real: restringir el acceso a la red interna/firewall. No publicar
esta instalación directamente a Internet. Esta versión fue validada con PostgreSQL
real, builds y contenedores Docker en WSL2. Consultar los hallazgos de seguridad antes
de habilitar usuarios de la red de planta.

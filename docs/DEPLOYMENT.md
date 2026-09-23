# Despliegue único: Mantenimiento LC1C

Requiere Git y Docker Engine + Compose v2 ya instalados. No necesita Node en el host.
No detener servicios ajenos ni usar un puerto ocupado.

```sh
git clone --branch codex/editor-upgrades --single-branch https://github.com/stefanoluzi/digital_twin.git
cd digital_twin
cp .env.example .env
```

Completar `.env`:

- POSTGRES_DB=critical_spares (nombre histórico, contiene ambos dominios).
- POSTGRES_USER=spares.
- POSTGRES_PASSWORD: contraseña fuerte propia; nunca el ejemplo ni subir .env a Git.
- APP_PORT=8080 o un puerto libre.
- APP_BIND_ADDRESS=IP_LAN_DE_LA_VM para limitar interfaz; 127.0.0.1 para prueba local;
  0.0.0.0 publica en todas las interfaces y exige firewall LAN.
- DATABASE_URL, PORT y HOST del ejemplo son para desarrollo nativo; Compose construye
  DATABASE_URL internamente con las credenciales anteriores y host `postgres`.

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

Crear un control, recargar y abrir desde otra PC → Actualizar datos. Repetir con
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
Estas últimas pruebas de contenedores están pendientes en una máquina con Docker.

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
y ejecutar `npm run dev:spares` en otra terminal. El build:spares incluye AMBOS módulos.

Antes de actualizar: backup. Luego `git pull --ff-only`, `docker compose up -d --build`.
No migrar automáticamente IndexedDB: seguir CONTROLES_CRITICOS_MIGRACION.md.

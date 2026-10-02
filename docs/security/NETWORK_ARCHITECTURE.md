# Arquitectura y exposición de red

Auditoría 2026-09-30. Base Git: `a75e236`; correcciones en árbol de trabajo.
Alcance: todos los archivos versionados y nuevos del proyecto, lockfile e historial
Git disponible localmente. Se excluyen datos personales de `.env`, backups y temporales.

```text
Navegador de PC autorizada (React, assets locales)
       | HTTP TCP APP_PORT (8080 por defecto), mismo origen /api/*
       v
Host Docker: APP_BIND_ADDRESS (.env.example: 0.0.0.0; fallback: loopback)
       | publicación APP_PORT -> gateway:8080
       v
gateway: NGINX no-root, edge + frontend interna; salida limitada por firewall
       | HTTP 3001 sobre frontend internal
       v
app: Express + frontend dist-spares + Prisma
       | TCP 5432, nombre DNS Docker "postgres"
       v
postgres: PostgreSQL 16, volumen postgres_data

app y postgres: runtime internal; app y gateway: frontend internal
Sin API cloud, CDN ni proveedor de identidad requeridos.
```

## Contenedores, interfaces y protocolos

| Componente | Escucha | Publicado al host | LAN | Internet |
|---|---|---|---|---|
| Gateway NGINX | 8080 dentro de contenedor | APP_BIND_ADDRESS:APP_PORT ->8080 | Si bind/firewall permiten | No exponer a Internet; restringir entradas en IT |
| Express en app | 0.0.0.0:3001 dentro de contenedor | Ninguno | Solo mediante gateway | Sin ruta externa ordinaria |
| PostgreSQL | 5432 dentro de contenedor | Ninguno | No hay publicación Compose; probar desde segunda PC | No hay publicación; host/routing ajeno debe auditarse |
| DNS Docker | Resolver embebido del contenedor | Ninguno de esta app | No es servicio LAN de la app | App/gateway upstream loopback; DNS externo probado SERVFAIL |
| Vite/inspector/Redis/Adminer/pgAdmin | No se inician en Compose | Ninguno | No | No |

`EXPOSE 3001` del Dockerfile es metadata, no otro puerto publicado.
`0.0.0.0` permite todas las interfaces del namespace correspondiente; por sí solo
no habilita NAT ni publica un servicio en Internet. IT debe restringir IPs origen,
VLAN, ACL y firewall del host. Usar IP LAN concreta en APP_BIND_ADDRESS cuando aplique.
Las redes `internal` eliminan el camino ordinario de app/DB hacia Internet; gateway
necesita `scripts/docker-egress-policy.sh` para bloquear salida sobre edge. Aplicar a
los tres bridges y persistir mediante unidades systemd incluidas. Nunca hacer flush
global del firewall. No aplica a Docker Desktop ni backend nftables nativo sin adaptar.
Este aislamiento no controla el navegador, el daemon Docker, el SO ni usuarios con acceso root/Docker.

## Comunicaciones

- Navegador -> misma URL: HTML, JS, CSS, fuentes, PNG y JSON. Imágenes adjuntas en data URLs.
- Backend -> PostgreSQL: Prisma con consultas parametrizadas y conexiones persistentes.
- Arranque: Prisma CLI migrate deploy -> PostgreSQL; checkpoint desactivado.
- Navegador -> links documentales REX: navegación explícita del usuario a HTTP/HTTPS
  arbitrario permitido en datos, NO dependencia de runtime. CSP no impide navegar a otro sitio.
- Build/provisión: npm registry, Docker registry, Debian APT y binarios Prisma/esbuild.
  Eso requiere conectividad o mirror/cache preparado; NO se ejecuta en reinicio normal.

## Variables

| Variable | Uso |
|---|---|
| POSTGRES_DB / USER / PASSWORD | Inicialización DB y URL backend. Password secreto en .env excluido; no logs |
| APP_PORT / APP_BIND_ADDRESS | Única publicación de Compose |
| HOST=0.0.0.0, PORT=3001 | Escucha interna del backend en Docker |
| NODE_ENV=production, STATIC_DIR=dist-spares | Build estático de plataforma; no Vite/HMR |
| CHECKPOINT_DISABLE=1 | Desactiva checkpoint Prisma CLI |
| PRISMA_HIDE_UPDATE_MESSAGE=1 | Desactiva aviso de actualización |
| DATABASE_URL | Construida internamente con percent-encoding; la .env local solo para desarrollo |
| TEST_DATABASE_URL | Exclusivamente tests contra nombre terminado en _test |

## Filesystem

- postgres: volumen Docker `critical-spares_postgres_data` -> `/var/lib/postgresql/data`.
  No bind de carpetas host. No usar down -v en producción.
- app: usuario node, raíz read-only, `/tmp` tmpfs escribible, capabilities eliminadas,
  no-new-privileges. Lee `/app/server`, código requerido de `/app/src`, Prisma,
  node_modules y dist-spares. No puede escribir la raíz con esta configuración.
- Adjuntos: datos en PostgreSQL; no endpoint de escritura/lectura arbitraria del host.
- Backups: `scripts/backup-db.sh` crea dump en `backups/` del host por stdout de pg_dump;
  copiar fuera del servidor. El contenedor no monta backups.
- Imagen final contiene dependencias de desarrollo porque Prisma/tsx se requieren en
  arranque; no se ejecutan Vite/Vitest. Reducir imagen a runtime dedicado es mejora futura.

## Observación local anterior (antes del reinicio Windows)

Lectura de sockets Windows: 127.0.0.1:3001 Node y 127.0.0.1:55432 PostgreSQL portable.
Sin 5432/8080/Vite/9229 observados entre puertos inspeccionados. No se modificaron
firewall ni otros servicios Windows. Posteriormente se instaló Docker dentro de WSL2;
laboratorio disponible en Windows loopback 18080 mediante gateway. Solo sus bridges
Linux tienen reglas nuevas. Ver DOCKER_LOCAL_VALIDATION.md. Segunda PC física pendiente.

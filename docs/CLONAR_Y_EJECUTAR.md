# Clonar y ejecutar Mantenimiento LC1C

## Qué incluye esta versión

Repuestos Críticos (con históricos de cobertura), Reparaciones Taller (plan del
ejercicio, estados por unidad, historial y leyenda visual) y Acoplamientos LCO.
React/TypeScript + API Express + Prisma/PostgreSQL. Se conserva el proyecto Digital
Twin en el repositorio; el contenedor sirve la plataforma centralizada.

## Instalación nueva

Requisitos: Git y Docker Engine/Desktop con Docker Compose v2, funcionando con
contenedores Linux. No hace falta instalar Node ni PostgreSQL en el host.

```sh
git clone --branch codex/editor-upgrades --single-branch https://github.com/stefanoluzi/digital_twin.git
cd digital_twin
git rev-parse HEAD
```

Para reproducir una revisión exacta incluso después de futuros cambios de la rama:
`git checkout --detach COMMIT_COMPLETO`, usando el SHA entregado con esa versión.

Copiar `.env.example` a `.env` (`Copy-Item .env.example .env` en PowerShell,
`cp .env.example .env` en Linux). Editar:

```dotenv
POSTGRES_DB=critical_spares
POSTGRES_USER=spares
POSTGRES_PASSWORD=REEMPLAZAR_POR_UNA_CLAVE_SEGURA
APP_PORT=8080
APP_BIND_ADDRESS=127.0.0.1
```

`APP_BIND_ADDRESS=127.0.0.1` permite acceso solo desde esa PC. Para una red interna,
usar la IP LAN del servidor y limitar el acceso con el firewall. No exponer a Internet.
Si 8080 está ocupado, elegir otro puerto libre (por ejemplo 8081). No detener otros
servidores para liberarlo. `DATABASE_URL`, `HOST` y `PORT` de `.env.example` son para
desarrollo fuera de Docker; Compose configura la conexión interna automáticamente.

```sh
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=80 app
```

El build usa `npm ci` y el `package-lock.json` versionado. Al iniciar se aplican
automáticamente todas las migraciones incluidas en el commit. Esperar que ambos
servicios estén healthy. No hace falta ejecutar `npm install`, `npm run dev` ni
migraciones manuales dentro del contenedor.

Abrir (ajustar host/puerto si se cambiaron):

- Inicio: http://127.0.0.1:8080/
- Taller: http://127.0.0.1:8080/reparaciones-taller
- Repuestos: http://127.0.0.1:8080/repuestos
- Acoplamientos: http://127.0.0.1:8080/controles-criticos/acoplamientos
- Salud API/DB: http://127.0.0.1:8080/api/health

## Código no es base de datos

**Git clone reproduce el código, no los registros cargados en esta PC.** Una
instalación nueva utiliza una base nueva y sus catálogos iniciales; no tendrá las
reparaciones, inspecciones ni repuestos locales. Para llevar esos datos se necesita
un backup completo de PostgreSQL y su restauración por separado, siguiendo
[Backups](REPUESTOS_CENTRALIZADOS.md#backups). No subir dumps ni `.env` a GitHub.
Una copia JSON de Repuestos no reemplaza un backup completo de todos los módulos.

El volumen `postgres_data` conserva los datos al reiniciar. **No usar
`docker compose down -v`**: elimina el volumen. Si ya existe una instalación, hacer
backup y conservar su `.env` y proyecto Compose; estos pasos son para una nueva.

## Reproducibilidad y validación

El SHA fija el código y el lockfile fija las dependencias npm. Las imágenes base
`node:24-bookworm-slim` y `postgres:16-bookworm` reciben actualizaciones: esto no
es una promesa de imagen binaria idéntica. Para conservar un entorno binario exacto
se deben archivar además las imágenes construidas y sus digests.

Validación local de esta entrega: 204 tests generales, 38 tests PostgreSQL (suite
separada), typecheck y builds correctos; recorrido visual del Taller comprobado.
Docker no disponible en la PC de desarrollo: no se validó aquí una ejecución real
de Docker Compose. Validar el estado healthy y la API en el destino.

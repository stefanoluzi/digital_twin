# SECURITY AUDIT — Mantenimiento LC1C / Digital Twin

Fecha: 2026-09-30. Base: `a75e236`, rama `codex/editor-upgrades`.
Auditoría y correcciones locales, SIN commit/push automático. No es certificación ni
pentest externo. Distingue análisis de código, pruebas locales y validación IT pendiente.

## 1. Executive Summary

**No aprobar todavía como "offline verificado" ni "seguro para cualquier red".**
Se eliminaron dependencias explícitas Google Fonts/unpkg, se desactivó checkpoint de
Prisma en arranque Docker, se añadieron headers/CSP y se fijaron imágenes por digest.
Compose usa gateway HTTP no-root, redes frontend/runtime internas, app/DB sin
puertos y no-pull. El bloqueo inicial de publicación HTTP está resuelto; se probaron
entrada, CRUD, SQL, restart, backup/restore y egress. El gateway necesita las reglas
de firewall Linux entregadas; Compose solo no basta para bloquear su salida.
Ver [validación Docker](DOCKER_LOCAL_VALIDATION.md).

**Hallazgo de aceptación:** Trivy reporta críticos/altos en imágenes app/PostgreSQL.
No se aprueba como "súper segura". Sin auth/RBAC ni TLS, se limita a laboratorio o
LAN con riesgos expresamente evaluados por IT. No exponer a Internet.

Tras actualizaciones dirigidas, npm audit devuelve 0 critical/high/moderate/low para
474 entradas de dependencias del lockfile (incluye opcionales/plataforma). No equivale
a ausencia de vulnerabilidades desconocidas ni de CVEs en paquetes del SO/imagen.

Actualmente la aplicación no implementa autenticación propia. Cualquier cliente con
acceso de red puede leer/modificar/exportar datos y suplantar el actor informativo.
La seguridad de acceso depende del aislamiento interno/firewall/arquitectura corporativa.
IT debe aceptar esa decisión o exigir SSO/proxy/autorización en un trabajo separado.

## 2. Architecture

React 18/TypeScript, Vite build, Three.js para editor; Node/Express 5, Prisma 6.19.3,
PostgreSQL 16. Mismo origen frontend/API. Navegador nunca recibe DATABASE_URL ni abre
conexión PostgreSQL. `dist-spares` incluye Repuestos, Taller, Acoplamientos y REX.
El build Digital Twin principal y Planner standalone son artefactos separados, también
inspeccionados; no están publicados por la imagen Compose actual.
Detalle: [NETWORK_ARCHITECTURE.md](NETWORK_ARCHITECTURE.md).

## 3. Attack Surface

Entradas: JSON de formularios/importaciones hasta 100 MB, imágenes/PDF en base64,
documentos y layouts locales, rutas API, cabeceras Origin/If-Match/X-Actor-Id.
Lecturas completas `/api/state`, `/api/backup`, `/api/audit` y estados de módulos son
accesibles sin login. If-Match evita conflictos, NO autoriza usuarios. Usuario ADMIN
en UI es informativo. No se inventó login.
DoS residual: cuerpos grandes, fotos, exportaciones y lectura de snapshots completos;
sin rate limiter ni cuotas por usuario. Recomendar límite en proxy/firewall y monitoreo.

## 4. Network Exposure

Un puerto publicado: APP_BIND_ADDRESS:APP_PORT (8080 por defecto) -> gateway:8080 TCP.
PostgreSQL:5432 solo namespace/red Docker según Compose; ninguna publicación.
Sin Redis/Adminer/pgAdmin/Vite/inspector en despliegue. `0.0.0.0` no implica exposición
Internet automáticamente; NAT, firewall, ACL y VLAN son responsabilidad de IT.
Sockets locales observados: 127.0.0.1:3001 y 127.0.0.1:55432 (PG portable de desarrollo).
No prueba accesibilidad LAN real de Docker. TLS no implementado: recomendado proxy
corporativo HTTPS, cuidando Host/origin. No se agregó HSTS sobre HTTP interno.

## 5. Internet Dependencies

| Componente/archivo | Conexión/dominio | Motivo y necesidad | Acción |
|---|---|---|---|
| src/styles.css | fonts.googleapis.com, fonts.gstatic.com | Fuentes necesarias visualmente, no el CDN | @fontsource local, mismas familias/pesos |
| src/planner/components/PdfJsPreview.tsx | unpkg.com | Worker fallback y CMaps | Worker Vite local; CMaps, standard fonts, WASM emitidos por scripts/pdf-assets.ts |
| Prisma CLI / node_modules/prisma/build/index.js | checkpoint.prisma.io | Telemetría/check de versiones, innecesario | CHECKPOINT_DISABLE=1 y PRISMA_HIDE_UPDATE_MESSAGE=1 en wrapper/Compose |
| Repositorios Http*, repairs/rex repository, CoverageHistoryView | /api/* mismo origen | Datos compartidos, necesaria LAN | Conservado, CSP connect-src self |
| REX documentos / href HTTP(S) | Dominio indicado por usuario | Link manual, no carga automática | Conservado; registrar política corporativa de navegación |
| Dockerfile/npm install | registry.npmjs.org, registry Docker, Debian APT, binarios Prisma/esbuild | Provisión/build, no reinicio | Documentado y artefactos preinstalados |
| Three.js / PlantScene | textura data URL y geometría local | Render industrial | No Environment preset/HDR remoto ni decoder CDN invocado hallado |
| PDF export/librerías | URLs en copyrights, SVG namespace, enlaces de documentación | Strings no equivalen a requests | Clasificados, no borrados indiscriminadamente |

No se hallaron SDKs integrados de GA/GTM/Sentry/Datadog/NewRelic/PostHog/Amplitude/
Mixpanel/Firebase/Supabase/Mapbox/ArcGIS. La palabra analytics en Planner es cálculo
local para resúmenes, no tracking. No sendBeacon/WebSocket/EventSource propios en runtime.
Dependencias pueden contener código de red no alcanzado; no se afirma auditoría formal
de cada línea de node_modules. CSP/restricción egress son defensa adicional, no prueba.

## 6. Outbound Connections

API de negocio no contiene cliente HTTP externo ni fetch de URLs aportadas (no SSRF
en rutas revisadas). Única conexión backend necesaria: PostgreSQL. Wrapper migrate
no instala paquetes y checkpoint desactivado; motores generados dentro del build.
No captura de tráfico ejecutada: el conteo observado de conexiones externas es
**NO MEDIDO**, no cero. Capturar también DNS/UDP y tráfico del daemon/navegador.

## 7. Docker Isolation

Tres servicios, redes internas runtime/frontend y edge para gateway, pull_policy never.
App y gateway read-only, tmpfs /tmp, no-root, cap_drop ALL/no-new-privileges. PostgreSQL no se
ejecuta como host root por la app; entrypoint oficial hace inicialización/cambio de usuario.
Sin socket Docker ni mounts amplios, host network o privileged. Digests de Node,
PostgreSQL y NGINX fijados desde sus imágenes oficiales; no tag latest. Validación Compose PASS.
Docker build, healthchecks, Prisma read-only y publicación gateway aprobaron en WSL2.
Reinicio contenedores/daemon y restauración de backup aprobados. Reinicio físico
Windows/VM sin Internet y segunda PC física pendientes.
Trivy ejecutado: app 5 CRITICAL/83 HIGH, postgres 16 CRITICAL/102 HIGH, gateway
0 CRITICAL/HIGH y 1 UNKNOWN (ocurrencias paquete/advisory, no exploits confirmados).
Informe: `evidence/image-scan-summary.json`; triage/remediación pendientes.

## 8. Database Isolation

Credenciales mediante env, URL construida con encoding. Prisma parametriza consultas;
raw queries revisadas son SELECT 1 y locks FOR UPDATE con tagged templates estáticos.
No $queryRawUnsafe/$executeRawUnsafe en código de aplicación. Migraciones aditivas,
FKs y checks; tests reales verifican rollback, revisiones y persistencia.
Riesgo alto: POSTGRES_USER del contenedor oficial crea superusuario y app usa la misma
identidad para migración/runtime. Recomendado separar rol migrador y rol de datos de
mínimos privilegios; requiere plan operativo/rotación y no se cambió silenciosamente
en volúmenes existentes. No cifrado DB-at-rest configurado; backups contienen datos.

## 9. Dependency Audit

Evidencia legible máquina en `evidence/npm-audit.json`, `inventory.json`, `sbom.cdx.json`.
Inicial: 0 critical, 3 high (una causa raíz propagada), 2 moderate, 1 low.

| Paquete | Antes -> después | Advisory/impacto |
|---|---|---|
| deepmerge-ts | 7.1.5 -> 8.0.0 override | GHSA-ggr8-5vv4-36mx / CVE-2026-40345; recursión en grafos cíclicos. @prisma/config/prisma heredaban high; configuración CLI, no JSON de API directo |
| vitest / @vitest/mocker | 3.2.7 -> 4.1.11 | GHSA-82fw-gwwq-j7x9 / CVE-2026-84373; traversal/lectura vía redirect mock. Dev/test, no servidor de mocks publicado |
| dompurify | 3.4.15 -> 3.4.16 | GHSA-p98j-92pf-mc4p; XSS con hook/IN_PLACE específico; transitive de jsPDF |
| @fontsource/inter, ibm-plex-mono | nuevos 5.3.0 | Sustituyen CDN sin cambiar tipografía |

No `npm audit fix --force`, downgrade Prisma ni actualización arquitectónica.
Override deepmerge requiere mantener tests Prisma en futuras actualizaciones.
Fuentes primarias: https://github.com/advisories/GHSA-ggr8-5vv4-36mx,
https://github.com/advisories/GHSA-82fw-gwwq-j7x9,
https://github.com/advisories/GHSA-p98j-92pf-mc4p.

Supply chain: 7 entradas hasInstallScript (Prisma/client/engines, esbuild, esbuild de
tsx, core-js, fsevents). Prisma/esbuild pueden obtener binarios al instalar; core-js
anuncia proyecto, fsevents nativo opcional. Ejecutar npm ci solo en build controlado,
revisar lock/integrity y conservar imágenes. Esbuild/Prisma necesarios, no eliminados.
Imagen copia todo node_modules (incluye test tools): superficie de archivos mayor de
lo necesario, aunque no escuchan. Recomendada imagen runtime mínima posteriormente.

## 10. Secrets Audit

`.env` ignorado y excluido de contexto Docker. Git no lista .env real ni historial de
ese archivo. .env.example contiene CHANGE_ME, wrapper rechaza ese valor. No se copiaron
secretos a informe. Scanner regex del árbol y todos los commits/ref locales encontró
27 candidatos históricos (solo .env.example y URL construida del wrapper), revisados
como placeholders/interpolación. Cero credenciales reales detectadas por esas reglas.
No equivale a escaneo de commits remotos borrados, objetos inaccesibles ni prueba de
ausencia absoluta. Credentials env son visibles a administradores Docker: RBAC host.

## 11. Backend Security

- SQL injection: consultas Prisma y raw tagged estáticas; sin Unsafe hallado.
- Command injection: spawn de arranque con argumentos fijos, sin shell/input HTTP.
- Filesystem/traversal: express.static solo directorio configurado, sendFile index fijo;
  no file API que acepte paths host. Documentos REX son metadata, no fetch backend.
- Deserialización: JSON + Zod, no eval/deserialización ejecutable en app. Límites y
  esquemas por dominio, asociaciones/FKs/revision; no asignación arbitraria de columnas.
- XSS: React escapa texto; sin dangerouslySetInnerHTML en fuente propia revisada.
  Imágenes/PDF Repuestos se validan como data URLs con MIME permitido (sin SVG/HTML).
  Documentos PDF siguen siendo contenido no confiable; mantener lector actualizado.
- CSRF/CORS: sin ACAO wildcard ni middleware CORS. Escrituras de browser validan Origin
  host y Sec-Fetch-Site; Origin inválido/null produce 403, no excepción 503. Content-type
  JSON requerido. Clientes no-browser sin Origin siguen admitidos: NO sustituye auth.
- Cabeceras en HTML/assets/API: CSP, nosniff, DENY/frame-ancestors none, no-referrer,
  Permissions-Policy. CSP admite estilos inline necesarios y WASM, no unsafe-eval JS,
  ni scripts/imagenes/fuentes/connect externos; permite data/blob para adjuntos.
- Errores: mensajes genéricos, logs solo nombre de clase; no query/URL/stack/adjuntos.
  Vistas/exports pueden contener información industrial legítima: requieren control de acceso.

## 12. Frontend Security

Sin tokens API/JWT o passwords en frontend. localStorage guarda preferencias/estado
legacy, no credenciales de autenticación. IndexedDB de standalones antiguos NO es
DB central. API central no cae silenciosamente a almacenamiento local.
Links REX HTTP(S) usan noreferrer; otras cadenas se renderizan como texto. No reemplazar
eso por un fetch automático. CSP no regula la navegación manual a otros sitios.
Producción build Vite, no HMR; sourcemaps no habilitados. Las bibliotecas contienen
strings URLs no necesariamente ejecutables. Tests de assets verifican HTML/CSS.
No CSP en Vite dev: usar servidor Express/build para prueba producción.

## 13. Offline Verification

### Resultados ejecutados en esta PC

| Prueba | Resultado |
|---|---|
| npm test (Vitest 4.1.11) | PASS: 234; 51 PostgreSQL omitidos aquí y ejecutados aparte |
| npm run test:postgres | PASS: 51 contra PostgreSQL real dedicado _test |
| npm run typecheck:server | PASS |
| npx prisma validate | PASS |
| build / build:spares / build:planner / build:lco | PASS después de corregir tipado del plugin PDF; warnings de tamaño de chunks en principal/Planner |
| scripts/check-offline-assets.mjs | PASS: 802 archivos; sin URLs externas HTML/CSS ni .map; PDF auxiliar local presente |
| check:compose con binario Compose oficial standalone | PASS: modelo, internal, no ports DB, never, readonly/caps |
| Sintaxis Node de scripts nuevos | PASS |
| Navegador local Express | Home y dashboard Repuestos visibles; sin error/warn observado en consola. NO prueba de egress bloqueado |
| HTTP local /api/health + headers | PASS: DB ok, CSP/headers presentes en HTML |
| scripts/test-offline.mjs --run | PASS: 15 comprobaciones con gateway y firewall scoped |
| Docker build/arranque, API/SQL internos, persistencia tras restart | PASS en laboratorio WSL2; ver DOCKER_LOCAL_VALIDATION.md |
| PCAP acotada eth0 30 s contra sondas TCP/443 y UDP/53 a 1.1.1.1 | 0 paquetes; DROP comprobado, no prueba global de ausencia de tráfico |
| Backup/restore y restart daemon Docker | PASS en laboratorio |
| Reinicio VM offline, segunda PC física, HAR completo | NO EJECUTADOS |
| Lint | NO DISPONIBLE: no script/config |

### Archivos modificados / añadidos

- Dockerfile, docker-compose.yml, scripts/start-container.mjs, verify-compose.mjs:
  digests, aislamiento, arranque sin checkpoint y validación de configuración.
- package.json / package-lock.json: dependencias corregidas, fuentes locales, scripts.
- src/styles.css, src/planner/components/PdfJsPreview.tsx, scripts/pdf-assets.ts,
  vite.config.ts, vite.planner.config.ts, tsconfig.node.json: empaquetado offline.
- server/security.ts, server/app.ts, tests/security.test.ts: headers y origen/tipo de request.
- scripts/test-postgres.ts: desactiva checkpoint también en runner de pruebas.
- scripts/security-inventory.mjs, scripts/check-offline-assets.mjs,
  scripts/test-offline.mjs: inventario, chequeo estático y ensayo Docker reproducible.
- docs/DEPLOYMENT.md, docs/security/*: documentación, checklist y evidencias/SBOM.

No se cambió schema, migraciones ni datos de negocio durante esta auditoría.

Guía: [OFFLINE_VERIFICATION.md](OFFLINE_VERIFICATION.md).
Automatización `scripts/test-offline.mjs`: stack dedicado, imágenes ya cargadas,
no-build/no-pull, red interna, probe TCP denegado, API, SQL, restart/persistencia.
Ejecutada en Docker: bloqueo TCP/DNS de sondas, CRUD/persistencia y puerto cliente
aprobados. Navegación básica en cuatro módulos aprobada. Matriz exhaustiva de
3D/PDF/HAR/captura global y reinicio VM pendientes.
No confundir funcionamiento sin Internet con funcionamiento sin LAN:
el cliente NECESITA acceso al servidor API.

## 14. Known Limitations

Sin auth/RBAC, actor suplantable, HTTP plano, rol DB superusuario, límite JSON alto,
sin rate limiting, snapshots completos, sin antimalware de adjuntos ni rotación de
logs configurada. Firewall de bridges probado; aislamiento global del SO/segunda PC
pendientes. CVE scan ejecutado con hallazgos altos/críticos. Backup restore bajo
aislamiento aprobado en DB de laboratorio, no probado con datos productivos.
No lint configurado. Backend usa tsx y typecheck noEmit; no build separado de JS.

## 15. Recommendations

1. IT: ejecutar matriz offline/puertos/captura en staging y probar readonly/tmpfs.
2. Antes de red amplia: acceso corporativo autenticado, TLS, ACL y roles DB separados.
3. Validar y archivar dumps fuera de VM, restore, imagen IDs/digests y SBOM por entrega.
4. Trivy/Grype u otro scanner corporativo sobre imágenes con BD de advisories reciente;
   importar esa BD en entorno aislado. Mantener parches regulares también offline.
5. Reducir imagen, rate limits/cuotas y controles documentales en etapa controlada.

## 16. Final Security Status

**Runtime sin Internet validado en laboratorio; NO aprobado como 100% seguro.**
Cambios de seguridad aplicados sin modificar negocio/UI. No se deshabilitaron firewall,
antivirus ni controles del host. Se probaron firewall, persistencia y navegación básica.
Faltan remediar/analizar hallazgos de imágenes, autenticación y TLS, y validar la VM y
segunda PC físicas. Checklist y resumen separan PASS/FAIL
por evidencia; FAIL pendiente no significa exploit demostrado.

## APPLICATION SECURITY SUMMARY

| Indicador | Resultado |
|---|---|
| Internet required at runtime | NO en flujos probados; sigue requiriendo servidor accesible por red local |
| External APIs | 0 integradas requeridas |
| External CDNs | 0 recursos requeridos tras correcciones |
| Analytics / telemetry | 0 intencionales; checkpoint Prisma desactivado |
| Outbound runtime connections | Sondas TCP/DNS bloqueadas; captura acotada sin paquetes al destino de prueba, no captura global |
| Publicly exposed application ports | 1 al host por Compose, no significa público en Internet |
| Publicly exposed database ports | 0 configurados, pendiente prueba desde LAN |
| PostgreSQL network scope | runtime internal Docker, solo backend/miembros autorizados |
| Secrets hardcoded | 0 reales detectados por búsqueda definida |
| Critical / High / Medium vulnerabilities npm | 0 / 0 / 0 en evidencia fechada |
| npm dependencies audited | 474 entradas (incluye opcionales) |
| Docker services | 3 (gateway, app, postgres) |
| Production mode verified | Build/runtime/HTTP PASS; no aprobación de seguridad productiva |
| Offline startup verified | PASS contenedores sin pull y salida bloqueada; reinicio físico de VM sin Internet pendiente |
| Offline functional tests | PASS subconjunto automatizado y navegación básica; no certificación exhaustiva |
| Database persistence | PASS PostgreSQL local y restart de contenedores aislados |

Commit sugerido: `Harden offline assets, HTTP headers and Docker isolation; add IT security audit`.

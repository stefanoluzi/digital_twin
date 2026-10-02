# Prueba Docker real — 30/09/2026 (Argentina)

## Resultado final de esta sesión

El bloqueo de publicación HTTP está RESUELTO con gateway NGINX unprivileged.
La app y la DB no publican puertos. Gateway usa edge/frontend; app frontend/runtime;
PostgreSQL solo runtime. Frontend y runtime son internal. Tres bridges propios
tienen reglas IPv4/IPv6 que bloquean nuevas conexiones fuera del bridge y al host,
sin bloquear respuestas HTTP ni comunicación entre servicios del mismo bridge.
Unidades systemd y dependencia de Docker conservan la política al arrancar Linux.
No se modificaron redes/reglas Windows ni datos previos del usuario.

- Acceso desde Windows y navegador: http://127.0.0.1:18080/ (laboratorio).
- 15 comprobaciones del script offline aprobadas: publicación, topología, políticas,
  assets, CRUD REX, consulta SQL y persistencia tras reinicio.
- 234 tests generales aprobados en contenedor `--network none`.
- 51 tests PostgreSQL aprobados en red runtime interna y DB `lc1c_regression_test`.
- Backup pg_dump y pg_restore a `lc1c_restore_test` aprobados, sin sobreescribir origen.
- Reinicio del daemon Docker: tres servicios healthy, HTTP disponible, reglas de
  firewall conservadas y sonda TCP externa rechazada otra vez.
- Sonda DNS directa UDP/53 a 1.1.1.1 bloqueada; contador DROP creció. DNS externo
  vía resolver Docker devolvió SERVFAIL; DNS interno app/postgres funciona.
- Captura acotada 30 s en eth0 hacia 1.1.1.1 TCP/443 y UDP/53: 0 paquetes mientras
  se ejecutaban las sondas. NO es captura global de todo el tráfico del sistema.
- Navegador: inicio, Repuestos/dashboard/layout, REX/eventos reales de prueba,
  Reparaciones/plan y Acoplamientos renderizan. Sin errores de consola observados.
- Trivy 0.74 (digest del scanner en evidencia): app 5 críticos/83 altos; PostgreSQL
  16 críticos/102 altos; gateway 0 críticos/0 altos y 1 UNKNOWN. Son ocurrencias
  paquete/advisory, NO prueba de explotación remota. Ver `evidence/image-scan-summary.json`.

**Veredicto: funcionamiento sin Internet probado en el alcance anterior; NO una
certificación de seguridad total ni una aprobación para exponerlo a Internet.**
Auth/RBAC, TLS, rol DB de mínimo privilegio y triage/remediación de CVEs siguen
pendientes. No se cambiaron modelo/UX ni se inventó autenticación o certificados.
La instalación/build inicial y actualizar software requieren Internet o artefactos
precargados; el funcionamiento normal sigue requiriendo LAN/API/DB.

Las siguientes secciones preservan la evidencia del intento inicial y su fallo,
ya corregido. La decisión pendiente descrita abajo fue autorizada e implementada.

## Intento inicial: bloqueo de despliegue encontrado (histórico)

No desplegar todavía el Compose endurecido como versión aprobada. La red
exclusivamente `internal` permite el arranque y la comunicación app/DB, pero Docker
no materializa la publicación del puerto HTTP. No se quitó el aislamiento para
ocultar el fallo. Este resultado reemplaza las menciones previas a Engine ausente.

## Entorno y alcance

- Windows 10 Home, WSL 3.0.1.0, kernel 6.18.40.1-1, Ubuntu 24.04.5 LTS (WSL2).
- Docker Engine Community 29.8.2 y Compose 5.5.1, repositorio oficial Docker.
- No Docker Desktop. No cambios al firewall de Windows ni a la DB previa.
- Proyecto `lc1c-offline-audit`, DB `lc1c_offline_test`, volumen separado.
- Imagen `maintenance-lc1c:local`, índice
  `sha256:bd9e0ecce5043c4abda485d960534f0658a46b3fa1d214d34867422b1d6daae7`.
- Node 24.21.0 en imagen; PostgreSQL fijado al digest del Compose.
- WSL se mantiene abierto durante las pruebas con un proceso `sleep infinity`.
  No se creó tarea de inicio de Windows: esto es un laboratorio, no un servicio
  de producción con disponibilidad tras reinicio de host garantizada.

## Evidencia obtenida

| Verificación | Resultado |
|---|---|
| Build real: npm ci, Prisma generate, typecheck servidor, build:spares | PASS |
| npm audit durante build | 0 vulnerabilidades reportadas |
| Arranque sin build/pull, 9 migraciones, ambos healthchecks internos | PASS |
| App user=node, rootfs readonly, cap_drop ALL | PASS (inspect y arranque) |
| PostgreSQL sin puerto publicado | PASS |
| Crear/editar evento REX mediante API dentro del contenedor | PASS, revisión 1 → 2 |
| SQL directo y lectura API después de reiniciar app/PostgreSQL | PASS |
| Conexión TCP app → 1.1.1.1:443 | Bloqueada: ENETUNREACH |
| Publicación HTTP 127.0.0.1:18080 | FAIL |
| Navegador, segunda PC, HAR/PCAP, DNS/UDP y reinicio host sin Internet | Pendiente |

El registro descartable comprobado es `DOCKER ISOLATED PROBE updated`, ID
`952b9fd1-a16b-46d9-890a-65ba834c95cb`, estado CLOSED. Existe solamente en la DB
aislada de prueba. No contiene datos del usuario.

`HostConfig.PortBindings` solicita 127.0.0.1:18080, pero
`NetworkSettings.Ports` devuelve `{"3001/tcp":null}`. `curl` al puerto del host
falla con conexión rechazada. El script integral registró `Health timeout`;
se agregó una comprobación previa de publicación para diagnosticar este caso
sin esperar el timeout. Las pruebas API/SQL posteriores se ejecutaron dentro de
los contenedores; NO sustituyen una prueba completa desde cliente.

Evidencia local (ignorada por Git): `tmp/security/offline-result.json`, scripts
`probe-container.mjs`, `probe-after-restart.mjs`, `verify-offline-event.sql` y logs
de instalación WSL. Se conserva el stack de laboratorio para continuar.

## Decisión pendiente

Recomendación: aprobar un proxy HTTP de entrada separado, con puerto publicado,
manteniendo app/PostgreSQL en la red interna. La política de salida del proxy y
del host también debe definirse/probarse. Alternativa: red de entrada en app y
reglas de firewall específicas administradas por IT. Ninguna se implementó aún,
porque modifica la topología o las políticas del host.

El comportamiento coincide con la incidencia del proyecto
[Moby #53256](https://github.com/moby/moby/discussions/53256).
Consultar además la documentación oficial de
[publicación de puertos](https://docs.docker.com/engine/network/port-publishing/).
Un contenedor saludable no demuestra accesibilidad ni seguridad completa.

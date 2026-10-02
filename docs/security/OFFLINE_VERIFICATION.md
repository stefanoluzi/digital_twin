# Verificación offline reproducible para IT

Actualización 30/09/2026: Docker real en WSL2, publicación HTTP vía gateway resuelta.
Ensayo automatizado, tests PostgreSQL, backup/restore, reinicio contenedores/daemon,
sondas de egress y navegación básica aprobados. No es prueba exhaustiva de seguridad.
Ver [evidencia final y límites](DOCKER_LOCAL_VALIDATION.md).

## 1. Preparar artefactos en máquina conectada de la misma arquitectura

Docker Engine Linux con backend iptables + Compose, Node 24 para el script y checkout.
No usar datos productivos. `.env` propio nunca se exporta dentro de la imagen.

```sh
docker pull postgres:16-bookworm@sha256:efedf3595f1d6f415c08568ba171029bf54052e754cc9f030e3f2412b21f3d67
docker pull nginxinc/nginx-unprivileged:stable-alpine@sha256:ed04ec1ff34502c339ee5c3ae3f855442398edc1d05591e2b98981dcbbd20b1e
docker compose --env-file .env.example build app
docker image tag postgres:16-bookworm@sha256:efedf3595f1d6f415c08568ba171029bf54052e754cc9f030e3f2412b21f3d67 postgres:lc1c-offline-transfer
docker image tag nginxinc/nginx-unprivileged:stable-alpine@sha256:ed04ec1ff34502c339ee5c3ae3f855442398edc1d05591e2b98981dcbbd20b1e nginx:lc1c-offline-transfer
docker image save -o lc1c-images.tar maintenance-lc1c:local postgres:lc1c-offline-transfer nginx:lc1c-offline-transfer
sha256sum lc1c-images.tar
```

PowerShell: `Get-FileHash .\lc1c-images.tar -Algorithm SHA256`.
Copiar imagen, checksum y checkout a VM aislada; verificar checksum y `docker load -i`.
Comprobar que `docker image inspect` acepta EXACTAMENTE la referencia digest de Compose:
algunas versiones de Docker no conservan RepoDigests al save/load (comprobar también gateway). Si no la conserva,
usar en una copia de Compose para esa VM la etiqueta transferida `postgres:lc1c-offline-transfer`,
verificar el ID contra el de origen y mantener `pull_policy: never`. NO quitar la política
ni conectar Internet para ocultar un fallo. Registrar cambio e ID en la evidencia.
El tag de app es local, no `latest`; archivar checksum/image ID de cada entrega.
Las bases están fijadas por digest. El build inicial NO es offline ni reproducible bit a bit
(APT y lifecycle scripts pueden descargar); la imagen final es el artefacto a transportar.

## 2. Bloqueo y captura de red

IT debe preparar VLAN/VM de prueba SIN ruta a Internet ni DNS externo, manteniendo LAN
cliente-servidor y acceso al daemon. No cambiar firewall productivo para este ensayo.
Las redes runtime/frontend internal y `scripts/docker-egress-policy.sh` en sus bridges
y edge bloquean egress de los servicios, pero no basta
como evidencia de paquetes ni bloquea tráfico propio del navegador/daemon/SO.

Antes del arranque, iniciar captura en interfaz WAN/externa y bridge de Docker con
Wireshark o tcpdump ya instalado. Ejemplo Linux (sustituir interfaz real):

```sh
sudo tcpdump -ni INTERFAZ_EXTERNA -w offline-egress.pcap '(port 53 or port 80 or port 443)'
```

Capturar también todo IP si IT necesita descartar otros protocolos; comparar IPs de
contenedores obtenidas con `docker inspect`. En DNS, verificar queries externas,
no solo TCP: UDP/53 y forwarding del daemon también importan. Usar logs del firewall
para intentos bloqueados. Distinguir tráfico SO/navegador (updates, OCSP, extensiones)
del tráfico app. No inferir "cero intentos" a partir de un timeout TCP.

## 3. Prueba automatizada aislada

Con puerto 18080 libre, imágenes preinstaladas y sin stack llamado lc1c-offline-audit:

```sh
sudo node scripts/test-offline.mjs --run
```

El script usa proyecto/volumen separados, base `lc1c_offline_test` y credenciales
descartables exclusivas de prueba. NO lee contraseña productiva. Conserva el stack
para inspección. Aplica reglas SOLO a bridges lc1c-audit-e/f/r. Verifica redes por
servicio, no publicación app/DB, entrada por gateway, arranque sin build/pull,
bloqueo TCP 1.1.1.1:443, HTML/assets de entrada, alta/edición de evento REX, SQL directo,
reinicio y persistencia. Salida: `tmp/security/offline-result.json`.
No cubre navegador, todos los módulos ni captura de paquetes: completar el paso 4.
Las 51 pruebas PostgreSQL pasaron dentro de runtime internal, sin salida a Internet.

Para repetir tras inspeccionar evidencia, eliminar SOLO stack de ensayo:

```sh
docker compose --env-file .env.example -p lc1c-offline-audit down -v
```

Nunca ejecutar ese comando sin `-p lc1c-offline-audit` ni sobre producción.

## 4. Matriz navegador bajo bloqueo (navegación básica hecha; matriz exhaustiva pendiente)

Abrir navegador limpio sin extensiones y DevTools Network, Disable cache, Preserve log.
No usar "Offline" de DevTools: también bloquearía la API LAN legítima. Exportar HAR.

1. `http://127.0.0.1:18080/`: home, fuentes, tema, navegación y recarga completa.
2. Repuestos: crear categoría/GMB/área/equipo según flujo, repuesto y unidad;
   adjuntar PNG/PDF local, editar, eliminar fixture, exportar. Ver layouts y gráficos.
3. Acoplamientos: registrar inspección con foto, editar, historial y recarga.
4. Taller: crear solicitud/plan, cambiar estado/entrega y recargar.
5. REX: configurar tarifa, crear tarea/estimación, evento, parcial y resolver pendiente.
6. Abrir segundo cliente autorizado: mismos registros; verificar tras restart DB/app.
7. Digital Twin/Planner NO están en la imagen dist-spares integrada. Para auditar esos
   builds también, servir `dist` y `dist-planner` localmente (con cabeceras equivalentes)
   y probar escena 3D, textura local, import/export y PDF incluyendo CJK/standard fonts.
8. Revisar HAR: todos los recursos necesarios son mismo origen/data/blob; errores CSP,
   DNS, HTTP externo o recursos faltantes = FAIL. Links documentales externos son
   navegación manual: no hacer click en ellos para la prueba normal; catalogarlos aparte.
9. Reiniciar VM sin Internet; `docker compose up -d --no-build --pull never` debe funcionar.
   Con imágenes presentes, `docker compose up -d` también usa política never. Para
   garantizar fallo si falta la imagen app (sin intentar build), usar --no-build
   --pull never. No usar --build durante arranque offline.

No hay login que probar. Probar pérdida de servidor por separado: offline significa
sin Internet, NO sin conexión del cliente a la API/PostgreSQL de la LAN.

## 5. Puertos y evidencia

```sh
docker compose ps
docker compose port gateway 8080
docker compose port postgres 5432
ss -lntp
curl --fail http://IP_VM:8080/api/health
curl -I http://IP_VM:8080/
```

El comando port postgres debe indicar que no existe publicación. Windows:
`Get-NetTCPConnection -State Listen` o `netstat -ano`.
Desde segunda PC: `Test-NetConnection IP_VM -Port 8080` True (si autorizado) y
`Test-NetConnection IP_VM -Port 5432` False. Si otro servicio legítimo usa 5432,
correlacionar PID/contenedor: no detenerlo ni atribuirlo automáticamente a esta app.

Registrar versiones Docker/OS, imagen IDs/digests, commit, IP/bind/firewall, timestamps,
HAR, PCAP, logs de denegación, resultado JSON, `compose ps`, consultas SQL y capturas
de los flujos. Borrar/redactar datos sensibles de HAR/logs antes de entregarlos.

## 6. Pruebas de código ya disponibles

```sh
npm ci
npm run db:generate
npm test
npm run test:postgres
npm run typecheck:server
npx prisma validate
npm run build
npm run build:spares
npm run build:planner
npm run build:lco
node scripts/check-offline-assets.mjs
npm run check:compose
node scripts/security-inventory.mjs
```

`test:postgres` requiere TEST_DATABASE_URL terminado en _test y reemplaza fixtures de
esa base. Nunca apuntarlo a producción. `security-inventory` requiere Internet para
actualizar npm audit/SBOM (solo mantenimiento, no runtime). En Linux definir
NPM_CLI_PATH al npm-cli.js instalado para generar esos dos archivos. No hay script lint
configurado ni backend build emitido: backend se typecheckea y ejecuta mediante tsx.

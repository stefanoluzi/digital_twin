# Checklist IT — 2026-09-30

FAIL = hallazgo pendiente o validación no ejecutada; consultar explicación.
Actualización Docker real: [evidencia final y límites](DOCKER_LOCAL_VALIDATION.md).

- [PASS] Arquitectura documentada; navegador -> API -> PostgreSQL.
- [PASS] Compose declara gateway, app y postgres; solo gateway publica HTTP.
- [PASS] Publicación HTTP real y navegación básica desde Windows.
- [PASS] Políticas egress de tres bridges Linux y persistencia systemd; no modifica Windows.
- [PASS] PostgreSQL sin ports públicos; red internal declarada.
- [PASS] Validación del modelo Compose sin Docker Engine.
- [PASS] Imágenes base referenciadas por digest, no latest.
- [PASS] pull_policy never; arranque wrapper no instala dependencias.
- [PASS] Fuentes/PDF requeridos empaquetados localmente (ver build/asset check).
- [PASS] Checkpoint Prisma desactivado para arranque contenedor.
- [PASS] Sin API externa/analytics integrados hallados en fuente propia.
- [PASS] Headers/CSP y rechazo de Origin inválido/cross-site cubiertos por tests.
- [PASS] No CORS wildcard; JSON requerido para escritura.
- [PASS] Sin SQL Unsafe ni shell con entrada HTTP hallados.
- [PASS] .env real ignorado/excluido Docker; no secretos reales detectados.
- [PASS] npm audit 0 critical/high/moderate/low en informe fechado.
- [PASS] SBOM e inventario de lifecycle scripts generados.
- [PASS] Pruebas PostgreSQL reales y persistencia local.
- [FAIL] Auth/RBAC inexistentes: IT debe aceptar aislamiento o exigir solución.
- [FAIL] TLS no incorporado: implementar en infraestructura autorizada.
- [FAIL] App utiliza rol PostgreSQL inicial administrador; separar privilegios.
- [FAIL] Rate limiting/cuotas/antimalware de adjuntos pendientes.
- [PASS] Scan Trivy de las tres imágenes ejecutado, evidencia fechada disponible.
- [FAIL] Trivy reporta críticos/altos en app/DB; triage y remediación pendientes.
- [PASS] Docker build/arranque readonly y healthchecks ejecutados en WSL2.
- [PASS] CRUD API/SQL internos y persistencia después de reiniciar contenedores.
- [FAIL] Reinicio VM sin Internet/no-pull pendiente de observación real.
- [PASS] Sondas TCP/443 y DNS/UDP53 bloqueadas; captura acotada eth0 0 paquetes, contador DROP >0.
- [FAIL] Captura exhaustiva de tráfico, HAR completo y evaluación de todos los flujos pendientes.
- [FAIL] Matriz navegador offline (3D/PDF/fuentes/CRUD) y segundo cliente pendientes.
- [PASS] Restore pg_dump a una DB separada bajo aislamiento y SQL verificado.
- [NOT APPLICABLE] Login propio: no existe; no fue inventado.
- [NOT APPLICABLE] NoSQL/Redis/Adminer/pgAdmin: no servicios del despliegue.
- [NOT APPLICABLE] Lint: no configuración/script existente (no se informa como aprobado).

Antes de aprobación, IT debe adjuntar resultados de OFFLINE_VERIFICATION.md y convertir
cada FAIL pendiente a PASS con fecha/evidencia o aceptación explícita de riesgo.

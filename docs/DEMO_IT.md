# Demo IT — Planta

Preparada el 01/10/2026. URL local: http://127.0.0.1:18080/.

La aplicación de laboratorio apunta a `planta_demo_it`, una base PostgreSQL separada.
La base anterior `lc1c_offline_test` y los datos originales no se borraron ni importaron.
El cambio de nombre es de presentación y códigos nuevos: se preservan las claves de
almacenamiento legado y la lectura del formato anterior de backups por compatibilidad.
Los nuevos backups usan `PLANTA_CRITICAL_SPARES`.

## Contenido ficticio

- 39 repuestos, 42 unidades, 11 áreas y 4 responsables identificados como Demo.
- Unidades disponibles, instaladas, en reparación y en compra, con fechas y referencias ficticias.
- 8 inspecciones y 1 recambio de acoplamiento; desgaste y antigüedad variados.
- 12 necesidades de taller con entregas, compromisos, bloqueos y trabajo futuro.
- 8 tareas REX, 3 eventos, 8 intervenciones, alcances parciales y estimaciones ficticias en USD.

Los datos se cargaron por la API, con validación y control de revisión. Las fechas de
las operaciones son simuladas; las marcas de auditoría corresponden a la carga real.
No se inventaron semanas de mediciones históricas de cobertura.

## Recorrido sugerido para grabar

1. Inicio: presentar los cuatro módulos y el nombre genérico Planta.
2. Repuestos: cobertura global, por área, por responsable; filtrar por reparación/compra.
3. Taller: mostrar plan mensual, necesidades vencidas, entregadas y bloqueadas.
4. Acoplamientos: abrir una posición, su historial y seguimiento por antigüedad.
5. REX: mostrar una tarea, recursos/costos, una intervención parcial y sus pendientes.
6. Recargar para mostrar persistencia compartida en PostgreSQL.

## Reproducir la carga

El script `scripts/seed-demo-it.ts` apunta exclusivamente a localhost:18080. Exige
`--confirm-demo` y comprueba que los cuatro módulos estén vacíos antes de escribir.
Preparar primero una base exclusiva de demostración y apuntar el contenedor app a ella:

```sh
npx tsx scripts/seed-demo-it.ts --confirm-demo
```

No ejecutar contra una base operativa. No borra registros para poder repetir la carga.
El switch de recuperación `--resume-rex` solo admite el estado parcial exacto de esta
demo (39 repuestos, 12 necesidades, 9 controles, 3 eventos demo y ninguna tarea REX).

En esta PC el lanzador local ignorado `tmp/security/start-demo.mjs` conserva los puertos,
redes y credenciales del laboratorio y selecciona `planta_demo_it`. Ejecutarlo dentro
de Ubuntu/WSL desde la raíz del repositorio con el Node Linux disponible. Para otra VM,
seguir la guía de despliegue y usar sus propias credenciales; no copiar las del laboratorio.

El dump completo de la demo se conserva localmente en `tmp/security/planta-demo-it.dump`.
Los datos ficticios son para mostrar funcionalidad; esta demo no acredita autenticación
ni elimina los pendientes de seguridad documentados en la auditoría.

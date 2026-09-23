# Mantenimiento LC1C

Un frontend React, un backend Express y una base PostgreSQL (Prisma 6).
El shell está en `src/platform/MaintenancePlatform.tsx`; el build histórico
`build:spares` produce ahora toda la plataforma en `dist-spares`.

## Dominios

- Repuestos: `src/spares`, API existente `/api/state`, `/api/config`, `/api/spares`,
  `/api/units`, etc. Conserva modelo, UI y revisión `Revision` existentes.
- Controles Críticos / Acoplamientos: `src/apps/maintenance/Lco*`,
  `src/maintenance/domain/lco*`, `services/lcoCentralService.ts`,
  `repositories/HttpLcoRepository.ts`, backend `server/lco/router.ts`.
  Tablas Lco* y revisión LcoConfig independientes de Repuestos.
- Infraestructura compartida: `server/app.ts`, `server/db.ts`, Prisma, validación
  de origen, errores HTTP, Docker y utilidad UUID segura `src/utils/createUuid.ts`.

## Rutas

`/` selector; `/repuestos`; `/controles-criticos` selector de controles;
`/controles-criticos/acoplamientos`. Navegación global por enlaces, módulos lazy.
Menús internos permanecen separados. El servidor devuelve el shell para rutas SPA.

No se sustituyó el editor Digital Twin ni Planner: sus entradas y builds siguen
en el repositorio, fuera del despliegue de esta plataforma.

## Persistencia

Frontend → HTTP → transacción PostgreSQL. El cliente aplica únicamente respuestas
confirmadas. No hay autosave operativo LCO ni fallback local. IndexedDB se abre solo
por la utilidad explícita de migración; localStorage conserva preferencias visuales,
no registros LCO. Zustand es un snapshot en memoria, no una base de datos.

Escrituras con If-Match; bloqueo de fila de revisión; 409 ante concurrencia.
Los KPIs no se almacenan. Los selectores puros calculan a partir del historial completo;
el backend también ofrece `/summary`. Fechas civiles YYYY-MM-DD no se convierten a UTC;
timestamps de auditoría sí son instantes ISO.

## Extensión futura

Agregar una entrada al registro `criticalControls` del shell, un componente lazy y
sus rutas. Crear validación, servicio HTTP, router y modelos/migración del nuevo
dominio. Reutilizar Express/Prisma/Compose, no la tabla de repuestos ni un modelo
genérico de control antes de conocer sus necesidades.

## Límites

Sin autenticación real ni HTTPS: solo LAN confiable. El actor declarado no es una
identidad verificada. Snapshot completo y fotos base64 adecuados al volumen actual;
se requerirán paginación/almacenamiento de archivos si el historial crece mucho.
LcoEventVersion incluye fotos para conservar correcciones: aumenta tamaño de DB.
No hay polling automático: usar Actualizar datos en otro cliente.
Componentes LCO existentes grandes y repositorio legacy retenido para migración/tests;
no están reescritos ni eliminados para evitar pérdida de compatibilidad.

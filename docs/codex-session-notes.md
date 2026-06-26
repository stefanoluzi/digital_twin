# Codex session notes - Industrial Digital Twin MVP

Fecha de trabajo: 2026-06-24

## Objetivo del proyecto

Construir y estabilizar un MVP web para un editor 3D industrial tipo digital twin/layout viewer para una planta de laminacion continua.

La app permite cargar/editar activos industriales sobre una escena 3D, importar un layout de planta como imagen sobre el piso, usar controles visuales de transformacion, buscar activos, editar metadata y exportar/importar la escena como JSON.

## Stack

- Vite
- React
- TypeScript
- Three.js
- React Three Fiber
- Drei
- Zustand

## Estructura principal

- `src/App.tsx`
- `src/main.tsx`
- `src/types/plant.ts`
- `src/store/sceneStore.ts`
- `src/data/plant.json`
- `src/utils/objectFactory.ts`
- `src/components/Scene/PlantScene.tsx`
- `src/components/Scene/IndustrialObject.tsx`
- `src/components/Scene/Floor.tsx`
- `src/components/Sidebar/ObjectLibrary.tsx`
- `src/components/Inspector/ObjectInspector.tsx`
- `src/components/Toolbar/Toolbar.tsx`
- `src/styles.css`

## Features implementadas

### Escena 3D

- Canvas ortografico con camara isometrica.
- Grid y piso.
- OrbitControls.
- Gizmo de ejes.
- Objetos industriales renderizados con geometrias simples.
- Coordenadas:
  - X = ancho de planta
  - Z = largo de planta
  - Y = altura

### Tipos de objetos soportados

- `gearbox`
- `motor`
- `roller`
- `roller_table`
- `pump`
- `tank`
- `conveyor`
- `generic_box`

### Edicion de objetos

- Seleccion por click.
- Resaltado de objeto seleccionado.
- Inspector derecho.
- TransformControls para:
  - mover
  - rotar
  - escalar
- OrbitControls se desactiva durante drag de TransformControls.
- Escalado confirmado al soltar para evitar loops y acumulacion de escala.

### Snap

- Snap activable/desactivable.
- Grid size editable, default `0.5`.
- Posicion X/Z snap a grilla.
- Rotacion Y snap a 15 grados.
- Dimensiones snap a 0.1.

### Layout de planta

- Importar PNG/JPG.
- Mostrar como textura horizontal sobre el piso.
- Mostrar/ocultar layout.
- Ajustar escala.
- Ajustar opacidad.
- Centrar layout en origen.

### Inspector

Secciones:

- Identidad
- Geometria
- Ubicacion
- Datos externos
- Notas

Campos:

- ID
- Nombre
- Tipo
- Area
- Sistema
- Color manual
- Criticidad
- Dimensiones
- Posicion
- Rotacion
- Tags
- Descripcion
- Data sources

Botones:

- Copiar ID
- Centrar camara

### Busqueda

Permite buscar por:

- ID
- nombre
- tipo
- area
- sistema
- tags

Al seleccionar un resultado:

- selecciona el activo
- centra la camara
- lo resalta

### Labels

- Mostrar/ocultar globalmente.
- Alternar entre ID y nombre.
- No bloquean clicks porque tienen `pointerEvents: 'none'`.

### Colores por criticidad

Modos:

- color manual
- color por criticidad

Mapeo:

- A = rojo
- B = naranja
- C = amarillo
- D = verde
- sin criticidad = gris

El color manual original se conserva.

### Persistencia

Export JSON v2 incluye:

- objetos
- layout
- snap settings
- view settings

LocalStorage usa:

- `industrial-twin-scene-v2`

Tambien hay compatibilidad de carga con escenas v1 basadas solo en array de objetos.

## Bugs encontrados y corregidos

### Store / JSON / persistencia

- Importacion JSON demasiado estricta para objetos incompletos.
- Objetos con campos faltantes podian generar `undefined`.
- Valores numericos invalidos podian llegar a Three.js.
- IDs duplicados podian romper seleccion/render por `key` repetida.
- IDs vacios podian dejar estado inconsistente.
- Layout importado desde JSON incompleto podia quedar invalido.
- Snap settings invalidos podian romper grid/snapping.
- Color invalido podia romper input `type=color`.

Fix:

- Normalizacion fuerte en `sceneStore.ts`.
- Fallbacks para strings, numeros, colores, tipos, sistemas y criticidad.
- IDs unicos al agregar/editar/importar.
- Normalizacion de layout, snap y view settings.

### Inspector

- Inputs numericos vacios podian producir `NaN`.
- Valores negativos/cero en dimensiones podian romper geometrias.
- Clipboard podia producir promise rejection silencioso.
- Caracteres corruptos/mojibake visibles.

Fix:

- Parser numerico tolerante a coma decimal.
- Fallbacks al valor anterior si el input no es valido.
- Dimensiones minimas.
- Clipboard con catch.
- Archivo reemplazado con texto ASCII/UTF-8 limpio.

### Scene / TransformControls

- `TransformControls` podia montarse antes de tener el objeto 3D real.
- Escalado en vivo multiplicaba escala visual y dimensiones del store.
- Escala negativa/cero podia dejar dimensiones invalidas.
- OrbitControls podia quedar deshabilitado si el control se desmontaba durante drag.
- Camara inicial no tenia `lookAt` explicito.

Fix:

- TransformControls solo se monta cuando existe el objeto target.
- Escalado se confirma al soltar.
- Escala usa valor absoluto y minimo.
- Cleanup reactiva OrbitControls.
- Camara mira al origen al crear Canvas.

### Visual / render

- La via de rodillos se veia oscura/grisacea.
- Sombras/materiales demasiado pesados para un editor tecnico.
- Helpers internos de TransformControls podian aportar ruido visual.

Fix:

- Materiales menos metalicos.
- Mayor luz ambiente.
- Piso y grilla mas claros.
- Emision suave del color del activo.
- Gizmo mas chico y en `space="world"`.

### Sidebar / busqueda

- Busqueda podia fallar con tags/campos incompletos.
- Caracteres corruptos visibles.

Fix:

- Busqueda defensiva usando `String(value ?? '')`.
- Reemplazo de iconos unicode problemáticos por texto simple.

### Datos iniciales

- `plant.json` tenia texto corrupto en tags/descripciones.

Fix:

- Reescritura limpia de datos iniciales.

## Comandos utiles

Instalar dependencias:

```bash
npm install
```

Levantar dev server:

```bash
npm run dev
```

Abrir en Chrome:

```text
http://127.0.0.1:5173/
```

Build:

```bash
npm run build
```

## Verificaciones realizadas

- `npm install` OK.
- `npm run build` OK.
- JSON base validado.
- Servidor dev respondiendo en `http://127.0.0.1:5173/` con status 200.
- Sin caracteres corruptos restantes en `src`.

Nota: el build muestra warning de bundle grande por Three.js/Drei. No es critico para este MVP.

## Limitaciones conocidas

- No se pudo usar navegador embebido de Codex desde Antigravity en esta sesion. Error observado: `Browser is not available: iab`.
- Las pruebas visuales se hicieron con screenshots del usuario + inspeccion de codigo + build + servidor local.
- No hay suite automatizada de tests todavia.
- El layout importado se exporta como data URL si el navegador lo permite; imagenes muy grandes pueden generar JSON pesado.

## Recomendaciones para la siguiente iteracion

- Agregar tests unitarios para `sceneStore`.
- Agregar validacion de JSON importado con un schema mas formal.
- Agregar un modo visual "CAD flat" si se quiere evitar por completo sombreado 3D.
- Agregar un boton de reset de localStorage solo para desarrollo si aparecen estados viejos contaminados.
- Considerar code splitting para reducir warning de bundle grande.


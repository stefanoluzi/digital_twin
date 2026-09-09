# Industrial Digital Twin MVP

Industrial Digital Twin MVP is a web-based 3D plant layout editor for modeling and inspecting industrial assets in a technical scene. The current version focuses on a stable MVP for arranging equipment, editing metadata, importing layouts, and exporting the scene as JSON.

## Project Objective

The goal of this project is to provide an interactive digital twin editor for industrial plant layouts. It allows users to place industrial equipment, inspect and edit asset metadata, visualize assets in a 3D scene, and persist the scene locally or through JSON export/import.

## Tech Stack

- React
- TypeScript
- Vite
- Three.js
- React Three Fiber
- Drei
- Zustand

## General Architecture

The application is organized around a central Zustand scene store and a set of React UI panels around a React Three Fiber canvas.

- `src/store/sceneStore.ts`: scene state, object updates, selection, persistence, import/export, layout and view settings.
- `src/components/Scene/`: 3D canvas, floor, objects, labels, camera controls, and transform interactions.
- `src/components/Toolbar/`: file actions, snap settings, label toggles, color mode, duplication and deletion.
- `src/components/Sidebar/`: asset library and search.
- `src/components/Inspector/`: selected asset metadata and geometry editing.
- `src/types/`: shared TypeScript domain types.
- `src/data/`: initial plant data.
- `src/utils/`: object factory helpers.

## Running the Project

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local app:

```text
http://127.0.0.1:5173/
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Standalone LCO Couplings

Open `http://127.0.0.1:5173/lco-couplings` to use the LCO coupling inspection module without loading a plant project or the 3D editor. Inspections, replacements, configuration, and photo blobs are saved automatically in the browser's versioned IndexedDB database (`LACO1_MAINTENANCE`).

This storage belongs to the current browser profile and device. It is not synchronized between computers. Use **Guardar respaldo** and **Importar respaldo** to move or recover the complete portable dataset, including photos. Use **Exportar Excel** to produce a human-readable report with a summary, the current state of all 32 couplings, the full inspection/replacement history, and photo metadata.

The repository also includes a dedicated LCO-only build. It does not bundle the 3D editor or the rest of the Maintenance platform:

```bash
npm run dev:lco
npm run build:lco
npm run preview:lco
```

`npm run build:lco` creates `dist-lco/`, a portable Windows folder containing the static application, a local server, `Iniciar Acoplamientos LCO.bat`, and a Spanish quick-start guide. Copy or zip the entire folder. The destination PC only needs Node.js LTS; it does not need this repository or `npm install`.

## Available Commands

- `npm run dev`: starts the Vite development server.
- `npm run dev:lco`: starts only the standalone LCO application on port 5174.
- `npm run build`: runs TypeScript project build and creates the Vite production bundle.
- `npm run build:lco`: creates the portable LCO-only bundle in `dist-lco/`.
- `npm run preview`: serves the production build locally.
- `npm run preview:lco`: previews the standalone LCO production build on port 4174.

## Project Structure

```text
.
├── docs/
│   └── codex-session-notes.md
├── src/
│   ├── components/
│   │   ├── Inspector/
│   │   ├── Scene/
│   │   ├── Sidebar/
│   │   └── Toolbar/
│   ├── data/
│   ├── store/
│   ├── types/
│   ├── utils/
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

## Roadmap

- Add automated tests for the scene store and JSON import/export.
- Add schema validation for imported scene documents.
- Improve UX around transform controls and camera navigation.
- Add optional code splitting to reduce the production bundle warning.
- Add project-level documentation for scene JSON format.
- Consider a formal asset library and reusable equipment presets.

## License

MIT for now.

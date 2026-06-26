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

## Available Commands

- `npm run dev`: starts the Vite development server.
- `npm run build`: runs TypeScript project build and creates the Vite production bundle.
- `npm run preview`: serves the production build locally.

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

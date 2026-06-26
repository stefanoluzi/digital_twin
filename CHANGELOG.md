# Changelog

All notable changes to this project will be documented in this file.

## v0.1.0

### Added

- Initial React, TypeScript and Vite application setup.
- 3D industrial plant editor built with Three.js, React Three Fiber and Drei.
- Zustand scene store for asset state, selection, view settings, snap settings and persistence.
- Orthographic 3D scene with floor, grid, axes helper, OrbitControls and viewport gizmo.
- Industrial asset types:
  - gearbox
  - motor
  - roller
  - roller_table
  - pump
  - tank
  - conveyor
  - generic_box
- Asset library for adding objects to the scene.
- Object selection, highlighting and inspector integration.
- Inspector for editing identity, type, geometry, position, rotation, color, criticality, tags, description and external data sources.
- Move, rotate and scale editing flows.
- Snap settings for grid movement, rotation and scale.
- Layout image import support for PNG/JPG floor overlays.
- Toolbar actions for new scene, save/load localStorage, JSON export/import, duplicate and delete.
- Search by ID, name, type, area, system and tags.
- Labels with ID/name modes.
- Color modes for manual colors and criticality-based colors.
- JSON document format including objects, layout, snap settings and view settings.

### Stabilized

- Defensive scene import and object normalization.
- Unique ID handling for duplicate or imported objects.
- Numeric input handling to avoid invalid values and `NaN`.
- Object dimensions clamped to safe positive minimums.
- LocalStorage scene persistence.
- Label rendering behavior with orthographic camera.
- Direct object movement in the 3D scene.
- Context menu actions for editing, centering and deleting scene objects.

### Known Notes

- The production build currently emits a bundle-size warning because Three.js and Drei are included in the main bundle.
- No automated test suite is included yet.

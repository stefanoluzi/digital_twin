import type { PlantAreaCode } from '../config/areas'

/** Delimitaciones medidas sobre LAYOUT-1.png (1838 × 570) y expresadas en %.
 * La imagen de fondo es LAYOUT.png, de idéntica resolución.
 */
export type PlantLayoutArea = {
  id: Exclude<PlantAreaCode, 'UNASSIGNED'>
  x: number
  y: number
  width: number
  height: number
  /** Contorno irregular en el viewBox del plano original (1838 × 570). */
  path?: string
  labelX?: number
  labelY?: number
}

/** El arco sigue el círculo exterior del horno del plano: centro ~367,271; radio 120 px. */
export const HG_PERIMETER_PATH = 'M 421 139 H 628 V 267 H 487 A 120 120 0 1 1 421 164 V 139 Z'

export const PLANT_LAYOUT_AREAS: PlantLayoutArea[] = [
  { id: 'COBA',   x: 0.3,  y: 10.9, width: 12.1, height: 27.8 },
  { id: 'HG',     x: 13.4, y: 24.4, width: 20.8, height: 44.2, path: HG_PERIMETER_PATH, labelX: 367, labelY: 271 },
  { id: 'LP',     x: 26.9, y: 51.8, width: 14.4, height: 11.4 },
  { id: 'REMA',   x: 25.1, y: 64.9, width: 7.6,  height: 12.5 },
  { id: 'LCO',    x: 32.7, y: 64.9, width: 8.6,  height: 12.5 },
  { id: 'ZTREF',  x: 41.3, y: 57.8, width: 13.2, height: 19.6 },
  { id: 'HBM',    x: 54.5, y: 57.8, width: 10.5, height: 19.6 },
  { id: 'LRE',    x: 65.0, y: 57.8, width: 5.9,  height: 19.6 },
  { id: 'CESTOS', x: 32.4, y: 77.8, width: 34.7, height: 17.4 },
  { id: 'SHA',    x: 67.1, y: 77.8, width: 5.4,  height: 17.4 },
  { id: 'PENF',   x: 72.5, y: 57.8, width: 24.8, height: 37.4 },
]

export type PlantLayoutAdjustment = { offsetX: number; offsetY: number; scaleX: number; scaleY: number }

export const DEFAULT_PLANT_LAYOUT_ADJUSTMENT: PlantLayoutAdjustment = { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 }

const KEY = 'critical-spares:plant-layout-adjustments:v1'
const finite = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function normalizePlantLayoutAdjustment(value: unknown): PlantLayoutAdjustment {
  const candidate = value && typeof value === 'object' ? value as Partial<PlantLayoutAdjustment> : {}
  return {
    offsetX: clamp(finite(candidate.offsetX, 0), -10, 10),
    offsetY: clamp(finite(candidate.offsetY, 0), -10, 10),
    scaleX: clamp(finite(candidate.scaleX, 1), .5, 1.5),
    scaleY: clamp(finite(candidate.scaleY, 1), .5, 1.5),
  }
}

export function readPlantLayoutAdjustments(): Record<string, PlantLayoutAdjustment> {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, unknown>
    return Object.fromEntries(Object.entries(parsed).map(([id, value]) => [id, normalizePlantLayoutAdjustment(value)]))
  } catch { return {} }
}

export function savePlantLayoutAdjustments(value: Record<string, PlantLayoutAdjustment>) {
  try { localStorage.setItem(KEY, JSON.stringify(value)) } catch { /* La calibración sigue activa durante esta sesión. */ }
}

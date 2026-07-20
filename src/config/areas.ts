export const PLANT_AREAS = [
  { code: 'COBA', name: 'Corte de Barras', color: '#ef4444' },
  { code: 'HG', name: 'Horno Giratorio', color: '#f97316' },
  { code: 'LP', name: 'Laminador Perforador', color: '#eab308' },
  { code: 'LCO', name: 'Laminador Continuo', color: '#22c55e' },
  { code: 'ZTREF', name: 'Zona de Transferencia', color: '#06b6d4' },
  { code: 'REMA', name: 'Recirculacion de Mandriles', color: '#3b82f6' },
  { code: 'LRE', name: 'Laminador Rectificador Estirador', color: '#8b5cf6' },
  { code: 'PENF', name: 'Plano de Enfriamiento', color: '#14b8a6' },
  { code: 'SHA', name: 'Sierra de Haces', color: '#f59e0b' },
  { code: 'CESTOS', name: 'Cestos', color: '#84cc16' },
  { code: 'UNASSIGNED', name: 'Sin asignar', color: '#9ca3af' },
] as const

export type PlantAreaCode = (typeof PLANT_AREAS)[number]['code']
export type AreaFilter = 'ALL' | PlantAreaCode

export const DEFAULT_AREA_CODE: PlantAreaCode = 'UNASSIGNED'
export const AREA_FILTER_ALL: AreaFilter = 'ALL'

export const AREA_BY_CODE = Object.fromEntries(PLANT_AREAS.map((area) => [area.code, area])) as Record<PlantAreaCode, (typeof PLANT_AREAS)[number]>

export function normalizeAreaCode(value: unknown): PlantAreaCode {
  return typeof value === 'string' && value in AREA_BY_CODE ? value as PlantAreaCode : DEFAULT_AREA_CODE
}

export function areaLabel(code: PlantAreaCode) {
  const area = AREA_BY_CODE[code]
  return code === DEFAULT_AREA_CODE ? area.name : `${area.code} - ${area.name}`
}

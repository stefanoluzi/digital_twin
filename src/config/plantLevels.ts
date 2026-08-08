export const LEVEL_0 = 'LEVEL_0' as const
export const LEVEL_1 = 'LEVEL_1' as const
export const MULTI_LEVEL = 'MULTI_LEVEL' as const
export const ALL_LEVELS = 'ALL' as const
export const REFERENCE_LAYOUT_Y_OFFSET = 0.01

export type PlantLevelCode = typeof LEVEL_0 | typeof LEVEL_1 | typeof MULTI_LEVEL
export type InsertionLevelCode = typeof LEVEL_0 | typeof LEVEL_1
export type VisibleLevelFilter = typeof ALL_LEVELS | PlantLevelCode

export interface PlantLevelDefinition {
  code: PlantLevelCode
  name: string
  elevation: number | null
}

export const DEFAULT_PLANT_LEVELS: PlantLevelDefinition[] = [
  { code: LEVEL_0, name: 'Nivel 0', elevation: 0 },
  { code: LEVEL_1, name: 'Nivel 1', elevation: 6 },
  { code: MULTI_LEVEL, name: 'Multi-nivel', elevation: null },
]
export const DEFAULT_ACTIVE_LEVEL: InsertionLevelCode = LEVEL_1
export const DEFAULT_VISIBLE_LEVEL_FILTER: VisibleLevelFilter = LEVEL_1

export function normalizeLevelCode(value: unknown): PlantLevelCode {
  return value === LEVEL_0 || value === MULTI_LEVEL ? value : LEVEL_1
}
export function normalizeInsertionLevel(value: unknown): InsertionLevelCode {
  return value === LEVEL_0 ? LEVEL_0 : LEVEL_1
}
export function normalizeVisibleLevelFilter(value: unknown): VisibleLevelFilter {
  return value === LEVEL_0 || value === LEVEL_1 || value === MULTI_LEVEL ? value : ALL_LEVELS
}
export function normalizePlantLevels(value: unknown): PlantLevelDefinition[] {
  const raw = Array.isArray(value) ? value : []
  return DEFAULT_PLANT_LEVELS.map((fallback) => {
    const candidate = raw.find((item) => item && typeof item === 'object' && (item as PlantLevelDefinition).code === fallback.code) as Partial<PlantLevelDefinition> | undefined
    if (fallback.code === MULTI_LEVEL) return { ...fallback }
    const elevation = typeof candidate?.elevation === 'number' && Number.isFinite(candidate.elevation) ? candidate.elevation : fallback.elevation
    return { ...fallback, elevation }
  })
}
export function getLevelElevation(levels: PlantLevelDefinition[], code: InsertionLevelCode): number {
  const value = levels.find((level) => level.code === code)?.elevation
  return typeof value === 'number' && Number.isFinite(value) ? value : code === LEVEL_0 ? 0 : 6
}
export function isLevelVisible(levelCode: PlantLevelCode, filter: VisibleLevelFilter) {
  if (filter === ALL_LEVELS) return true
  if (filter === MULTI_LEVEL) return levelCode === MULTI_LEVEL
  return levelCode === filter || levelCode === MULTI_LEVEL
}
export function levelLabel(code: PlantLevelCode) {
  return code === LEVEL_0 ? 'Nivel 0' : code === LEVEL_1 ? 'Nivel 1' : 'Multi-nivel'
}

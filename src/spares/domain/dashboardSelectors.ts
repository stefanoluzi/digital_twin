import { OPERATIONAL_PLANT_AREAS } from '../../config/areas'
import type { CriticalSparesData, SpareType } from '../types'
import { areaResponsibleName, responsibleAreas, spareResponsibleId, responsibleDisplayName } from './areaResponsibility'
import { groupedCoverage, spareCoverage, unitsForSpare } from './spareSelectors'

export const COVERAGE_TARGET_PERCENT = 80

export type CoverageCause = 'REPAIR' | 'PURCHASE' | 'NO_ACTION'
export const COVERAGE_CAUSES: { id: CoverageCause; name: string; color: string }[] = [
  { id: 'REPAIR', name: 'En reparación', color: 'var(--sp-yellow)' },
  { id: 'PURCHASE', name: 'En compra', color: 'var(--sp-blue)' },
  { id: 'NO_ACTION', name: 'Sin acción registrada', color: 'var(--sp-red)' },
]

/** Una sola causa por tipo: reparación tiene prioridad sobre compra. */
export function principalCoverageCause(data: CriticalSparesData, spareId: string, now = new Date()): CoverageCause | null {
  const coverage = spareCoverage(data, spareId, now)
  if (coverage.covered) return null
  return coverage.repair ? 'REPAIR' : coverage.purchase ? 'PURCHASE' : 'NO_ACTION'
}

export function coverageCauses(data: CriticalSparesData) {
  const causes = data.spareTypes.map((spare) => principalCoverageCause(data, spare.id)).filter(Boolean)
  return COVERAGE_CAUSES.map((cause) => {
    const count = causes.filter((value) => value === cause.id).length
    return { ...cause, count, percent: causes.length ? Math.round(count / causes.length * 100) : 0 }
  })
}

export function coverageByArea(data: CriticalSparesData, order: 'operational' | 'worst' = 'worst') {
  const rows = groupedCoverage(data, OPERATIONAL_PLANT_AREAS.map((area) => ({ id: area.code, name: area.name })), 'area')
    .map((row) => ({ ...row, responsible: areaResponsibleName(data, row.id) }))
  return order === 'operational' ? rows : rows.sort(worstFirst)
}

export function coverageByGmb(data: CriticalSparesData) {
  const groups = data.config.responsibles.filter((person) => person.active !== false).map((person) => ({ ...person, name: responsibleDisplayName(person) }))
  return groupedCoverage(data, groups, 'gmb')
    .map((row) => ({ ...row, areas: responsibleAreas(data, row.id).map((area) => area.code), inactive: false }))
    .filter((row) => row.areas.length > 0)
    .sort(worstFirst)
}

function worstFirst(a: { total: number; percent: number; uncovered: number }, b: { total: number; percent: number; uncovered: number }) {
  return Number(!a.total) - Number(!b.total) || a.percent - b.percent || b.uncovered - a.uncovered
}

export type DashboardFilters = { query: string; area: string; category: string; responsible: string; equipment: string; coverage: string; unitState: string; cause: CoverageCause | 'ALL' }
export function filterDashboardSpares(data: CriticalSparesData, filters: DashboardFilters): SpareType[] {
  return data.spareTypes.filter((spare) => {
    const coverage = spareCoverage(data, spare.id)
    const haystack = [spare.sapNumber, spare.name, spare.description, spare.drawingNumber, spare.area,
      data.config.categories.find((item) => item.id === spare.categoryId)?.name, areaResponsibleName(data, spare.area),
      ...spare.compatibleEquipmentIds.map((id) => data.config.equipment.find((item) => item.id === id)?.name)].join(' ').toLowerCase()
    return (filters.unitState === 'ALL' || unitsForSpare(data, spare.id).some((unit) => unit.status === filters.unitState))
      && (!filters.query.trim() || haystack.includes(filters.query.trim().toLowerCase()))
      && (filters.area === 'ALL' || spare.area === filters.area)
      && (filters.category === 'ALL' || spare.categoryId === filters.category)
      && (filters.responsible === 'ALL' || spareResponsibleId(data, spare) === filters.responsible)
      && (filters.equipment === 'ALL' || spare.compatibleEquipmentIds.includes(filters.equipment))
      && (filters.coverage === 'ALL' || (filters.coverage === 'COVERED' ? coverage.covered : !coverage.covered))
      && (filters.cause === 'ALL' || principalCoverageCause(data, spare.id) === filters.cause)
  })
}

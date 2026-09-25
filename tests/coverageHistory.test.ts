import { describe, expect, it } from 'vitest'
import { captureCoverage, coverageChange, groupProgress, historyRange, type CoverageGroup } from '../src/spares/domain/coverageHistory'
import { coverageSummary } from '../src/spares/domain/spareSelectors'
import { coverageByArea, coverageByGmb } from '../src/spares/domain/dashboardSelectors'
import { createDemoSparesData } from '../src/spares/data/demoSpares'
import { dashboardSearch, readDashboardNavigation } from '../src/spares/domain/dashboardFilters'

describe('Históricos: reglas compartidas con Dashboard', () => {
  it('la navegación conserva filtros previos sin perder la nueva vista', () => {
    const state = readDashboardNavigation('?rc.view=HISTORY&rc.responsible=gmb-hidraulica')
    expect(state.view).toBe('HISTORY')
    expect(readDashboardNavigation(dashboardSearch('', state.filters, state.view))).toEqual(state)
    expect(readDashboardNavigation(dashboardSearch('', state.filters, 'DASHBOARD')).view).toBe('DASHBOARD')
  })
  it('global, áreas y GMB coinciden exactamente con los selectores actuales', () => {
    const data = createDemoSparesData(); const captured = captureCoverage(data)
    const { groups, ...global } = captured
    expect(global).toEqual(coverageSummary(data))
    for (const row of coverageByArea(data)) expect(groups.find((group) => group.dimension === 'AREA' && group.key === row.id)).toMatchObject({ total: row.total, covered: row.covered, uncovered: row.uncovered, percent: row.percent, responsibleName: row.responsible })
    for (const row of coverageByGmb(data)) expect(groups.find((group) => group.dimension === 'GMB' && group.key === row.id)).toMatchObject({ total: row.total, covered: row.covered, uncovered: row.uncovered, percent: row.percent, areaIds: [...row.areas].sort() })
  })
  it('50 a 60 = +10 pp; 60 a 50 = -10 pp; sin universo no hay porcentaje', () => {
    const metrics = { total: 10, covered: 5, uncovered: 5, percent: 50, repair: 0, purchase: 0 }
    expect(coverageChange(metrics, { ...metrics, percent: 60 })).toBe(10)
    expect(coverageChange({ ...metrics, percent: 60 }, metrics)).toBe(-10)
    expect(coverageChange(null, metrics)).toBeNull()
    expect(coverageChange({ ...metrics, total: 0 }, metrics)).toBeNull()
  })
  it.each([7, 30, 90, 180, 365])('rango de %i días', (days) => {
    const range = historyRange(String(days) as '7', undefined, undefined, new Date('2026-09-24T12:00:00Z'))
    expect(Date.parse(range.until) - Date.parse(range.from)).toBe(days * 86400000)
  })
  it('rango personalizado incluye el día final y rechaza fechas inválidas/invertidas', () => {
    expect(historyRange('CUSTOM', '2026-08-01', '2026-08-31', new Date('2026-09-24'))).toEqual({ from: '2026-08-01T00:00:00.000Z', until: '2026-08-31T23:59:59.999Z' })
    expect(() => historyRange('CUSTOM', '2026-02-30', '2026-08-31')).toThrow()
    expect(() => historyRange('CUSTOM', '2026-09-01', '2026-08-31')).toThrow()
  })
  it('días sin avance y umbrales centralizados, sin evaluar áreas vacías o cubiertas como trabadas', () => {
    const group: CoverageGroup = { dimension: 'AREA', key: 'LCO', name: 'LCO', areaIds: ['LCO'], responsibleId: null, responsibleName: null, total: 10, covered: 5, uncovered: 5, percent: 50, repair: 0, purchase: 0, trackedSince: '2026-08-01T00:00:00Z', lastImprovedAt: '2026-09-01T00:00:00Z' }
    expect(groupProgress(group, group, '2026-09-24T00:00:00Z')).toMatchObject({ days: 23, status: 'Sin avance', stagnant: true })
    expect(groupProgress(group, group, '2026-10-02T00:00:00Z').status).toBe('Sin avance crítico')
    expect(groupProgress(group, { ...group, percent: 60 }, '2026-09-24T00:00:00Z').status).toBe('Retroceso')
    expect(groupProgress({ ...group, total: 0 }, group, '2026-10-02T00:00:00Z').stagnant).toBe(false)
    expect(groupProgress({ ...group, uncovered: 0 }, group, '2026-10-02T00:00:00Z').stagnant).toBe(false)
  })
})

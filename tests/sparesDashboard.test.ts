import { describe, expect, it } from 'vitest'
import { createDemoSparesData } from '../src/spares/data/demoSpares'
import { coverageByArea, coverageByGmb, coverageCauses, filterDashboardSpares, principalCoverageCause, type DashboardFilters } from '../src/spares/domain/dashboardSelectors'
import { coverageSummary, selectSpares } from '../src/spares/domain/spareSelectors'

const all: DashboardFilters = { query: '', area: 'ALL', category: 'ALL', responsible: 'ALL', equipment: 'ALL', coverage: 'ALL', unitState: 'ALL', cause: 'ALL' }
describe('Dashboard ejecutivo de repuestos', () => {
  it('cuenta tipos y prioriza reparación sobre compra, sin incluir tipos cubiertos', () => {
    const data = createDemoSparesData()
    const spare = data.spareTypes[0]
    data.units = [
      { id: 'r1', spareTypeId: spare.id, status: 'IN_REPAIR', statusSince: '2026-01-01', comment: '', location: '' },
      { id: 'r2', spareTypeId: spare.id, status: 'IN_REPAIR', statusSince: '2026-01-01', comment: '', location: '' },
      { id: 'c1', spareTypeId: spare.id, status: 'ON_ORDER', statusSince: '2026-01-01', comment: '', location: '' },
    ]
    data.spareTypes = [spare]
    expect(principalCoverageCause(data, spare.id)).toBe('REPAIR')
    expect(coverageCauses(data).map((row) => row.count)).toEqual([1, 0, 0])
    data.units = data.units.filter((unit) => unit.status !== 'IN_REPAIR')
    expect(principalCoverageCause(data, spare.id)).toBe('PURCHASE')
    data.units[0].status = 'WAREHOUSE'
    expect(principalCoverageCause(data, spare.id)).toBeNull()
    data.units = []
    expect(principalCoverageCause(data, spare.id)).toBe('NO_ACTION')
  })

  it('ordena áreas sin datos al final y respeta el orden operacional', () => {
    const data = createDemoSparesData()
    const worst = coverageByArea(data)
    expect(worst[0].percent).toBe(0)
    expect(worst[0].total).toBeGreaterThan(0)
    expect(worst.at(-1)!.total).toBe(0)
    expect(coverageByArea(data, 'operational').map((row) => row.id)).toEqual(['COBA', 'HG', 'LP', 'REMA', 'LCO', 'ZTREF', 'HBM', 'LRE', 'PENF', 'SHA', 'CESTOS'])
    expect(coverageCauses(data).reduce((sum, row) => sum + row.count, 0)).toBe(coverageSummary(data).uncovered)
  })

  it('recalcula todos los gráficos con filtros combinados y asignación actual del área', () => {
    const data = createDemoSparesData()
    const reference = data.spareTypes.find((spare) => spare.area === 'LCO')!
    const filters = { ...all, area: 'LCO', category: reference.categoryId, responsible: 'gmb-mecanica', query: reference.name, equipment: reference.compatibleEquipmentIds[0] || 'ALL' }
    const selection = filterDashboardSpares(data, filters)
    expect(selection.map((spare) => spare.id)).toEqual([reference.id])
    const filtered = selectSpares(data, selection)
    expect(coverageSummary(filtered).total).toBe(1)
    expect(coverageByArea(filtered).find((row) => row.id === 'LCO')!.total).toBe(1)
    expect(coverageByGmb(filtered).find((row) => row.id === 'gmb-mecanica')!.total).toBe(1)
    data.config.areas.find((area) => area.id === 'LCO')!.responsibleGmbId = 'gmb-hidraulica'
    expect(filterDashboardSpares(data, filters)).toHaveLength(0)
    expect(filterDashboardSpares(data, { ...filters, responsible: 'gmb-hidraulica' })).toHaveLength(1)
  })

  it('el drill-down de cada causa devuelve exactamente sus tipos sin cobertura', () => {
    const data = createDemoSparesData()
    for (const cause of coverageCauses(data)) {
      const selection = filterDashboardSpares(data, { ...all, coverage: 'UNCOVERED', cause: cause.id, unitState: cause.id === 'REPAIR' ? 'IN_REPAIR' : cause.id === 'PURCHASE' ? 'ON_ORDER' : 'ALL' })
      expect(selection).toHaveLength(cause.count)
      expect(selection.every((spare) => principalCoverageCause(data, spare.id) === cause.id)).toBe(true)
    }
    expect(filterDashboardSpares(data, { ...all, coverage: 'COVERED', cause: 'REPAIR' })).toHaveLength(0)
  })

  it('maneja selección vacía, cobertura completa y GMB sin áreas', () => {
    const data = createDemoSparesData()
    data.config.responsibles.push({ id: 'empty', name: 'Sin asignaciones', active: true })
    expect(coverageByGmb(data).find((row) => row.id === 'empty')).toMatchObject({ total: 0, areas: [] })
    const covered = selectSpares(data, filterDashboardSpares(data, { ...all, coverage: 'COVERED' }))
    expect(coverageSummary(covered).percent).toBe(100)
    expect(coverageCauses(covered).every((row) => row.count === 0)).toBe(true)
    const empty = selectSpares(data, [])
    expect(coverageByArea(empty).every((row) => row.total === 0)).toBe(true)
    expect(coverageCauses(empty).every((row) => row.count === 0 && row.percent === 0)).toBe(true)
    expect(coverageSummary(empty).total).toBe(0)
  })
})

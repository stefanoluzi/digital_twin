import { describe, expect, it } from 'vitest'
import { createDemoSparesData } from '../src/spares/data/demoSpares'
import { DEFAULT_DASHBOARD_FILTERS, dashboardSearch, dashboardSelections, readDashboardNavigation, toggleDashboardFilter } from '../src/spares/domain/dashboardFilters'
import { coverageCauses, coverageByArea } from '../src/spares/domain/dashboardSelectors'
import { coverageSummary } from '../src/spares/domain/spareSelectors'

describe('Cross-filtering del Dashboard', () => {
  it('HG + reparación filtra el resultado sin alterar estado ni cobertura manualmente', () => {
    const data = createDemoSparesData()
    const original = JSON.stringify(data)
    const area = toggleDashboardFilter(DEFAULT_DASHBOARD_FILTERS, 'area', 'HG')
    expect(dashboardSelections(data, area).result.spareTypes.every((spare) => spare.area === 'HG')).toBe(true)
    const filters = toggleDashboardFilter(area, 'cause', 'REPAIR')
    const selections = dashboardSelections(data, filters)
    expect(selections.result.spareTypes.map((spare) => spare.area)).toEqual(['HG'])
    expect(coverageSummary(selections.result)).toMatchObject({ covered: 0, uncovered: 1, repair: 1 })
    expect(filters.unitState).toBe('ALL')
    expect(filters.coverage).toBe('ALL')
    expect(JSON.stringify(data)).toBe(original)
  })

  it('responsable + compra combina filtros y cada gráfico conserva su contexto', () => {
    const data = createDemoSparesData()
    const filters = { ...DEFAULT_DASHBOARD_FILTERS, responsible: 'gmb-hidraulica', cause: 'PURCHASE' as const }
    const selections = dashboardSelections(data, filters)
    expect(selections.result.spareTypes.map((spare) => spare.area)).toEqual(['LP'])
    expect(coverageCauses(selections.cause).map((cause) => cause.count)).toEqual([1, 1, 0])
    expect(selections.responsible.spareTypes.map((spare) => spare.area).sort()).toEqual(['LP', 'SHA'])
    expect(coverageSummary(selections.result).total).toBe(1)
    const removed = toggleDashboardFilter(filters, 'cause', 'PURCHASE')
    expect(removed.cause).toBe('ALL')
    expect(removed.responsible).toBe('gmb-hidraulica')
    expect(dashboardSelections(data, removed).result.spareTypes).toHaveLength(2)
  })

  it('segundo click desactiva únicamente su dimensión y limpiar recupera toda la planta', () => {
    const data = createDemoSparesData()
    let filters = toggleDashboardFilter(DEFAULT_DASHBOARD_FILTERS, 'area', 'HG')
    filters = toggleDashboardFilter(filters, 'responsible', 'gmb-hidraulica')
    filters = toggleDashboardFilter(filters, 'area', 'HG')
    expect(filters.area).toBe('ALL')
    expect(filters.responsible).toBe('gmb-hidraulica')
    filters = toggleDashboardFilter(filters, 'responsible', 'gmb-hidraulica')
    expect(filters).toEqual(DEFAULT_DASHBOARD_FILTERS)
    expect(dashboardSelections(data, filters).result.spareTypes).toHaveLength(data.spareTypes.length)
  })

  it('área sin datos y cobertura total conservan estados vacíos correctos', () => {
    const data = createDemoSparesData()
    const empty = dashboardSelections(data, { ...DEFAULT_DASHBOARD_FILTERS, area: 'COBA' })
    expect(coverageSummary(empty.result).total).toBe(0)
    expect(coverageByArea(empty.area).find((row) => row.id === 'COBA')!.total).toBe(0)
    const covered = dashboardSelections(data, { ...DEFAULT_DASHBOARD_FILTERS, coverage: 'COVERED' })
    expect(coverageSummary(covered.result).percent).toBe(100)
    expect(coverageCauses(covered.cause).every((row) => row.count === 0)).toBe(true)
  })

  it('conserva filtros y vista en la URL sin tocar parámetros ajenos', () => {
    const filters = { ...DEFAULT_DASHBOARD_FILTERS, area: 'HG', responsible: 'gmb-hidraulica', cause: 'REPAIR' as const, query: 'bomba' }
    const search = dashboardSearch('?other=keep', filters, 'SPARES')
    expect(readDashboardNavigation(search)).toEqual({ filters, view: 'SPARES' })
    expect(new URLSearchParams(search).get('other')).toBe('keep')
    expect(dashboardSearch(search, DEFAULT_DASHBOARD_FILTERS, 'DASHBOARD')).toBe('?other=keep')
    expect(readDashboardNavigation('?rc.cause=INVALID&rc.view=INVALID&rc.unitState=INVALID').filters).toEqual(DEFAULT_DASHBOARD_FILTERS)
  })
})

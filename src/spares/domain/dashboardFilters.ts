import type { CriticalSparesData, SparesView } from '../types'
import { filterDashboardSpares, type DashboardFilters } from './dashboardSelectors'
import { selectSpares } from './spareSelectors'

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilters = { query: '', area: 'ALL', category: 'ALL', responsible: 'ALL', equipment: 'ALL', coverage: 'ALL', unitState: 'ALL', cause: 'ALL' }
export function toggleDashboardFilter<K extends keyof DashboardFilters>(filters: DashboardFilters, key: K, value: DashboardFilters[K]): DashboardFilters {
  return { ...filters, [key]: filters[key] === value ? DEFAULT_DASHBOARD_FILTERS[key] : value }
}

/** Cada gráfico conserva sus alternativas, respetando todos los demás filtros. */
export function dashboardSelections(data: CriticalSparesData, filters: DashboardFilters) {
  const select = (values: DashboardFilters) => selectSpares(data, filterDashboardSpares(data, values))
  return {
    result: select(filters),
    area: select({ ...filters, area: 'ALL' }),
    cause: select({ ...filters, cause: 'ALL' }),
    responsible: select({ ...filters, responsible: 'ALL' }),
  }
}

export function readDashboardNavigation(search: string): { filters: DashboardFilters; view: SparesView } {
  const params = new URLSearchParams(search)
  const filters = { ...DEFAULT_DASHBOARD_FILTERS }
  for (const key of Object.keys(filters) as (keyof DashboardFilters)[]) {
    const value = params.get(`rc.${key}`)
    if (value !== null) Object.assign(filters, { [key]: value })
  }
  if (!['ALL', 'REPAIR', 'PURCHASE', 'NO_ACTION'].includes(filters.cause)) filters.cause = 'ALL'
  if (!['ALL', 'COVERED', 'UNCOVERED'].includes(filters.coverage)) filters.coverage = 'ALL'
  if (!['ALL', 'WAREHOUSE', 'MACHINE_SIDE', 'INSTALLED', 'IN_REPAIR', 'ON_ORDER'].includes(filters.unitState)) filters.unitState = 'ALL'
  const view = params.get('rc.view') as SparesView
  return { filters, view: ['DASHBOARD', 'SPARES', 'TRACKING', 'CONFIG'].includes(view) ? view : 'DASHBOARD' }
}

export function dashboardSearch(search: string, filters: DashboardFilters, view: SparesView) {
  const params = new URLSearchParams(search)
  for (const key of Object.keys(filters) as (keyof DashboardFilters)[]) {
    if (filters[key] === DEFAULT_DASHBOARD_FILTERS[key]) params.delete(`rc.${key}`)
    else params.set(`rc.${key}`, filters[key])
  }
  if (view === 'DASHBOARD') params.delete('rc.view'); else params.set('rc.view', view)
  return params.toString() ? `?${params}` : ''
}

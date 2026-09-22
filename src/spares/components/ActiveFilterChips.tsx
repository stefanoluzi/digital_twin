import type { CriticalSparesData } from '../types'
import { COVERAGE_CAUSES, type DashboardFilters } from '../domain/dashboardSelectors'
import { DEFAULT_DASHBOARD_FILTERS } from '../domain/dashboardFilters'
import { responsibleDisplayName } from '../domain/areaResponsibility'
import { STATUS_LABELS } from '../domain/spareSelectors'

export function ActiveFilterChips({ filters, data, onRemove, onClear }: { filters: DashboardFilters; data: CriticalSparesData; onRemove: (key: keyof DashboardFilters) => void; onClear: () => void }) {
  const labels: Record<keyof DashboardFilters, string> = {
    query: `Búsqueda: ${filters.query}`, area: `Área: ${filters.area}`,
    category: `Categoría: ${data.config.categories.find((item) => item.id === filters.category)?.name || filters.category}`,
    responsible: `Responsable: ${responsibleDisplayName(data.config.responsibles.find((item) => item.id === filters.responsible))}`,
    equipment: `Equipo: ${data.config.equipment.find((item) => item.id === filters.equipment)?.name || filters.equipment}`,
    coverage: filters.coverage === 'COVERED' ? 'Cubiertos' : 'Sin cobertura',
    unitState: `Estado: ${STATUS_LABELS[filters.unitState as keyof typeof STATUS_LABELS] || filters.unitState}`,
    cause: `Causa: ${COVERAGE_CAUSES.find((item) => item.id === filters.cause)?.name || ''}`,
  }
  const active = (Object.keys(filters) as (keyof DashboardFilters)[]).filter((key) => filters[key] !== DEFAULT_DASHBOARD_FILTERS[key])
  if (!active.length) return null
  return <section className="active-filter-chips" aria-label="Filtros activos"><span>Filtros activos</span>{active.map((key) => <button key={key} onClick={() => onRemove(key)} aria-label={`Quitar ${labels[key]}`}>{labels[key]} <b aria-hidden="true">×</b></button>)}<button className="clear-filters" onClick={onClear}>Limpiar todos</button></section>
}

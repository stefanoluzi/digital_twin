import { useEffect, useState } from 'react'
import { dashboardSearch, readDashboardNavigation, DEFAULT_DASHBOARD_FILTERS, toggleDashboardFilter } from '../domain/dashboardFilters'
import type { DashboardFilters } from '../domain/dashboardSelectors'
import type { SparesView } from '../types'

/** Única fuente de verdad compartida por selects, gráficos, chips y navegación. */
export function useDashboardFilters() {
  const [navigation, setNavigation] = useState(() => readDashboardNavigation(window.location.search))
  const { filters, view } = navigation
  useEffect(() => {
    const url = `${window.location.pathname}${dashboardSearch(window.location.search, filters, view)}${window.location.hash}`
    window.history.replaceState(window.history.state, '', url)
  }, [filters, view])
  useEffect(() => {
    const restore = () => setNavigation(readDashboardNavigation(window.location.search))
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])
  const setFilter = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => setNavigation((state) => ({ ...state, filters: { ...state.filters, [key]: value } }))
  const toggleFilter = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => setNavigation((state) => ({ ...state, filters: toggleDashboardFilter(state.filters, key, value) }))
  const clearFilter = (key: keyof DashboardFilters) => setFilter(key, DEFAULT_DASHBOARD_FILTERS[key])
  const resetFilters = () => setNavigation((state) => ({ ...state, filters: { ...DEFAULT_DASHBOARD_FILTERS } }))
  const setView = (view: SparesView) => setNavigation((state) => ({ ...state, view }))
  return { filters, view, setFilter, toggleFilter, clearFilter, resetFilters, setView }
}

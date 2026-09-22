export type MaintenanceModuleId = 'TWIN' | 'REPLACEMENTS' | 'PLANNER' | 'LCO_COUPLINGS' | 'CRITICAL_SPARES'

export interface MaintenanceModuleDefinition {
  id: MaintenanceModuleId
  label: string
  path: string
  specialized: boolean
}

export const MAINTENANCE_MODULES: MaintenanceModuleDefinition[] = [
  { id: 'TWIN', label: 'Twin', path: '/maintenance/twin', specialized: false },
  { id: 'REPLACEMENTS', label: 'Recambios', path: '/maintenance/replacements', specialized: false },
  { id: 'PLANNER', label: 'Planner', path: '/maintenance/planner', specialized: true },
  { id: 'LCO_COUPLINGS', label: 'Acoplamientos LCO', path: '/maintenance/lco-couplings', specialized: true },
  { id: 'CRITICAL_SPARES', label: 'Repuestos Críticos', path: '/maintenance/critical-spares', specialized: true },
]

export function getActiveMaintenanceModule(pathname: string): MaintenanceModuleDefinition {
  return MAINTENANCE_MODULES.find((module) => module.path === pathname) ?? MAINTENANCE_MODULES[0]
}

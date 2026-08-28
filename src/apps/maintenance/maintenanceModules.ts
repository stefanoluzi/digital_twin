export type MaintenanceModuleId = 'TWIN' | 'REPLACEMENTS' | 'LCO_COUPLINGS'

export interface MaintenanceModuleDefinition {
  id: MaintenanceModuleId
  label: string
  path: string
  specialized: boolean
}

export const MAINTENANCE_MODULES: MaintenanceModuleDefinition[] = [
  { id: 'TWIN', label: 'Twin', path: '/maintenance/twin', specialized: false },
  { id: 'REPLACEMENTS', label: 'Recambios', path: '/maintenance/replacements', specialized: false },
  { id: 'LCO_COUPLINGS', label: 'Acoplamientos LCO', path: '/maintenance/lco-couplings', specialized: true },
]

export function getActiveMaintenanceModule(pathname: string): MaintenanceModuleDefinition {
  return MAINTENANCE_MODULES.find((module) => module.path === pathname) ?? MAINTENANCE_MODULES[0]
}

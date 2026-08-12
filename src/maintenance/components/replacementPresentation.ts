import type { MaintenanceIntervalUnit, OperationalReplacementStatus, SubassemblyMaintenanceState } from '../domain/maintenanceTypes'

export const replacementStatusLabels: Record<OperationalReplacementStatus, string> = {
  CURRENT: 'Vigente', DUE_SOON: 'Próximo a vencer', OVERDUE: 'Vencido', NO_DATA: 'Sin datos', INACTIVE: 'Inactivo',
}

export function replacementTimingLabel(state?: SubassemblyMaintenanceState) {
  if (!state || state.operationalStatus === 'NO_DATA') return 'Sin datos'
  if (state.operationalStatus === 'OVERDUE') return `Vencido hace ${state.daysOverdue} días`
  if (state.daysRemaining === null) return 'Sin datos'
  return `${state.daysRemaining} días restantes`
}

export function intervalLabel(value: number, unit: MaintenanceIntervalUnit) {
  return `${value} ${{ DAYS: 'días', WEEKS: 'semanas', MONTHS: 'meses', YEARS: 'años' }[unit]}`
}

import { addMaintenanceInterval, differenceInCalendarDays } from './maintenanceDateService'
import type { MaintenanceEvent, MaintenancePlan, MaintenanceStatus, OperationalReplacementStatus, Subassembly, SubassemblyMaintenanceState } from './maintenanceTypes'

export function latestReplacementEvent(events: MaintenanceEvent[]): MaintenanceEvent | null {
  return events.filter((event) => event.type === 'REPLACEMENT').sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0] ?? null
}

/** @deprecated Use latestReplacementEvent. Kept as a source-compatible alias. */
export const latestApplicableEvent = latestReplacementEvent

export function toOperationalReplacementStatus(status: MaintenanceStatus): OperationalReplacementStatus {
  if (status === 'OK') return 'CURRENT'
  if (status === 'WARNING' || status === 'CRITICAL') return 'DUE_SOON'
  if (status === 'OVERDUE') return 'OVERDUE'
  if (status === 'INACTIVE') return 'INACTIVE'
  return 'NO_DATA'
}

export function deriveSubassemblyMaintenanceState(subassembly: Subassembly, plan: MaintenancePlan | undefined, events: MaintenanceEvent[], referenceDate: string): SubassemblyMaintenanceState {
  const latest = latestReplacementEvent(events)
  if (!subassembly.active) return { subassemblyId: subassembly.id, status: 'INACTIVE', operationalStatus: 'INACTIVE', lastEventDate: latest?.date ?? null, nextDueDate: null, daysRemaining: null, daysOverdue: 0 }
  if (!plan?.active) return { subassemblyId: subassembly.id, status: 'NO_PLAN', operationalStatus: 'NO_DATA', lastEventDate: latest?.date ?? null, nextDueDate: null, daysRemaining: null, daysOverdue: 0 }
  if (!latest) return { subassemblyId: subassembly.id, status: 'NO_HISTORY', operationalStatus: 'NO_DATA', lastEventDate: null, nextDueDate: null, daysRemaining: null, daysOverdue: 0 }
  const nextDueDate = addMaintenanceInterval(latest.date, plan.intervalValue, plan.intervalUnit)
  const daysRemaining = nextDueDate ? differenceInCalendarDays(nextDueDate, referenceDate) : null
  let status: MaintenanceStatus = 'NO_HISTORY'
  if (daysRemaining !== null) {
    if (daysRemaining < 0) status = 'OVERDUE'
    else if (daysRemaining <= plan.criticalDays) status = 'CRITICAL'
    else if (daysRemaining <= plan.warningDays) status = 'WARNING'
    else status = 'OK'
  }
  return { subassemblyId: subassembly.id, status, operationalStatus: toOperationalReplacementStatus(status), lastEventDate: latest.date, nextDueDate, daysRemaining, daysOverdue: Math.max(-(daysRemaining ?? 0), 0) }
}

export const STATUS_SEVERITY: Record<MaintenanceStatus, number> = { INACTIVE: 0, OK: 1, NO_PLAN: 2, NO_HISTORY: 3, WARNING: 4, CRITICAL: 5, OVERDUE: 6 }
export const STATUS_ATTENTION: Record<MaintenanceStatus, number> = { INACTIVE: 0, OK: 0, NO_PLAN: 15, NO_HISTORY: 20, WARNING: 35, CRITICAL: 70, OVERDUE: 100 }

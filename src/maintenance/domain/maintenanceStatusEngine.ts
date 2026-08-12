import { addMaintenanceInterval, differenceInCalendarDays } from './maintenanceDateService'
import type { MaintenanceEvent, MaintenancePlan, MaintenanceStatus, Subassembly, SubassemblyMaintenanceState } from './maintenanceTypes'

const RESET_EVENT_TYPES = new Set<MaintenanceEvent['type']>(['REPLACEMENT', 'OVERHAUL'])

export function latestApplicableEvent(events: MaintenanceEvent[]): MaintenanceEvent | null {
  return events.filter((event) => RESET_EVENT_TYPES.has(event.type)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0] ?? null
}

export function deriveSubassemblyMaintenanceState(subassembly: Subassembly, plan: MaintenancePlan | undefined, events: MaintenanceEvent[], referenceDate: string): SubassemblyMaintenanceState {
  if (!subassembly.active) return { subassemblyId: subassembly.id, status: 'INACTIVE', lastEventDate: null, nextDueDate: null, daysRemaining: null }
  if (!plan?.active) return { subassemblyId: subassembly.id, status: 'NO_PLAN', lastEventDate: null, nextDueDate: null, daysRemaining: null }
  const latest = latestApplicableEvent(events)
  if (!latest) return { subassemblyId: subassembly.id, status: 'NO_HISTORY', lastEventDate: null, nextDueDate: null, daysRemaining: null }
  const nextDueDate = addMaintenanceInterval(latest.date, plan.intervalValue, plan.intervalUnit)
  const daysRemaining = nextDueDate ? differenceInCalendarDays(nextDueDate, referenceDate) : null
  let status: MaintenanceStatus = 'NO_HISTORY'
  if (daysRemaining !== null) {
    if (daysRemaining < 0) status = 'OVERDUE'
    else if (daysRemaining <= plan.criticalDays) status = 'CRITICAL'
    else if (daysRemaining <= plan.warningDays) status = 'WARNING'
    else status = 'OK'
  }
  return { subassemblyId: subassembly.id, status, lastEventDate: latest.date, nextDueDate, daysRemaining }
}

export const STATUS_SEVERITY: Record<MaintenanceStatus, number> = { INACTIVE: 0, OK: 1, NO_PLAN: 2, NO_HISTORY: 3, WARNING: 4, CRITICAL: 5, OVERDUE: 6 }
export const STATUS_ATTENTION: Record<MaintenanceStatus, number> = { INACTIVE: 0, OK: 0, NO_PLAN: 15, NO_HISTORY: 20, WARNING: 35, CRITICAL: 70, OVERDUE: 100 }

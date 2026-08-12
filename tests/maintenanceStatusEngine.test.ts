import { describe, expect, it } from 'vitest'
import { deriveSubassemblyMaintenanceState } from '../src/maintenance/domain/maintenanceStatusEngine'
import type { MaintenanceEvent, MaintenancePlan, Subassembly } from '../src/maintenance/domain/maintenanceTypes'

const subassembly: Subassembly = { id: 'SUB-1', equipmentId: 'EQ-1', name: 'Rodamiento', description: '', sapId: '', active: true, criticality: 'A', trackingMode: 'REPLACEMENT', source: 'LOCAL', createdAt: '2026-01-01T00:00:00Z' }
const plan: MaintenancePlan = { id: 'P-1', subassemblyId: 'SUB-1', name: 'Plan', intervalValue: 30, intervalUnit: 'DAYS', warningDays: 10, criticalDays: 3, active: true, source: 'LOCAL', createdAt: '2026-01-01T00:00:00Z' }
const event: MaintenanceEvent = { id: 'E-1', subassemblyId: 'SUB-1', type: 'REPLACEMENT', date: '2026-01-01', notes: '', workOrder: '', source: 'LOCAL', createdAt: '2026-01-01T00:00:00Z' }

describe('maintenanceStatusEngine', () => {
  it('distingue sin plan y sin historial', () => {
    expect(deriveSubassemblyMaintenanceState(subassembly, undefined, [], '2026-01-01').status).toBe('NO_PLAN')
    expect(deriveSubassemblyMaintenanceState(subassembly, plan, [], '2026-01-01').status).toBe('NO_HISTORY')
  })
  it.each([['2026-01-15', 'OK'], ['2026-01-23', 'WARNING'], ['2026-01-29', 'CRITICAL'], ['2026-02-01', 'OVERDUE']] as const)('deriva %s como %s', (date, status) => {
    expect(deriveSubassemblyMaintenanceState(subassembly, plan, [event], date).status).toBe(status)
  })
  it('solo reinicia el ciclo con REPLACEMENT', () => {
    const inspection = { ...event, id: 'E-2', type: 'INSPECTION' as const, date: '2026-01-29' }
    const overhaul = { ...event, id: 'E-3', type: 'OVERHAUL' as const, date: '2026-01-30' }
    expect(deriveSubassemblyMaintenanceState(subassembly, plan, [event, inspection, overhaul], '2026-02-01').lastEventDate).toBe('2026-01-01')
  })
  it('deriva dias vencidos sin persistirlos', () => { expect(deriveSubassemblyMaintenanceState(subassembly, plan, [event], '2026-02-05').daysOverdue).toBe(5) })
})

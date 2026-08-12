import { describe, expect, it } from 'vitest'
import { getEquipmentSummary } from '../src/maintenance/domain/maintenanceSelectors'
import type { MaintenanceData } from '../src/maintenance/domain/maintenanceTypes'

const data: MaintenanceData = {
  equipment: [{ id: 'EQ', assetId: 'A', name: 'Equipo', active: true, source: 'LOCAL', createdAt: '' }],
  subassemblies: [
    { id: 'S1', equipmentId: 'EQ', name: 'Uno', description: '', sapId: '', active: true, criticality: '', source: 'LOCAL', createdAt: '' },
    { id: 'S2', equipmentId: 'EQ', name: 'Dos', description: '', sapId: '', active: true, criticality: '', source: 'LOCAL', createdAt: '' },
  ],
  plans: [
    { id: 'P1', subassemblyId: 'S1', name: '', intervalValue: 10, intervalUnit: 'DAYS', warningDays: 3, criticalDays: 1, active: true, source: 'LOCAL', createdAt: '' },
    { id: 'P2', subassemblyId: 'S2', name: '', intervalValue: 100, intervalUnit: 'DAYS', warningDays: 3, criticalDays: 1, active: true, source: 'LOCAL', createdAt: '' },
  ],
  events: [
    { id: 'E1', subassemblyId: 'S1', type: 'REPLACEMENT', date: '2026-01-01', notes: '', workOrder: '', source: 'LOCAL', createdAt: '' },
    { id: 'E2', subassemblyId: 'S2', type: 'REPLACEMENT', date: '2026-01-01', notes: '', workOrder: '', source: 'LOCAL', createdAt: '' },
  ],
}

describe('equipment aggregation', () => {
  it('propaga el peor estado y calcula score', () => {
    const summary = getEquipmentSummary(data, 'EQ', '2026-01-20')
    expect(summary.status).toBe('OVERDUE')
    expect(summary.counts.OVERDUE).toBe(1)
    expect(summary.counts.OK).toBe(1)
    expect(summary.attentionScore).toBe(50)
  })
})

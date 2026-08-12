import type { Equipment, MaintenanceData, MaintenanceEvent, MaintenancePlan, Subassembly } from '../domain/maintenanceTypes'
import { normalizeMaintenanceData } from './maintenanceNormalizer'
import type { MaintenanceRepository } from './MaintenanceRepository'

export class LocalMaintenanceRepository implements MaintenanceRepository {
  private data: MaintenanceData
  constructor(initial?: MaintenanceData) { this.data = normalizeMaintenanceData(initial) }
  async load() { return structuredClone(this.data) }
  async save(data: MaintenanceData) { this.data = normalizeMaintenanceData(data) }
  async upsertEquipment(value: Equipment) { this.data.equipment = upsert(this.data.equipment, value) }
  async upsertSubassembly(value: Subassembly) { this.data.subassemblies = upsert(this.data.subassemblies, value) }
  async upsertPlan(value: MaintenancePlan) { this.data.plans = upsert(this.data.plans, value) }
  async appendEvent(value: MaintenanceEvent) { if (!this.data.events.some((item) => item.id === value.id)) this.data.events.push(structuredClone(value)) }
}

function upsert<T extends { id: string }>(items: T[], value: T) {
  const index = items.findIndex((item) => item.id === value.id)
  if (index < 0) return [...items, structuredClone(value)]
  const next = items.slice(); next[index] = structuredClone(value); return next
}

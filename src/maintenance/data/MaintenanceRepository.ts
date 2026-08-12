import type { Equipment, MaintenanceData, MaintenanceEvent, MaintenancePlan, Subassembly } from '../domain/maintenanceTypes'

export interface MaintenanceRepository {
  load(): Promise<MaintenanceData>
  save(data: MaintenanceData): Promise<void>
  upsertEquipment(equipment: Equipment): Promise<void>
  upsertSubassembly(subassembly: Subassembly): Promise<void>
  upsertPlan(plan: MaintenancePlan): Promise<void>
  appendEvent(event: MaintenanceEvent): Promise<void>
}

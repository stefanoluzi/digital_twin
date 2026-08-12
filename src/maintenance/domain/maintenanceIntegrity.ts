import type { MaintenanceData } from './maintenanceTypes'

export type AssetDeletePolicy = 'CANCEL' | 'KEEP_ORPHAN' | 'DELETE_MAINTENANCE'

export interface OrphanMaintenanceRelations {
  equipmentWithoutAsset: string[]
  subassembliesWithoutEquipment: string[]
  plansWithoutSubassembly: string[]
  eventsWithoutSubassemblyOrEquipment: string[]
}

export interface DuplicateMaintenanceIds {
  equipmentIds: string[]
  equipmentAssetIds: string[]
  subassemblyIds: string[]
  planIds: string[]
  eventIds: string[]
}

export interface AssetMaintenanceSummary {
  equipmentIds: string[]
  subassemblyCount: number
  planCount: number
  eventCount: number
}

function duplicates(values: string[]) {
  const seen = new Set<string>(); const repeated = new Set<string>()
  values.filter(Boolean).forEach((value) => seen.has(value) ? repeated.add(value) : seen.add(value))
  return [...repeated].sort()
}

export function findDuplicateMaintenanceIds(data: MaintenanceData): DuplicateMaintenanceIds {
  return {
    equipmentIds: duplicates(data.equipment.map((item) => item.id)),
    equipmentAssetIds: duplicates(data.equipment.map((item) => item.assetId)),
    subassemblyIds: duplicates(data.subassemblies.map((item) => item.id)),
    planIds: duplicates(data.plans.map((item) => item.id)),
    eventIds: duplicates(data.events.map((item) => item.id)),
  }
}

export function assertNoDuplicateMaintenanceIds(data: MaintenanceData) {
  const result = findDuplicateMaintenanceIds(data)
  const failures = Object.entries(result).filter(([, values]) => values.length).map(([kind, values]) => `${kind}: ${values.join(', ')}`)
  if (failures.length) throw new Error(`IDs de mantenimiento duplicados (${failures.join('; ')}).`)
}

export function findOrphanMaintenanceRelations(data: MaintenanceData, assetIds: Iterable<string>): OrphanMaintenanceRelations {
  const assets = new Set(assetIds)
  const equipmentIds = new Set(data.equipment.map((item) => item.id))
  const subassemblyIds = new Set(data.subassemblies.map((item) => item.id))
  const validSubassemblyIds = new Set(data.subassemblies.filter((item) => equipmentIds.has(item.equipmentId)).map((item) => item.id))
  return {
    equipmentWithoutAsset: data.equipment.filter((item) => !assets.has(item.assetId)).map((item) => item.id),
    subassembliesWithoutEquipment: data.subassemblies.filter((item) => !equipmentIds.has(item.equipmentId)).map((item) => item.id),
    plansWithoutSubassembly: data.plans.filter((item) => !subassemblyIds.has(item.subassemblyId)).map((item) => item.id),
    eventsWithoutSubassemblyOrEquipment: data.events.filter((item) => !validSubassemblyIds.has(item.subassemblyId)).map((item) => item.id),
  }
}

export function summarizeAssetMaintenance(data: MaintenanceData, assetId: string): AssetMaintenanceSummary {
  const equipmentIds = data.equipment.filter((item) => item.assetId === assetId).map((item) => item.id)
  const equipmentSet = new Set(equipmentIds)
  const subassemblyIds = data.subassemblies.filter((item) => equipmentSet.has(item.equipmentId)).map((item) => item.id)
  const subassemblySet = new Set(subassemblyIds)
  return { equipmentIds, subassemblyCount: subassemblyIds.length, planCount: data.plans.filter((item) => subassemblySet.has(item.subassemblyId)).length, eventCount: data.events.filter((item) => subassemblySet.has(item.subassemblyId)).length }
}

export function renameMaintenanceAsset(data: MaintenanceData, oldId: string, newId: string): MaintenanceData {
  if (oldId === newId) return structuredClone(data)
  if (data.equipment.some((item) => item.assetId === newId && item.assetId !== oldId)) throw new Error(`Ya existe Equipment vinculado al asset ${newId}.`)
  return { ...structuredClone(data), equipment: data.equipment.map((item) => item.assetId === oldId ? { ...item, assetId: newId } : structuredClone(item)) }
}

export function applyAssetDeletePolicy(data: MaintenanceData, assetId: string, policy: AssetDeletePolicy): MaintenanceData {
  if (policy === 'CANCEL' || policy === 'KEEP_ORPHAN') return structuredClone(data)
  const equipmentIds = new Set(data.equipment.filter((item) => item.assetId === assetId).map((item) => item.id))
  const subassemblyIds = new Set(data.subassemblies.filter((item) => equipmentIds.has(item.equipmentId)).map((item) => item.id))
  return {
    equipment: data.equipment.filter((item) => !equipmentIds.has(item.id)),
    subassemblies: data.subassemblies.filter((item) => !subassemblyIds.has(item.id)),
    plans: data.plans.filter((item) => !subassemblyIds.has(item.subassemblyId)),
    events: data.events.filter((item) => !subassemblyIds.has(item.subassemblyId)),
    units: structuredClone(data.units),
  }
}

export function hasIntegrityDiagnostics(value: OrphanMaintenanceRelations | DuplicateMaintenanceIds) {
  return Object.values(value).some((items) => items.length > 0)
}

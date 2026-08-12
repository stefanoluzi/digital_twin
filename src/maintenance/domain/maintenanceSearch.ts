import type { IndustrialAsset } from '../../types/plant'
import type { Equipment, MaintenanceData, MaintenanceEvent, Subassembly } from './maintenanceTypes'

export interface MaintenanceSearchResults {
  equipment: Array<{ equipment: Equipment | null; asset: IndustrialAsset }>
  functionalPositions: Array<{ functionalPosition: Subassembly; asset: IndustrialAsset }>
  events: Array<{ event: MaintenanceEvent; functionalPosition: Subassembly; asset: IndustrialAsset }>
}

export function searchMaintenance(data: MaintenanceData, assets: IndustrialAsset[], query: string): MaintenanceSearchResults {
  const q = query.trim().toLocaleLowerCase()
  if (!q) return { equipment: [], functionalPositions: [], events: [] }
  const includes = (...values: unknown[]) => values.some((value) => String(value ?? '').toLocaleLowerCase().includes(q))
  const assetById = new Map(assets.map((asset) => [asset.id, asset]))
  const equipmentById = new Map(data.equipment.map((equipment) => [equipment.id, equipment]))
  const positionById = new Map(data.subassemblies.map((position) => [position.id, position]))
  const equipmentByAsset = new Map(data.equipment.map((equipment) => [equipment.assetId, equipment]))
  const equipment = assets.filter((asset) => { const linked = equipmentByAsset.get(asset.id); return includes(asset.id, asset.name, linked?.id, linked?.name) }).map((asset) => ({ equipment: equipmentByAsset.get(asset.id) ?? null, asset }))
  const functionalPositions = data.subassemblies.flatMap((functionalPosition) => { const equipment = equipmentById.get(functionalPosition.equipmentId); const asset = equipment ? assetById.get(equipment.assetId) : undefined; return asset && includes(functionalPosition.id, functionalPosition.name, functionalPosition.sapId) ? [{ functionalPosition, asset }] : [] })
  const events = data.events.flatMap((event) => { const functionalPosition = positionById.get(event.subassemblyId); const equipment = functionalPosition ? equipmentById.get(functionalPosition.equipmentId) : undefined; const asset = equipment ? assetById.get(equipment.assetId) : undefined; return asset && functionalPosition && includes(event.workOrder, event.id) ? [{ event, functionalPosition, asset }] : [] })
  return { equipment, functionalPositions, events }
}

import type { IndustrialAsset } from '../../types/plant'
import { deriveSubassemblyMaintenanceState, STATUS_ATTENTION, STATUS_SEVERITY } from './maintenanceStatusEngine'
import { MAINTENANCE_STATUSES, type EquipmentMaintenanceSummary, type MaintenanceData, type MaintenanceStatus, type OperationalReplacementStatus, type SubassemblyMaintenanceState } from './maintenanceTypes'

export function getEquipmentForAsset(data: MaintenanceData, assetId: string) { return data.equipment.find((item) => item.assetId === assetId) }
export function getSubassembliesForEquipment(data: MaintenanceData, equipmentId: string) { return data.subassemblies.filter((item) => item.equipmentId === equipmentId) }
export function getPlanForSubassembly(data: MaintenanceData, subassemblyId: string) { return data.plans.find((item) => item.subassemblyId === subassemblyId && item.active) }
export function getEventsForSubassembly(data: MaintenanceData, subassemblyId: string) { return data.events.filter((item) => item.subassemblyId === subassemblyId).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)) }

export function getSubassemblyState(data: MaintenanceData, subassemblyId: string, referenceDate: string): SubassemblyMaintenanceState | undefined {
  const subassembly = data.subassemblies.find((item) => item.id === subassemblyId)
  return subassembly ? deriveSubassemblyMaintenanceState(subassembly, getPlanForSubassembly(data, subassemblyId), getEventsForSubassembly(data, subassemblyId), referenceDate) : undefined
}

export function getEquipmentSummary(data: MaintenanceData, equipmentId: string, referenceDate: string): EquipmentMaintenanceSummary {
  const equipment = data.equipment.find((item) => item.id === equipmentId)
  const states = getSubassembliesForEquipment(data, equipmentId).filter((item) => item.trackingMode === 'REPLACEMENT').map((item) => getSubassemblyState(data, item.id, referenceDate)!).filter(Boolean)
  const counts = Object.fromEntries(MAINTENANCE_STATUSES.map((status) => [status, 0])) as Record<MaintenanceStatus, number>
  states.forEach((state) => { counts[state.status] += 1 })
  const status = equipment && !equipment.active ? 'INACTIVE' : states.reduce<MaintenanceStatus>((worst, state) => STATUS_SEVERITY[state.status] > STATUS_SEVERITY[worst] ? state.status : worst, states.length ? 'INACTIVE' : 'NO_PLAN')
  const attentionScore = status === 'INACTIVE' ? 0 : states.length ? Math.round(states.reduce((sum, state) => sum + STATUS_ATTENTION[state.status], 0) / states.length) : STATUS_ATTENTION.NO_PLAN
  const dueDates = states.map((state) => state.nextDueDate).filter((value): value is string => Boolean(value)).sort()
  return { equipmentId, status, attentionScore, total: states.length, counts, nearestDueDate: dueDates[0] ?? null }
}

export function getAssetMaintenanceMap(data: MaintenanceData, assets: IndustrialAsset[], referenceDate: string) {
  return new Map(assets.map((asset) => {
    const equipment = getEquipmentForAsset(data, asset.id)
    return [asset.id, equipment ? getEquipmentSummary(data, equipment.id, referenceDate) : { equipmentId: '', status: 'NO_PLAN' as const, attentionScore: 15, total: 0, counts: Object.fromEntries(MAINTENANCE_STATUSES.map((status) => [status, 0])) as Record<MaintenanceStatus, number>, nearestDueDate: null }]
  }))
}

export function getMaintenanceKpis(data: MaintenanceData, referenceDate: string) {
  const states = data.subassemblies.map((item) => getSubassemblyState(data, item.id, referenceDate)!).filter(Boolean)
  return Object.fromEntries(MAINTENANCE_STATUSES.map((status) => [status, states.filter((state) => state.status === status).length])) as Record<MaintenanceStatus, number>
}

export interface ReplacementKpis {
  CURRENT: number
  DUE_SOON: number
  OVERDUE: number
  NO_DATA: number
  INACTIVE: number
  equipmentWithOverdueCount: number
}

export function getReplacementKpis(data: MaintenanceData, referenceDate: string): ReplacementKpis {
  const states = data.subassemblies.filter((item) => item.trackingMode === 'REPLACEMENT').map((item) => getSubassemblyState(data, item.id, referenceDate)!).filter(Boolean)
  const result: ReplacementKpis = { CURRENT: 0, DUE_SOON: 0, OVERDUE: 0, NO_DATA: 0, INACTIVE: 0, equipmentWithOverdueCount: 0 }
  states.forEach((state) => { result[state.operationalStatus] += 1 })
  const overdueSubassemblies = new Set(states.filter((state) => state.operationalStatus === 'OVERDUE').map((state) => state.subassemblyId))
  result.equipmentWithOverdueCount = new Set(data.subassemblies.filter((item) => overdueSubassemblies.has(item.id)).map((item) => item.equipmentId)).size
  return result
}

export interface MaintenanceAssetVisualState {
  status: OperationalReplacementStatus
  badgeCount: number
  total: number
  title: string
}

const operationalSeverity: Record<OperationalReplacementStatus, number> = { INACTIVE: 0, CURRENT: 1, NO_DATA: 2, DUE_SOON: 3, OVERDUE: 4 }

export function getMaintenanceAssetVisualStateMap(data: MaintenanceData, assets: IndustrialAsset[], referenceDate: string) {
  const result = new Map<string, MaintenanceAssetVisualState>()
  assets.forEach((asset) => {
    const equipment = getEquipmentForAsset(data, asset.id)
    const positions = equipment ? getSubassembliesForEquipment(data, equipment.id).filter((item) => item.trackingMode === 'REPLACEMENT') : []
    const states = positions.map((item) => getSubassemblyState(data, item.id, referenceDate)!).filter(Boolean)
    const status = states.reduce<OperationalReplacementStatus>((worst, state) => operationalSeverity[state.operationalStatus] > operationalSeverity[worst] ? state.operationalStatus : worst, states.length ? 'INACTIVE' : 'NO_DATA')
    const badgeCount = states.filter((state) => state.operationalStatus === status).length
    result.set(asset.id, { status, badgeCount, total: states.length, title: `${badgeCount} posiciones ${status.toLowerCase()}` })
  })
  return result
}

export interface ReplacementRow {
  asset: IndustrialAsset
  equipmentId: string
  functionalPosition: MaintenanceData['subassemblies'][number]
  plan: MaintenanceData['plans'][number] | undefined
  state: SubassemblyMaintenanceState
}

export function getReplacementRows(data: MaintenanceData, assets: IndustrialAsset[], referenceDate: string): ReplacementRow[] {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]))
  const equipmentById = new Map(data.equipment.map((equipment) => [equipment.id, equipment]))
  return data.subassemblies.flatMap((functionalPosition) => {
    if (functionalPosition.trackingMode !== 'REPLACEMENT') return []
    const equipment = equipmentById.get(functionalPosition.equipmentId)
    const asset = equipment ? assetsById.get(equipment.assetId) : undefined
    const state = getSubassemblyState(data, functionalPosition.id, referenceDate)
    if (!equipment || !asset || !state) return []
    return [{ asset, equipmentId: equipment.id, functionalPosition, plan: getPlanForSubassembly(data, functionalPosition.id), state }]
  })
}

export function groupEquipmentByAreaAndLevel(data: MaintenanceData, assets: IndustrialAsset[]) {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]))
  return data.equipment.reduce<Record<string, Record<string, string[]>>>((groups, equipment) => {
    const asset = assetsById.get(equipment.assetId)
    if (!asset) return groups
    const area = asset.areaCode || 'UNASSIGNED'
    const level = asset.levelCode || 'LEVEL_1'
    ;(groups[area] ??= {})[level] ??= []
    groups[area][level].push(equipment.id)
    return groups
  }, {})
}

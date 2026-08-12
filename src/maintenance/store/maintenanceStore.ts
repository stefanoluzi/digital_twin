import { create } from 'zustand'
import type { IndustrialAsset } from '../../types/plant'
import { AREA_FILTER_ALL, type AreaFilter } from '../../config/areas'
import { ALL_LEVELS, type VisibleLevelFilter } from '../../config/plantLevels'
import { normalizeMaintenanceData } from '../data/maintenanceNormalizer'
import { todayDateOnly } from '../domain/maintenanceDateService'
import { EMPTY_MAINTENANCE_DATA, type Equipment, type MaintenanceData, type MaintenanceEvent, type MaintenancePlan, type OperationalReplacementStatus, type Subassembly } from '../domain/maintenanceTypes'
import { assertNoDuplicateMaintenanceIds, findDuplicateMaintenanceIds, hasIntegrityDiagnostics } from '../domain/maintenanceIntegrity'

type MaintenanceViewMode = 'NORMAL' | 'MAINTENANCE'
type FilterBehavior = 'DIM' | 'HIDE'
type MaintenanceStatusFilter = OperationalReplacementStatus | 'ALL'
export type MaintenanceOperationalView = 'STATUS' | 'DUE' | 'RECENT'
export type MaintenanceCriticalityFilter = 'ALL' | 'A' | 'B' | 'C' | 'D'

interface MaintenanceStore extends MaintenanceData {
  referenceDate: string
  viewMode: MaintenanceViewMode
  statusFilter: MaintenanceStatusFilter
  filterBehavior: FilterBehavior
  showOkBadges: boolean
  operationalView: MaintenanceOperationalView
  criticalityFilter: MaintenanceCriticalityFilter
  recentDays: 7 | 30 | 90 | null
  areaFilter: AreaFilter
  levelFilter: VisibleLevelFilter
  selectedSubassemblyId: string | null
  drawerOpen: boolean
  loadMaintenance: (data?: unknown) => void
  resetMaintenance: () => void
  exportMaintenance: () => MaintenanceData
  createEquipmentForAsset: (asset: IndustrialAsset) => Equipment
  replaceMaintenanceData: (data: MaintenanceData) => void
  saveSubassembly: (value: Omit<Subassembly, 'createdAt' | 'source'> & Partial<Pick<Subassembly, 'createdAt' | 'source'>>) => void
  savePlan: (value: Omit<MaintenancePlan, 'createdAt' | 'source'> & Partial<Pick<MaintenancePlan, 'createdAt' | 'source'>>) => void
  appendEvent: (value: Omit<MaintenanceEvent, 'id' | 'createdAt' | 'source'> & Partial<Pick<MaintenanceEvent, 'id' | 'createdAt' | 'source'>>) => void
  openSubassembly: (id: string) => void
  closeDrawer: () => void
  setViewMode: (mode: MaintenanceViewMode) => void
  setStatusFilter: (status: MaintenanceStatusFilter) => void
  setFilterBehavior: (behavior: FilterBehavior) => void
  setShowOkBadges: (show: boolean) => void
  setOperationalView: (view: MaintenanceOperationalView) => void
  setCriticalityFilter: (value: MaintenanceCriticalityFilter) => void
  setRecentDays: (days: 7 | 30 | 90 | null) => void
  setAreaFilter: (area: AreaFilter) => void
  setLevelFilter: (level: VisibleLevelFilter) => void
  setReferenceDate: (date: string) => void
  seedDemoData: (assets: IndustrialAsset[]) => void
}

const id = (prefix: string) => `${prefix}_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`}`
const now = () => new Date().toISOString()

export const useMaintenanceStore = create<MaintenanceStore>((set, get) => ({
  ...structuredClone(EMPTY_MAINTENANCE_DATA),
  referenceDate: todayDateOnly(), viewMode: 'NORMAL', statusFilter: 'ALL', filterBehavior: 'DIM', showOkBadges: false, operationalView: 'STATUS', criticalityFilter: 'ALL', recentDays: null, areaFilter: AREA_FILTER_ALL, levelFilter: ALL_LEVELS, selectedSubassemblyId: null, drawerOpen: false,
  loadMaintenance: (data) => {
    const normalized = normalizeMaintenanceData(data)
    const duplicates = findDuplicateMaintenanceIds(normalized)
    if (hasIntegrityDiagnostics(duplicates) && Boolean((import.meta as any).env?.DEV)) console.warn('[Maintenance] IDs duplicados cargados', duplicates)
    set({ ...normalized, selectedSubassemblyId: null, drawerOpen: false })
  },
  resetMaintenance: () => set({ ...structuredClone(EMPTY_MAINTENANCE_DATA), referenceDate: todayDateOnly(), selectedSubassemblyId: null, drawerOpen: false }),
  exportMaintenance: () => { const state = get(); return structuredClone({ equipment: state.equipment, subassemblies: state.subassemblies, plans: state.plans, events: state.events, units: state.units }) },
  replaceMaintenanceData: (data) => { const normalized = normalizeMaintenanceData(data); assertNoDuplicateMaintenanceIds(normalized); set({ ...normalized }) },
  createEquipmentForAsset: (asset) => {
    const existing = get().equipment.find((item) => item.assetId === asset.id)
    if (existing) return existing
    const equipment: Equipment = { id: id('EQ'), assetId: asset.id, name: asset.name, active: true, source: 'LOCAL', createdAt: now() }
    set((state) => ({ equipment: [...state.equipment, equipment] }))
    return equipment
  },
  saveSubassembly: (value) => set((state) => { const next = { ...state.exportMaintenance(), subassemblies: upsert(state.subassemblies, { ...value, trackingMode: value.trackingMode ?? 'REPLACEMENT', source: value.source ?? 'LOCAL', createdAt: value.createdAt ?? now() }) }; assertNoDuplicateMaintenanceIds(next); return { subassemblies: next.subassemblies } }),
  savePlan: (value) => set((state) => { const next = { ...state.exportMaintenance(), plans: upsert(state.plans, { ...value, source: value.source ?? 'LOCAL', createdAt: value.createdAt ?? now() }) }; assertNoDuplicateMaintenanceIds(next); return { plans: next.plans } }),
  appendEvent: (value) => set((state) => { const next = { ...state.exportMaintenance(), events: [...state.events, { ...value, id: value.id ?? id('EVT'), source: value.source ?? 'LOCAL', createdAt: value.createdAt ?? now() }] }; assertNoDuplicateMaintenanceIds(next); return { events: next.events } }),
  openSubassembly: (selectedSubassemblyId) => set({ selectedSubassemblyId, drawerOpen: true }), closeDrawer: () => set({ drawerOpen: false }),
  setViewMode: (viewMode) => set({ viewMode }), setStatusFilter: (statusFilter) => set({ statusFilter }), setFilterBehavior: (filterBehavior) => set({ filterBehavior }), setShowOkBadges: (showOkBadges) => set({ showOkBadges }), setReferenceDate: (referenceDate) => set({ referenceDate }),
  setOperationalView: (operationalView) => set({ operationalView }), setCriticalityFilter: (criticalityFilter) => set({ criticalityFilter }), setRecentDays: (recentDays) => set({ recentDays }),
  setAreaFilter: (areaFilter) => set({ areaFilter }), setLevelFilter: (levelFilter) => set({ levelFilter }),
  seedDemoData: (assets) => {
    const asset = assets[0]; if (!asset) return
    const equipment = get().createEquipmentForAsset(asset)
    if (get().subassemblies.some((item) => item.equipmentId === equipment.id)) return
    const subassemblyId = id('SUB')
    get().saveSubassembly({ id: subassemblyId, equipmentId: equipment.id, name: 'Rodamiento principal', description: 'Datos de demostracion', sapId: 'SAP-DEMO-001', active: true, criticality: 'A', trackingMode: 'REPLACEMENT' })
    get().savePlan({ id: id('PLAN'), subassemblyId, name: 'Recambio preventivo', intervalValue: 6, intervalUnit: 'MONTHS', warningDays: 30, criticalDays: 7, active: true })
    get().appendEvent({ subassemblyId, type: 'REPLACEMENT', date: todayDateOnly(), notes: 'Evento demo inicial', workOrder: 'OT-DEMO-001' })
  },
}))

function upsert<T extends { id: string }>(items: T[], value: T): T[] {
  const index = items.findIndex((item) => item.id === value.id)
  if (index < 0) return [...items, value]
  const next = items.slice(); next[index] = value; return next
}

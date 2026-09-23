import { create, type StateCreator } from 'zustand'
import { createDemoSparesData } from '../data/demoSpares'
import { normalizeCriticalSparesData } from '../data/sparesNormalizer'
import { AVAILABLE_STATUSES, getUncoveredAt } from '../domain/spareSelectors'
import type { CriticalSparesConfig, CriticalSparesData, PhysicalSpareUnit, SpareHistoryEvent, SpareType, SpareUnitStatus } from '../types'

export type SparesStorageStatus = 'IDLE' | 'LOADING' | 'SAVING' | 'SAVED' | 'ERROR'
export type SpareDraft = Omit<SpareType, 'id' | 'createdAt' | 'updatedAt' | 'uncoveredAt'>
export type UnitDraft = Omit<PhysicalSpareUnit, 'id' | 'spareTypeId'>

export interface CriticalSparesStore extends CriticalSparesData {
  storageStatus: SparesStorageStatus
  storageError: string
  hydrate: (data: CriticalSparesData) => void
  setStorageState: (status: SparesStorageStatus, error?: string) => void
  addSpare: (draft: SpareDraft) => string
  updateSpare: (id: string, draft: SpareDraft) => void
  deleteSpare: (id: string) => void
  addUnit: (spareTypeId: string, draft: UnitDraft) => string
  updateUnit: (id: string, draft: UnitDraft) => void
  deleteUnit: (id: string) => void
  updateConfig: (config: CriticalSparesConfig) => void
}

const clone = <T,>(value: T): T => structuredClone(value)
const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

function coverageTransition(state: CriticalSparesData, units: PhysicalSpareUnit[], spareId: string, effectiveDate: string) {
  const wasCovered = state.units.some((unit) => unit.spareTypeId === spareId && AVAILABLE_STATUSES.includes(unit.status))
  const isCovered = units.some((unit) => unit.spareTypeId === spareId && AVAILABLE_STATUSES.includes(unit.status))
  return state.spareTypes.map((spare) => spare.id !== spareId ? spare : {
    ...spare, uncoveredAt: isCovered ? null : wasCovered ? effectiveDate : getUncoveredAt(state, spareId),
  })
}

function nextUnitId(data: CriticalSparesData, spare: SpareType) {
  const category = spare.categoryId.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase().padEnd(3, 'X')
  const max = [...data.units.map((unit) => unit.id), ...data.history.map((event) => event.unitId)].reduce((current, id) => Math.max(current, Number(id.match(/(\d+)$/)?.[1] ?? 0)), 0)
  return `LC1C-${category}-${String(max + 1).padStart(4, '0')}`
}

function historyFor(unit: PhysicalSpareUnit, previousStatus: SpareUnitStatus | undefined, data: CriticalSparesData): SpareHistoryEvent {
  const user = data.config.users.find((item) => item.id === data.config.currentUserId)?.name ?? 'Usuario local'
  return { id: uid('history'), unitId: unit.id, spareTypeId: unit.spareTypeId, timestamp: new Date().toISOString(), user, previousStatus, nextStatus: unit.status, equipmentId: unit.installedEquipmentId, comment: unit.comment, snapshot: clone(unit) }
}

// The same domain mutations run in an isolated server store inside a DB transaction.
export const criticalSparesState = (initial: CriticalSparesData): StateCreator<CriticalSparesStore> => (set, get) => ({
  ...initial,
  storageStatus: 'IDLE', storageError: '',
  hydrate: (data) => set({ ...normalizeCriticalSparesData(data) }),
  setStorageState: (storageStatus, storageError = '') => set({ storageStatus, storageError }),
  addSpare: (draft) => {
    const id = uid('spare'); const now = new Date().toISOString()
    set((state) => ({ spareTypes: [...state.spareTypes, { ...clone(draft), id, createdAt: now, updatedAt: now, uncoveredAt: now }] }))
    return id
  },
  updateSpare: (id, draft) => set((state) => ({ spareTypes: state.spareTypes.map((item) => item.id === id ? { ...item, ...clone(draft), updatedAt: new Date().toISOString() } : item) })),
  deleteSpare: (id) => set((state) => ({ spareTypes: state.spareTypes.filter((item) => item.id !== id), units: state.units.filter((item) => item.spareTypeId !== id), history: state.history.filter((item) => item.spareTypeId !== id) })),
  addUnit: (spareTypeId, draft) => {
    const state = get(); const spare = state.spareTypes.find((item) => item.id === spareTypeId)
    if (!spare) throw new Error('El tipo de repuesto no existe.')
    const id = nextUnitId(state, spare); const created: PhysicalSpareUnit = { ...clone(draft), id, spareTypeId }
    const units = [...state.units, created]
    set({ units, spareTypes: coverageTransition(state, units, spareTypeId, created.statusSince), history: [...state.history, historyFor(created, undefined, state)] })
    return id
  },
  updateUnit: (id, draft) => set((state) => {
    const previous = state.units.find((item) => item.id === id)
    if (!previous) return state
    const changed = previous.status !== draft.status
    const updated: PhysicalSpareUnit = { ...previous, ...clone(draft), statusSince: changed ? (draft.statusSince || new Date().toISOString().slice(0, 10)) : draft.statusSince }
    const units = state.units.map((item) => item.id === id ? updated : item)
    return { units, spareTypes: coverageTransition(state, units, previous.spareTypeId, updated.statusSince), history: changed ? [...state.history, historyFor(updated, previous.status, state)] : state.history }
  }),
  deleteUnit: (id) => set((state) => {
    const previous = state.units.find((unit) => unit.id === id)
    const units = state.units.filter((item) => item.id !== id)
    return { units, spareTypes: previous ? coverageTransition(state, units, previous.spareTypeId, new Date().toISOString()) : state.spareTypes }
  }),
  updateConfig: (config) => set({ config: clone(config) }),
})

export const useCriticalSparesStore = create<CriticalSparesStore>(criticalSparesState(createDemoSparesData()))

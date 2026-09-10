import { createDefaultPlannerData, normalizePlannerData } from '../data/plannerNormalizer'
import { IndexedDbPlannerRepository } from '../repositories/IndexedDbPlannerRepository'
import type { PlannerRepository } from '../repositories/PlannerRepository'
import { usePlannerStore } from '../store/plannerStore'
import type { PlannerModuleData } from '../types'

export const LEGACY_PLANNER_STORAGE_KEY = 'planner_mantenimiento_general_v1'

let repository: PlannerRepository | null = null
let initializePromise: Promise<void> | null = null
let unsubscribe: (() => void) | null = null
let saveQueue = Promise.resolve()
let hydrating = false

export function getPlannerRepository() {
  repository ??= new IndexedDbPlannerRepository()
  return repository
}

export function initializePlannerPersistence(customRepository?: PlannerRepository) {
  if (customRepository && repository !== customRepository) {
    unsubscribe?.()
    unsubscribe = null
    initializePromise = null
    repository = customRepository
  }
  if (initializePromise) return initializePromise
  initializePromise = (async () => {
    const store = usePlannerStore.getState()
    store.setStorageState('LOADING')
    try {
      const persisted = await getPlannerRepository().load()
      const legacy = persisted ? null : readLegacyPlannerData()
      const initialData = persisted ?? legacy ?? createDefaultPlannerData()
      hydrating = true
      usePlannerStore.getState().hydrate(initialData)
      hydrating = false
      if (!persisted) {
        await getPlannerRepository().replaceAll(initialData)
        if (legacy) removeLegacyPlannerData()
      }
      usePlannerStore.getState().setStorageState('SAVED')
      unsubscribe ??= usePlannerStore.subscribe((state, previous) => {
        if (hydrating || state.projectInfo === previous.projectInfo && state.tasks === previous.tasks && state.paradas === previous.paradas) return
        queuePlannerSave({ projectInfo: state.projectInfo, tasks: state.tasks, paradas: state.paradas })
      })
    } catch (error) {
      hydrating = false
      usePlannerStore.getState().setStorageState('ERROR', error instanceof Error ? error.message : 'No se pudo iniciar la base local del Planner.')
    }
  })()
  return initializePromise
}

export async function replacePersistentPlannerData(data: PlannerModuleData) {
  const normalized = normalizePlannerData(data)
  hydrating = true
  usePlannerStore.getState().hydrate(normalized)
  hydrating = false
  usePlannerStore.getState().setStorageState('SAVING')
  const operation = saveQueue.then(() => getPlannerRepository().replaceAll(normalized))
  saveQueue = operation.catch(() => undefined)
  try {
    await operation
    usePlannerStore.getState().setStorageState('SAVED')
  } catch (error) {
    usePlannerStore.getState().setStorageState('ERROR', error instanceof Error ? error.message : 'No se pudieron guardar los datos del Planner.')
    throw error
  }
}

function queuePlannerSave(data: PlannerModuleData) {
  usePlannerStore.getState().setStorageState('SAVING')
  const snapshot = structuredClone(data)
  saveQueue = saveQueue
    .then(() => getPlannerRepository().replaceAll(snapshot))
    .then(() => usePlannerStore.getState().setStorageState('SAVED'))
    .catch((error) => usePlannerStore.getState().setStorageState('ERROR', error instanceof Error ? error.message : 'No se pudieron guardar los datos del Planner.'))
}

function readLegacyPlannerData() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LEGACY_PLANNER_STORAGE_KEY)
    return raw ? normalizePlannerData(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function removeLegacyPlannerData() {
  try { window.localStorage.removeItem(LEGACY_PLANNER_STORAGE_KEY) } catch { /* El dato ya quedó migrado a IndexedDB. */ }
}

export function resetPlannerPersistenceForTests() {
  unsubscribe?.()
  unsubscribe = null
  repository = null
  initializePromise = null
  saveQueue = Promise.resolve()
  hydrating = false
  usePlannerStore.setState({ ...createDefaultPlannerData(), storageStatus: 'IDLE', storageError: '' })
}

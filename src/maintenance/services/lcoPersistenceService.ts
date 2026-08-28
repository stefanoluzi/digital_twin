import { normalizeLcoCouplingData } from '../data/lcoCouplingNormalizer'
import type { LcoCouplingModuleData } from '../domain/lcoCouplings'
import { IndexedDbLcoCouplingsRepository } from '../repositories/IndexedDbLcoCouplingsRepository'
import type { LcoCouplingsRepository } from '../repositories/LcoCouplingsRepository'
import { useMaintenanceStore } from '../store/maintenanceStore'

let repository: LcoCouplingsRepository | null = null
let initializePromise: Promise<void> | null = null
let unsubscribe: (() => void) | null = null
let saveQueue = Promise.resolve()
let hydrating = false

export function getLcoRepository() {
  repository ??= new IndexedDbLcoCouplingsRepository()
  return repository
}

export function initializeLcoPersistence(customRepository?: LcoCouplingsRepository) {
  if (customRepository && repository !== customRepository) { unsubscribe?.(); unsubscribe = null; initializePromise = null; repository = customRepository }
  if (initializePromise) return initializePromise
  initializePromise = (async () => {
    const store = useMaintenanceStore.getState()
    store.setLcoStorageState('LOADING')
    try {
      const legacy = store.lcoCouplings
      const data = await getLcoRepository().load()
      const fingerprint = legacyFingerprint(legacy)
      const shouldRecoverLegacy = legacy.events.length > 0 && data.events.length === 0 && !data.migratedLegacyFingerprints.includes(fingerprint)
      const initialData = shouldRecoverLegacy
        ? normalizeLcoCouplingData({ ...legacy, migratedLegacyFingerprints: [...new Set([...data.migratedLegacyFingerprints, ...legacy.migratedLegacyFingerprints, fingerprint])] })
        : data
      hydrating = true
      useMaintenanceStore.getState().hydrateLcoCouplings(initialData)
      hydrating = false
      if (shouldRecoverLegacy) await getLcoRepository().replaceAll(initialData)
      else if (legacy.events.length && !data.migratedLegacyFingerprints.includes(fingerprint)) useMaintenanceStore.getState().setLcoLegacyCandidate(legacy)
      useMaintenanceStore.getState().setLcoStorageState('SAVED')
      unsubscribe ??= useMaintenanceStore.subscribe((state, previous) => {
        if (hydrating || state.lcoCouplings === previous.lcoCouplings) return
        queueSave(state.lcoCouplings)
      })
    } catch (error) {
      hydrating = false
      useMaintenanceStore.getState().setLcoStorageState('ERROR', error instanceof Error ? error.message : 'No se pudo iniciar el almacenamiento local.')
    }
  })()
  return initializePromise
}

export function replacePersistentLcoData(data: LcoCouplingModuleData) {
  const normalized = normalizeLcoCouplingData(data)
  hydrating = true
  useMaintenanceStore.getState().hydrateLcoCouplings(normalized)
  hydrating = false
  return saveNow(normalized)
}

export function importLegacyLcoCandidate() {
  const store = useMaintenanceStore.getState(); const candidate = store.lcoLegacyCandidate
  if (!candidate) return Promise.resolve()
  const fingerprint = legacyFingerprint(candidate)
  const events = [...store.lcoCouplings.events]
  const ids = new Set(events.map((event) => event.id))
  candidate.events.forEach((event) => { if (!ids.has(event.id)) events.push(event) })
  store.setLcoLegacyCandidate(null)
  return replacePersistentLcoData({ ...store.lcoCouplings, events, migratedLegacyFingerprints: [...new Set([...store.lcoCouplings.migratedLegacyFingerprints, fingerprint])] })
}

export function dismissLegacyLcoCandidate() {
  const store = useMaintenanceStore.getState(); const candidate = store.lcoLegacyCandidate
  if (!candidate) return Promise.resolve()
  store.setLcoLegacyCandidate(null)
  return replacePersistentLcoData({ ...store.lcoCouplings, migratedLegacyFingerprints: [...new Set([...store.lcoCouplings.migratedLegacyFingerprints, legacyFingerprint(candidate)])] })
}

function queueSave(data: LcoCouplingModuleData) {
  useMaintenanceStore.getState().setLcoStorageState('SAVING')
  const snapshot = structuredClone(data)
  saveQueue = saveQueue.then(() => getLcoRepository().replaceAll(snapshot)).then(() => useMaintenanceStore.getState().setLcoStorageState('SAVED')).catch((error) => useMaintenanceStore.getState().setLcoStorageState('ERROR', error instanceof Error ? error.message : 'No se pudieron guardar los datos.'))
}

async function saveNow(data: LcoCouplingModuleData) {
  useMaintenanceStore.getState().setLcoStorageState('SAVING')
  const snapshot = structuredClone(data)
  const operation = saveQueue.then(() => getLcoRepository().replaceAll(snapshot))
  saveQueue = operation.catch(() => undefined)
  try { await operation; useMaintenanceStore.getState().setLcoStorageState('SAVED') }
  catch (error) { useMaintenanceStore.getState().setLcoStorageState('ERROR', error instanceof Error ? error.message : 'No se pudieron guardar los datos.'); throw error }
}

function legacyFingerprint(data: LcoCouplingModuleData) {
  return data.events.map((event) => `${event.id}:${event.updatedAt ?? event.createdAt}`).sort().join('|')
}

export function resetLcoPersistenceForTests() {
  unsubscribe?.(); unsubscribe = null; repository = null; initializePromise = null; saveQueue = Promise.resolve(); hydrating = false
}

import { HttpCriticalSparesRepository, type CentralCriticalSparesRepository, type CentralSparesState } from '../repositories/HttpCriticalSparesRepository'
import { useCriticalSparesStore, type SpareDraft, type UnitDraft } from '../store/criticalSparesStore'
import { parseBackup } from '../domain/sparesValidation'
import type { CriticalSparesConfig, CriticalSparesData } from '../types'

const actorKey = 'critical-spares:actor'
const actor = () => localStorage.getItem(actorKey) || useCriticalSparesStore.getState().config.currentUserId || 'local-user'
const repository: CentralCriticalSparesRepository = new HttpCriticalSparesRepository('/api', actor)
let revision: number | null = null
let busy = false
let loading: Promise<void> | null = null

function hydrate(state: CentralSparesState) {
  revision = state.revision
  const currentUserId = actor()
  if (state.data.config.users.some((user) => user.id === currentUserId)) state.data.config.currentUserId = currentUserId
  // v2 is validated by the server. Do not run the legacy normalizer here: it can
  // rename catalog entries or fill missing data from the old demonstration.
  useCriticalSparesStore.setState(structuredClone(state.data))
  useCriticalSparesStore.getState().setStorageState('SAVED')
}

export function initializeCriticalSparesPersistence() {
  if (loading) return loading
  if (busy) return Promise.resolve()
  useCriticalSparesStore.getState().setStorageState('LOADING')
  loading = repository.load().then(hydrate).catch((error) => {
    useCriticalSparesStore.getState().setStorageState('ERROR', String(error.message))
  }).finally(() => { loading = null })
  return loading
}

async function mutate(operation: (revision: number) => Promise<CentralSparesState>) {
  const blocked = busy || loading ? 'Hay una operación en curso. Esperá a que termine.' : revision === null ? 'Primero conectá con el servidor.' : null
  if (blocked) {
    useCriticalSparesStore.setState({ storageError: blocked })
    throw new Error(blocked)
  }
  busy = true
  useCriticalSparesStore.getState().setStorageState('SAVING')
  try { const result = await operation(revision!); hydrate(result); return result }
  catch (error) {
    useCriticalSparesStore.getState().setStorageState('ERROR', error instanceof Error ? error.message : 'No se pudo guardar.')
    throw error
  } finally { busy = false }
}

export const sparesActions = {
  addSpare: async (draft: SpareDraft) => (await mutate((v) => repository.create(draft, v))).id!,
  updateSpare: (id: string, draft: SpareDraft) => mutate((v) => repository.update(id, draft, v)),
  deleteSpare: (id: string) => mutate((v) => repository.remove(id, v)),
  addUnit: (spareTypeId: string, draft: UnitDraft) => mutate((v) => repository.createUnit(spareTypeId, draft, v)),
  updateUnit: (id: string, draft: UnitDraft) => mutate((v) => repository.updateUnit(id, draft, v)),
  deleteUnit: (id: string) => mutate((v) => repository.removeUnit(id, v)),
  updateConfig: (config: CriticalSparesConfig) => mutate((v) => repository.updateConfig(config, v)),
}

// Identity is a local preference, not a shared setting that changes other PCs.
export function selectSparesUser(currentUserId: string) {
  localStorage.setItem(actorKey, currentUserId)
  useCriticalSparesStore.getState().updateConfig({ ...useCriticalSparesStore.getState().config, currentUserId })
}

export async function replaceCriticalSparesData(data: CriticalSparesData) { await mutate((v) => repository.importBackup(data, v)) }

export function exportCriticalSparesBackup(data: CriticalSparesData) {
  const blob = new Blob([JSON.stringify({ format: 'LACO1_CRITICAL_SPARES', version: 2, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `repuestos-criticos-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url)
}

export async function exportCentralSparesBackup() { exportCriticalSparesBackup((await repository.load()).data) }

/** Raw read-only recovery: never opens a missing DB or normalizes/writes legacy data. */
export async function exportLegacyIndexedDbBackup() {
  const { MAINTENANCE_DB_NAME, CRITICAL_SPARES_STATE_STORE } = await import('../../maintenance/repositories/maintenanceIndexedDb')
  const databases = await indexedDB.databases()
  if (!databases.some((database) => database.name === MAINTENANCE_DB_NAME)) throw new Error('No hay una base local anterior en este navegador/origen.')
  const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(MAINTENANCE_DB_NAME); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
  try {
    if (!db.objectStoreNames.contains(CRITICAL_SPARES_STATE_STORE)) throw new Error('No hay respaldo local de Repuestos.')
    const raw = await new Promise<CriticalSparesData>((resolve, reject) => {
      const request = db.transaction(CRITICAL_SPARES_STATE_STORE, 'readonly').objectStore(CRITICAL_SPARES_STATE_STORE).get('active')
      request.onsuccess = () => request.result ? resolve(request.result) : reject(new Error('No hay datos locales anteriores.'))
      request.onerror = () => reject(request.error)
    })
    const blob = new Blob([JSON.stringify({ format: 'LACO1_CRITICAL_SPARES', version: raw.schemaVersion || 1, exportedAt: new Date().toISOString(), data: raw }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'repuestos-respaldo-indexeddb-original.json'; anchor.click(); URL.revokeObjectURL(url)
  } finally { db.close() }
}

export async function parseCriticalSparesBackup(file: File) { return parseBackup(JSON.parse(await file.text())) }

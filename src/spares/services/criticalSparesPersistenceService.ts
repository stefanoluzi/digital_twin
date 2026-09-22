import { createDemoSparesData } from '../data/demoSpares'
import { normalizeCriticalSparesData } from '../data/sparesNormalizer'
import { IndexedDbCriticalSparesRepository } from '../repositories/IndexedDbCriticalSparesRepository'
import type { CriticalSparesRepository } from '../repositories/CriticalSparesRepository'
import { useCriticalSparesStore } from '../store/criticalSparesStore'
import type { CriticalSparesData } from '../types'

let repository: CriticalSparesRepository | null = null
let initializePromise: Promise<void> | null = null
let unsubscribe: (() => void) | null = null
let saveQueue = Promise.resolve()
let hydrating = false

export function getCriticalSparesRepository() { repository ??= new IndexedDbCriticalSparesRepository(); return repository }

export function initializeCriticalSparesPersistence(customRepository?: CriticalSparesRepository) {
  if (customRepository && customRepository !== repository) { unsubscribe?.(); unsubscribe = null; initializePromise = null; repository = customRepository }
  if (initializePromise) return initializePromise
  initializePromise = (async () => {
    const store = useCriticalSparesStore.getState(); store.setStorageState('LOADING')
    try {
      const persisted = await getCriticalSparesRepository().load()
      const initial = persisted ?? createDemoSparesData()
      hydrating = true; useCriticalSparesStore.getState().hydrate(initial); hydrating = false
      if (!persisted) await getCriticalSparesRepository().replaceAll(initial)
      useCriticalSparesStore.getState().setStorageState('SAVED')
      unsubscribe ??= useCriticalSparesStore.subscribe((state, previous) => {
        if (hydrating || state.spareTypes === previous.spareTypes && state.units === previous.units && state.history === previous.history && state.config === previous.config) return
        queueSave(state)
      })
    } catch (error) { hydrating = false; store.setStorageState('ERROR', error instanceof Error ? error.message : 'No se pudo iniciar la base local de Repuestos.') }
  })()
  return initializePromise
}

function dataFrom(state: ReturnType<typeof useCriticalSparesStore.getState>): CriticalSparesData {
  return { schemaVersion: 2, spareTypes: state.spareTypes, units: state.units, history: state.history, config: state.config }
}

function queueSave(state: ReturnType<typeof useCriticalSparesStore.getState>) {
  useCriticalSparesStore.getState().setStorageState('SAVING')
  const snapshot = structuredClone(dataFrom(state))
  saveQueue = saveQueue.then(() => getCriticalSparesRepository().replaceAll(snapshot)).then(() => useCriticalSparesStore.getState().setStorageState('SAVED')).catch((error) => useCriticalSparesStore.getState().setStorageState('ERROR', error instanceof Error ? error.message : 'No se pudieron guardar los datos.'))
}

export async function replaceCriticalSparesData(data: CriticalSparesData) {
  const normalized = normalizeCriticalSparesData(data)
  hydrating = true; useCriticalSparesStore.getState().hydrate(normalized); hydrating = false
  useCriticalSparesStore.getState().setStorageState('SAVING')
  await getCriticalSparesRepository().replaceAll(normalized)
  useCriticalSparesStore.getState().setStorageState('SAVED')
}

export function exportCriticalSparesBackup(data: CriticalSparesData) {
  const blob = new Blob([JSON.stringify({ format: 'LACO1_CRITICAL_SPARES', version: 2, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `repuestos-criticos-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url)
}

export async function parseCriticalSparesBackup(file: File) {
  const parsed = JSON.parse(await file.text()) as { format?: string; data?: unknown }
  if (parsed.format !== 'LACO1_CRITICAL_SPARES' || !parsed.data) throw new Error('El archivo no es un respaldo válido de Repuestos Críticos.')
  return normalizeCriticalSparesData(parsed.data)
}

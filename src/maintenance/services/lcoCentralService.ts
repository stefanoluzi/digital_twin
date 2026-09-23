import { HttpLcoRepository, type LcoState } from '../repositories/HttpLcoRepository'
import { useMaintenanceStore } from '../store/maintenanceStore'
import type { CouplingInspectionEvent, CouplingReplacementEvent, ExtensionShaftReplacementEvent, LcoCouplingEvent, LcoCouplingModuleData } from '../domain/lcoCouplings'
import { validateLcoData } from '../domain/lcoValidation'

const repository = new HttpLcoRepository()
let revision: number | null = null
let busy = false
let loading: Promise<void> | null = null
function apply(state: LcoState) {
  revision = state.revision
  useMaintenanceStore.setState({ lcoCouplings: structuredClone(state.data), lcoCentralized: true, lcoStorageStatus: 'SAVED', lcoStorageError: '' })
}
function fail(error: unknown) {
  useMaintenanceStore.getState().setLcoStorageState('ERROR', error instanceof Error ? error.message : 'No se pudo completar la operación.')
}
export function initializeLcoCentral() {
  if (loading) return loading
  if (busy) return Promise.resolve()
  useMaintenanceStore.setState({ lcoCentralized: true, lcoStorageStatus: 'LOADING', lcoStorageError: '' })
  loading = repository.load().then(apply).catch(fail).finally(() => { loading = null })
  return loading
}
async function mutate(path: string, method: string, body?: unknown) {
  if (busy || loading || revision === null) throw new Error('Esperá la conexión o el guardado en curso.')
  busy = true
  useMaintenanceStore.getState().setLcoStorageState('SAVING')
  try { const result = await repository.request(path, method, body, revision); apply(result); return result }
  catch (error) { fail(error); throw error }
  finally { busy = false }
}
type Draft<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'type'>
export const lcoCommands = {
  inspection: (value: Draft<CouplingInspectionEvent>) => mutate('/events', 'POST', { ...value, type: 'INSPECTION' }),
  couplingReplacement: (value: Draft<CouplingReplacementEvent>) => mutate('/events', 'POST', { ...value, type: 'COUPLING_REPLACEMENT' }),
  shaftReplacement: (value: Draft<ExtensionShaftReplacementEvent>) => mutate('/events', 'POST', { ...value, type: 'SHAFT_REPLACEMENT' }),
  replace: (event: LcoCouplingEvent) => mutate(`/events/${encodeURIComponent(event.id)}`, 'PUT', event),
  remove: (id: string, couplingId?: string) => mutate(`/events/${encodeURIComponent(id)}${couplingId ? `?couplingId=${encodeURIComponent(couplingId)}` : ''}`, 'DELETE'),
  config: (data: Omit<LcoCouplingModuleData, 'events'>) => mutate('/config', 'PUT', data),
}
export async function importLcoCentral(input: LcoCouplingModuleData) {
  const result = await mutate('/import', 'POST', validateLcoData(input))
  if (!result.receipt) throw new Error('El servidor no confirmó la importación.')
  const verified = await repository.request<{ hash: string; eventCount: number }>(`/imports/${result.receipt.hash}`)
  if (verified.hash !== result.receipt.hash || verified.eventCount !== input.events.length) throw new Error('No se pudo verificar la migración. Conservá el original y actualizá antes de reintentar.')
  // The receipt in PostgreSQL is the completion marker, not localStorage.
  return result
}
export async function migrateLocalLco() {
  const { IndexedDbLcoCouplingsRepository } = await import('../repositories/IndexedDbLcoCouplingsRepository')
  const legacy = await new IndexedDbLcoCouplingsRepository(undefined, true).load()
  if (!confirm(`Migrar ${legacy.events.length} eventos y sus fotos a PostgreSQL? Se verificará la importación sin borrar IndexedDB.`)) return
  await importLcoCentral(legacy)
}
export async function readCentralLco() { return (await repository.load()).data }
export function runLco(operation: () => Promise<unknown>, onSuccess?: () => void) {
  void Promise.resolve().then(operation).then(() => onSuccess?.()).catch((error) => { fail(error); alert(error instanceof Error ? error.message : 'No se pudo guardar.') })
}

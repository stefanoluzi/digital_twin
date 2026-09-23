import type { CriticalSparesConfig, CriticalSparesData } from '../types'
import type { SpareDraft, UnitDraft } from '../store/criticalSparesStore'

export interface CentralSparesState { data: CriticalSparesData; revision: number; id?: string }
export class SparesApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

/** Operational persistence. No IndexedDB fallback and no optimistic local writes. */
export class HttpCriticalSparesRepository {
  constructor(private base = '/api', private actor = () => 'local-user') {}
  private async request<T>(path: string, method = 'GET', body?: unknown, revision?: number): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${this.base}${path}`, {
        method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), 'X-Actor-Id': this.actor(), ...(revision === undefined ? {} : { 'If-Match': String(revision) }) },
        body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(90000),
      })
    } catch { throw new SparesApiError('No hay conexión con el servidor. No se guardó localmente. Actualizá para comprobar el resultado antes de reintentar.', 0) }
    const result = await response.json().catch(() => null)
    if (!response.ok || result === null) {
      const details = Array.isArray(result?.details) ? result.details.map((item: unknown) => typeof item === 'string' ? item : JSON.stringify(item)).slice(0, 10).join('\n') : ''
      throw new SparesApiError(`${result?.error || 'Respuesta inválida del servidor'}${details ? `\n${details}` : ''}`, response.status)
    }
    return result as T
  }
  load() { return this.request<CentralSparesState>('/state') }
  list() { return this.request<{ revision: number; items: CriticalSparesData['spareTypes'] }>('/spares') }
  get(id: string) { return this.request(`/spares/${encodeURIComponent(id)}`) }
  create(draft: SpareDraft, revision: number) { return this.request<CentralSparesState>('/spares', 'POST', draft, revision) }
  update(id: string, draft: SpareDraft, revision: number) { return this.request<CentralSparesState>(`/spares/${encodeURIComponent(id)}`, 'PUT', draft, revision) }
  remove(id: string, revision: number) { return this.request<CentralSparesState>(`/spares/${encodeURIComponent(id)}`, 'DELETE', undefined, revision) }
  createUnit(spareTypeId: string, draft: UnitDraft, revision: number) { return this.request<CentralSparesState>('/units', 'POST', { ...draft, spareTypeId }, revision) }
  updateUnit(id: string, draft: UnitDraft, revision: number) { return this.request<CentralSparesState>(`/units/${encodeURIComponent(id)}`, 'PUT', draft, revision) }
  removeUnit(id: string, revision: number) { return this.request<CentralSparesState>(`/units/${encodeURIComponent(id)}`, 'DELETE', undefined, revision) }
  updateConfig(config: CriticalSparesConfig, revision: number) { return this.request<CentralSparesState>('/config', 'PUT', config, revision) }
  importBackup(data: CriticalSparesData, revision: number) { return this.request<CentralSparesState>('/import', 'POST', { format: 'LACO1_CRITICAL_SPARES', version: 2, exportedAt: new Date().toISOString(), data }, revision) }
}

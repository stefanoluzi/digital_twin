import type { LcoCouplingModuleData } from '../domain/lcoCouplings'
export interface LcoState { data: LcoCouplingModuleData; revision: number; id?: string; receipt?: { hash: string; eventCount: number; revision: number } }
export class HttpLcoRepository {
  constructor(private base = '/api/controles-criticos/acoplamientos') {}
  async request<T = LcoState>(path: string, method = 'GET', body?: unknown, revision?: number): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${this.base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(revision === undefined ? {} : { 'If-Match': String(revision) }) }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(90000) })
    } catch { throw new Error('No hay conexión con el servidor. Actualizá y comprobá el resultado antes de reintentar. No se guardó localmente.') }
    const result = await response.json().catch(() => null)
    if (!response.ok || !result) throw Object.assign(new Error(`${result?.error || 'Respuesta inválida del servidor'}${result?.details ? `\n${JSON.stringify(result.details)}` : ''}`), { status: response.status })
    return result as T
  }
  load() { return this.request('/state') }
}

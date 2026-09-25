import type { RepairEvent, RepairState } from './types'
export class RepairsRepository {
  constructor(private base = '/api/repairs') {}
  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.base}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(60000) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'No se pudo consultar el servidor')
    return data
  }
  load() { return this.get<RepairState>('/state') }
  events(id: string) { return this.get<RepairEvent[]>(`/requests/${encodeURIComponent(id)}/events`) }
  async save(path: string, body: unknown, revision: number, actor: string, method = 'POST'): Promise<RepairState & { id?: string }> {
    let response: Response
    try { response = await fetch(`${this.base}${path}`, { method, headers: { 'Content-Type': 'application/json', 'If-Match': String(revision), 'X-Actor-Id': actor }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) }) }
    catch { throw new Error('No se pudo confirmar el guardado. Actualizá los datos antes de reintentar; no se guardó una copia local.') }
    const data = await response.json()
    if (!response.ok) throw new Error(`${data.error || 'No se pudo guardar'}${data.details ? `: ${data.details.map((item: { message?: string }) => item.message || '').join('; ')}` : ''}`)
    return data
  }
}

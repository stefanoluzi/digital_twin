import type { RexState } from './types'
export class RexRepository {
  constructor(private base = '/api/rex') {}
  async load(): Promise<RexState> {
    const response = await fetch(`${this.base}/state`, { cache: 'no-store', signal: AbortSignal.timeout(60000) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'No se pudo cargar Tareas REX')
    return data
  }
  async save(path: string, body: unknown, revision: number, method = 'POST'): Promise<RexState & { id: string }> {
    let response: Response
    try { response = await fetch(`${this.base}${path}`, { method, headers: { 'Content-Type': 'application/json', 'If-Match': String(revision), 'X-Actor-Id': 'local-user' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) }) }
    catch { throw new Error('No se pudo confirmar el guardado. Volvé a abrir el módulo antes de reintentar; no se guardó una copia local.') }
    const data = await response.json()
    if (!response.ok) throw new Error(`${data.error || 'No se pudo guardar'}${Array.isArray(data.details) ? ': ' + data.details.map((d: { message: string }) => d.message).join('; ') : ''}`)
    return data
  }
}

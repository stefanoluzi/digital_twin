import { useState, type FormEvent } from 'react'
import { BLOCK_OWNERS, OWNER_LABELS, STATUS_LABELS, type BlockOwner, type RepairItem, type RepairRequest, type RepairState, type RepairStatus } from './types'
import { RepairDatePicker } from './RepairCalendar'
import { today } from './domain'

export type RepairSave = (path: string, body: unknown, method?: string) => Promise<boolean>
export function eligibleStatusItems(items: RepairItem[], target: RepairStatus) {
  return items.filter((i) => !['DELIVERED', 'CANCELLED'].includes(i.status) && i.status !== target && !(target === 'DELIVERED' && i.status === 'BLOCKED'))
}
export function RepairStatusControl({ request, state, busy, onSave, item }: { request: RepairRequest; state: RepairState; busy: boolean; onSave: RepairSave; item?: RepairItem }) {
  const [target, setTarget] = useState<RepairStatus | ''>('')
  const [mode, setMode] = useState('all')
  const [ids, setIds] = useState<string[]>([])
  const [date, setDate] = useState(today())
  const [owner, setOwner] = useState<BlockOwner>('PLANT')
  const [error, setError] = useState('')
  const items = item ? [item] : request.items
  const current = items.every((i) => i.status === items[0].status) ? items[0].status : ''
  const eligible = target ? eligibleStatusItems(items, target) : []
  const selected = mode === 'all' ? eligible.map((i) => i.id) : ids
  const blocked = eligible.some((i) => selected.includes(i.id) && i.status === 'BLOCKED')
  const begin = (status: RepairStatus) => { setTarget(status); setError(''); setMode(status === 'DELIVERED' ? 'select' : 'all'); setIds(eligibleStatusItems(items, status).slice(0, 1).map((i) => i.id)); setDate(today()) }
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError('')
    if (!selected.length) { setError('Seleccioná al menos una unidad.'); return }
    const form = new FormData(e.currentTarget)
    const comment = String(form.get('comment') || '')
    const action = { PENDING: 'PEND', IN_PROGRESS: 'START', BLOCKED: 'BLOCK', DELIVERED: 'DELIVER', CANCELLED: 'CANCEL' }[target as RepairStatus]
    const ok = await onSave(`/requests/${request.id}/actions`, { action, itemIds: selected, date: target === 'PENDING' ? today() : date, comment, ...(target === 'BLOCKED' ? { owner, category: String(form.get('category')), description: comment } : {}) })
    if (ok) setTarget(''); else setError('No se pudo guardar. Revisá el mensaje de la API; si otro usuario hizo cambios, actualizá los datos antes de reintentar.')
  }
  return <div className="repair-state-control">
    <label><span>{item ? `Estado · Unidad #${item.ordinal}` : 'ESTADO ACTUAL'}</span><select aria-label={item ? `Estado unidad ${item.ordinal}` : 'Estado actual'} value={current} disabled={busy || !items.some((i) => !['DELIVERED', 'CANCELLED'].includes(i.status))} onChange={(e) => begin(e.target.value as RepairStatus)}>
      {!current && <option value="" disabled>Estados mixtos</option>}
      {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value} disabled={!eligibleStatusItems(items, value as RepairStatus).length && value !== current}>{label}</option>)}
    </select></label>
    {target && <form className="repair-state-confirm" onSubmit={(e) => void submit(e)} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); if (!busy) setTarget('') } }}>
      <h3>{target === 'BLOCKED' ? 'Bloquear reparación' : target === 'DELIVERED' ? 'Registrar entrega' : `Marcar como ${STATUS_LABELS[target]}`}</h3>
      <fieldset disabled={busy}>
        {items.length > 1 && <><b>Aplicar a:</b><label className="repairs-check"><input type="radio" checked={mode === 'all'} onChange={() => setMode('all')} />Todas las unidades pendientes de esta acción ({eligible.length})</label><label className="repairs-check"><input type="radio" checked={mode === 'select'} onChange={() => setMode('select')} />Seleccionar unidades</label><small>Las entregadas y canceladas nunca se modifican.</small></>}
        {target === 'DELIVERED' && <label>Cantidad entregada<input aria-label="Cantidad entregada" type="number" min={1} max={eligible.length} value={selected.length || ''} required onChange={(e) => { setMode('select'); setIds(eligible.slice(0, Math.max(0, Number(e.target.value))).map((i) => i.id)) }} /></label>}
        {mode === 'select' && items.length > 1 && eligible.map((i) => <label className="repairs-check" key={i.id}><input type="checkbox" checked={ids.includes(i.id)} onChange={(e) => setIds(e.target.checked ? [...ids, i.id] : ids.filter((id) => id !== i.id))} />Unidad #{i.ordinal} · {STATUS_LABELS[i.status]}</label>)}
        {target === 'DELIVERED' && items.some((i) => i.status === 'BLOCKED') && <p>Las unidades bloqueadas requieren resolver su bloqueo antes de entregarlas.</p>}
        {target !== 'PENDING' && <RepairDatePicker label={target === 'IN_PROGRESS' ? blocked ? 'Fecha de reanudación' : 'Fecha de inicio' : target === 'DELIVERED' ? 'Fecha de entrega' : 'Fecha real'} value={date} onChange={setDate} required max={today()} />}
        {target === 'BLOCKED' && <><label>Responsable del bloqueo<select value={owner} onChange={(e) => setOwner(e.target.value as BlockOwner)}>{BLOCK_OWNERS.map((o) => <option key={o} value={o}>{OWNER_LABELS[o]}</option>)}</select></label><label>Motivo<select name="category" key={owner} required><option value="">Seleccionar motivo</option>{state.config.blockCategories.filter((c) => c.owner === owner).map((c) => <option key={c.name}>{c.name}</option>)}</select></label></>}
        {target !== 'PENDING' && <label>{target === 'CANCELLED' ? 'Motivo de cancelación' : blocked ? 'Resolución del bloqueo' : target === 'DELIVERED' ? 'Observación' : 'Comentario'}<textarea name="comment" required={target === 'BLOCKED' || target === 'CANCELLED' || blocked} /></label>}
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <div className="repairs-actions"><button className="ghost" type="button" disabled={busy} onClick={() => setTarget('')}>Volver</button><button className="primary" disabled={busy || !eligible.length}>{busy ? 'Guardando…' : 'Confirmar'}</button></div>
    </form>}
  </div>
}

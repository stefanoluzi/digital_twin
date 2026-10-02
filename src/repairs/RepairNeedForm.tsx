import { useEffect, useMemo, useState } from 'react'
import { BusyButton } from '../shared/ux/LoadingFeedback'
import { RepairDatePicker, RepairMonthSelect } from './RepairCalendar'
import { monthEnd } from './calendar'
import { requestMetrics } from './domain'
import { needDraft, needIsDirty, needPayload, type NeedDraft } from './needDraft'
import { BLOCK_OWNERS, OWNER_LABELS, STATUS_LABELS, type RepairRequest, type RepairState, type RepairStatus } from './types'
import type { RepairSave } from './RepairStatusControl'
import './repairNeedForm.css'

export function RepairNeedForm({ request: r, state, busy, onSave, onDirtyChange, serverError }: { request: RepairRequest; state: RepairState; busy: boolean; serverError?: string; onSave: RepairSave; onDirtyChange?: (dirty: boolean) => void }) {
  const initial = useMemo(() => needDraft(r), [r])
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState('')
  useEffect(() => { setDraft(initial); setError('') }, [initial])
  const dirty = needIsDirty(draft, initial)
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false) }, [dirty, onDirtyChange])
  const set = <K extends keyof NeedDraft>(key: K, value: NeedDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const m = requestMetrics(r)
  const operational = draft.status !== initial.status || draft.blocked !== initial.blocked || draft.commitment !== initial.commitment || draft.owner !== initial.owner || draft.category !== initial.category || draft.description !== initial.description
  const openItems = r.items.filter((i) => !['DELIVERED', 'CANCELLED'].includes(i.status))
  return <form className="repair-need-form" onSubmit={async (event) => { event.preventDefault(); if (busy || !dirty) return; setError(''); try { if (await onSave(`/requests/${r.id}`, needPayload(draft, initial), 'PUT')) onDirtyChange?.(false); else setError('No se guardaron los cambios. Revisá el error del servidor y conservá esta edición hasta resolverlo.') } catch (e) { setError((e as Error).message) } }}>
    {(serverError || error) && <p role="alert">{serverError || error}</p>}
    <fieldset disabled={busy}>
      <div className="repair-need-grid">
        <label>Estado<select aria-label="Estado actual" disabled={!openItems.length} value={draft.status} onChange={(e) => { const status = e.target.value as RepairStatus; setDraft((d) => ({ ...d, status, blocked: status === 'BLOCKED' })) }}>{!draft.status && <option value="" disabled>Estados mixtos</option>}{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div><label>Mes de necesidad</label><RepairMonthSelect value={draft.targetMonth} onChange={(targetMonth) => setDraft((d) => ({ ...d, targetMonth, requiredDate: d.requiredDate.startsWith(targetMonth) ? d.requiredDate : '' }))} /></div>
        <label>Cantidad<input aria-label="Cantidad necesaria" type="number" min={1} max={1000} required value={draft.quantity} onChange={(e) => set('quantity', Number(e.target.value))} /><small>{m.delivered} de {r.quantity} entregadas</small></label>
        <label>Criticidad<select value={draft.criticality} onChange={(e) => set('criticality', e.target.value as NeedDraft['criticality'])}>{['NORMAL', 'HIGH', 'CRITICAL'].map((value, i) => <option key={value} value={value}>{['Normal', 'Alta', 'Crítica'][i]}</option>)}</select></label>
        <div><label>Compromiso actual</label><RepairDatePicker label="Compromiso actual" value={draft.commitment} onChange={(value) => set('commitment', value)} initialMonth={draft.targetMonth} /><small>{draft.commitment ? m.overdue ? `Vencido ${m.lateDays} días` : 'En término' : r.items.some((i) => i.commitments.length) ? 'Compromisos por unidad: ver detalle' : 'Sin definir'}</small></div>
        <label>Bloqueo<select disabled={!openItems.length} value={draft.blocked ? 'blocked' : 'none'} onChange={(e) => setDraft((d) => ({ ...d, blocked: e.target.value === 'blocked', status: e.target.value === 'blocked' ? 'BLOCKED' : d.status === 'BLOCKED' ? '' : d.status }))}><option value="none">Sin bloqueo</option><option value="blocked">Bloqueado</option></select></label>
        <div><label>Día exacto de necesidad (opcional)</label><RepairDatePicker label="Fecha necesidad Planta" value={draft.requiredDate} onChange={(value) => set('requiredDate', value)} initialMonth={draft.targetMonth} min={`${draft.targetMonth}-01`} max={monthEnd(draft.targetMonth)} /></div>
        {draft.criticality !== 'NORMAL' && <label>Motivo de criticidad<input required value={draft.criticalReason} onChange={(e) => set('criticalReason', e.target.value)} /></label>}
        {draft.blocked && <><label>Responsable del bloqueo<select value={draft.owner} onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value as NeedDraft['owner'], category: '' }))}>{BLOCK_OWNERS.map((owner) => <option key={owner} value={owner}>{OWNER_LABELS[owner]}</option>)}</select></label><label>Motivo del bloqueo<select required value={draft.category} onChange={(e) => set('category', e.target.value)}><option value="">Seleccionar</option>{state.config.blockCategories.filter((c) => c.owner === draft.owner).map((c) => <option key={c.name}>{c.name}</option>)}</select></label><label>Descripción / comentario<textarea value={draft.description} onChange={(e) => set('description', e.target.value)} /></label></>}
      </div>
      <details className="need-more"><summary>Más datos y unidades</summary><div className="repair-need-grid"><label>Taller<select value={draft.workshop} onChange={(e) => set('workshop', e.target.value)}>{state.config.workshops.map((w) => <option key={w}>{w}</option>)}</select></label><label>GMB<select value={draft.responsibleId} onChange={(e) => set('responsibleId', e.target.value)}><option value="">No aplica</option>{state.responsibles.filter((p) => p.active || p.id === draft.responsibleId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div><label>Límite crítico</label><RepairDatePicker label="Límite crítico" value={draft.criticalDueDate} onChange={(value) => set('criticalDueDate', value)} /></div><label className="repairs-check"><input type="checkbox" checked={draft.fixedDeadline} onChange={(e) => set('fixedDeadline', e.target.checked)} />Fecha inamovible</label><label>Observaciones<textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} /></label></div></details>
      {operational && <div className="need-operation"><RepairDatePicker label="Fecha real del cambio de estado / bloqueo" value={draft.date} onChange={(value) => set('date', value)} max={initial.date} required />{r.quantity > 1 && <><label>Aplicar estado, compromiso y bloqueo a<select value={draft.scope} onChange={(e) => set('scope', e.target.value)}><option value="all">Todas las unidades abiertas (incluye nuevas)</option><option value="selected">Seleccionar unidades</option></select></label>{draft.scope === 'selected' && openItems.map((item) => <label key={item.id} className="repairs-check"><input type="checkbox" checked={draft.itemIds.includes(item.id)} onChange={(e) => set('itemIds', e.target.checked ? [...draft.itemIds, item.id] : draft.itemIds.filter((id) => id !== item.id))} />#{item.ordinal} · {STATUS_LABELS[item.status]}</label>)}</>}</div>}
      {dirty && <label className="need-reason">Motivo / comentario del cambio<input required value={draft.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Indicá el motivo para el historial" /></label>}
      <footer><button type="button" className="ghost" disabled={!dirty} onClick={() => { setDraft(initial); setError('') }}>Cancelar</button><BusyButton type="submit" className="primary" busy={busy} disabled={!dirty}>Guardar cambios</BusyButton></footer>
    </fieldset>
  </form>
}

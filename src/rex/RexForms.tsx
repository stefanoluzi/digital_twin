import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BusyButton } from '../shared/ux/LoadingFeedback'
import { RepairDatePicker } from '../repairs/RepairCalendar'
import { fiscalYear, systemDay } from '../repairs/calendar'
import { frequencyLabels, reasons, type RexTask, type RexState, type RexEvent, type RexExecution, type RexPending, type Scope } from './types'
import { EstimateEditor, blankEstimate, EstimateSummary } from './RexEstimate'
import { calculateEstimate, estimateInputs, type EstimateInputs } from './estimation'
export type Save = (path: string, body: unknown, method?: string) => Promise<boolean>
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="rex-field"><span>{label}</span>{children}</label> }
export function RexModal({ title, busy, error, onClose, children }: { title: string; busy: boolean; error: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const previous = document.activeElement as HTMLElement; ref.current?.showModal(); return () => { ref.current?.close(); previous?.focus() } }, [])
  return <dialog ref={ref} className="rex-modal" aria-label={title} onCancel={(e) => { e.preventDefault(); if (!busy) onClose() }}><header><h2>{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Cerrar">×</button></header>{error && <div className="rex-error" role="alert">{error}</div>}{children}</dialog>
}
export const criticalities: Record<string, string> = { LOW: 'Baja', NORMAL: 'Normal', HIGH: 'Alta', CRITICAL: 'Crítica' }
export const eventTypes: Record<string, string> = { REX: 'REX', BO: 'BO', SCHEDULED: 'Parada programada', EXTRAORDINARY: 'Extraordinaria', OTHER: 'Otra ventana' }
export const eventStatuses: Record<string, string> = { PLANNED: 'Programado', OPEN: 'En curso', CLOSED: 'Cerrado', CANCELLED: 'Cancelado' }
const emptyTask = { code: '', line: 'Planta', areaId: '', equipmentId: null, name: '', description: '', specialty: 'MEC', impact: '', criticality: 'NORMAL', active: true, frequencyType: 'PERIODIC', intervalMonths: 24, frequencyCriteria: '', referenceOt: '', technicalPlan: '', controlData: '', justification: '', interventionTime: '', resources: {}, scope: [], documents: [] } as Omit<RexTask, 'id' | 'estimates'>
export function TaskForm({ state, task, busy, save }: { state: RexState; task?: RexTask; busy: boolean; save: Save }) {
  const savedEstimate = task?.estimates?.[0]
  const [estimate, setEstimate] = useState<EstimateInputs>(() => savedEstimate ? estimateInputs(savedEstimate) : { ...blankEstimate })
  const [estimateChanged, setEstimateChanged] = useState(false)
  const [draft, setDraft] = useState(() => {
    if (!task) return { ...emptyTask, areaId: state.areas[0]?.id || '' }
    const result = Object.fromEntries(Object.keys(emptyTask).map((key) => [key, task[key as keyof RexTask]])) as Omit<RexTask, 'id'>
    return { ...result, scope: task.scope.map(({ id, description, quantity, unit, required, notes }) => ({ id, description, quantity: Number(quantity), unit, required, notes })), documents: task.documents.map(({ name, path, type, notes }) => ({ name, path, type, notes })) }
  })
  const field = (key: keyof typeof draft, value: unknown) => setDraft((d) => ({ ...d, [key]: value }))
  const scopeField = (index: number, patch: Partial<Scope>) => field('scope', draft.scope.map((s, i) => i === index ? { ...s, ...patch } : s))
  const move = (index: number, delta: number) => { const next = [...draft.scope]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; field('scope', next) }
  return <form onSubmit={(e) => { e.preventDefault(); void save(task ? `/tasks/${task.id}` : '/tasks', { ...draft, ...(estimateChanged ? { estimate } : {}) }, task ? 'PUT' : 'POST') }}><fieldset disabled={busy}>
    {!state.areas.length && <p className="rex-error">No hay áreas en el catálogo compartido. Configuralas primero en Repuestos.</p>}
    <div className="rex-form-grid">
      <Field label="Nombre de tarea"><input required maxLength={500} value={draft.name} onChange={(e) => field('name', e.target.value)} /></Field>
      <Field label="Área"><select required value={draft.areaId} onChange={(e) => { field('areaId', e.target.value); field('equipmentId', null) }}>{state.areas.map((a) => <option key={a.id} value={a.id}>{a.code}</option>)}</select></Field>
      <Field label="Equipo (opcional)"><select value={draft.equipmentId || ''} onChange={(e) => field('equipmentId', e.target.value || null)}><option value="">Sin equipo vinculado</option>{state.equipment.filter((e) => e.area === draft.areaId).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
      <Field label="Especialidad"><select value={draft.specialty} onChange={(e) => field('specialty', e.target.value)}>{['MEC', 'ELE', 'LUB', 'MEC/ELE'].map((v) => <option key={v}>{v}</option>)}</select></Field>
      <Field label="Criticidad"><select value={draft.criticality} onChange={(e) => field('criticality', e.target.value)}>{Object.entries(criticalities).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      <Field label="Impacto"><input value={draft.impact} onChange={(e) => field('impact', e.target.value)} /></Field>
      <Field label="Descripción"><textarea value={draft.description} onChange={(e) => field('description', e.target.value)} /></Field>
      <Field label="Tipo de frecuencia"><select value={draft.frequencyType} onChange={(e) => field('frequencyType', e.target.value)}>{Object.entries(frequencyLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      {draft.frequencyType === 'PERIODIC' && <Field label="Intervalo en meses"><input type="number" required min={1} max={1200} value={draft.intervalMonths || ''} onChange={(e) => field('intervalMonths', Number(e.target.value))} /></Field>}
      <Field label="Criterio técnico"><input placeholder="24 meses o 480 KTN" value={draft.frequencyCriteria} onChange={(e) => field('frequencyCriteria', e.target.value)} /></Field>
      <label className="rex-check"><input type="checkbox" checked={draft.active} onChange={(e) => field('active', e.target.checked)} />Tarea activa</label>
    </div>
    <h3>Alcance estándar</h3><p className="rex-muted">Cada intervención conserva una copia del alcance. Sin actividades, se registra una actividad única.</p>
    <div className="rex-table-scroll"><table><thead><tr><th>#</th><th>Actividad</th><th>Cantidad</th><th>Unidad</th><th>Obligatoria</th><th>Orden / quitar</th></tr></thead><tbody>{draft.scope.map((s, i) => <tr key={i}><td>{i + 1}</td><td><input aria-label={`Actividad ${i + 1}`} required value={s.description} onChange={(e) => scopeField(i, { description: e.target.value })} /></td><td><input aria-label={`Cantidad ${i + 1}`} type="number" required min="0.001" step="0.001" max="9999999" value={s.quantity} onChange={(e) => scopeField(i, { quantity: Number(e.target.value) })} /></td><td><input aria-label={`Unidad ${i + 1}`} required value={s.unit} onChange={(e) => scopeField(i, { unit: e.target.value })} /></td><td><input aria-label={`Obligatoria ${i + 1}`} type="checkbox" checked={s.required} onChange={(e) => scopeField(i, { required: e.target.checked })} /></td><td className="rex-actions"><button type="button" disabled={i === 0} aria-label={`Subir actividad ${i + 1}`} onClick={() => move(i, -1)}>↑</button><button type="button" disabled={i === draft.scope.length - 1} aria-label={`Bajar actividad ${i + 1}`} onClick={() => move(i, 1)}>↓</button><button type="button" aria-label={`Quitar actividad ${i + 1}`} onClick={() => field('scope', draft.scope.filter((_, n) => n !== i))}>×</button></td></tr>)}</tbody></table></div>
    <button type="button" onClick={() => field('scope', [...draft.scope, { description: '', quantity: 1, unit: 'unidad', required: true, notes: '' }])}>+ Agregar actividad</button>
    <details><summary>Datos técnicos y documentación</summary><div className="rex-form-grid">{([['code', 'Código'], ['line', 'Línea'], ['referenceOt', 'OT de referencia'], ['technicalPlan', 'Plan asociado'], ['controlData', 'Datos de control'], ['justification', 'Justificación']] as const).map(([key, label]) => <Field key={key} label={label}><textarea value={draft[key]} onChange={(e) => field(key, e.target.value)} /></Field>)}</div>{draft.documents.map((d, i) => <div className="rex-form-grid" key={i}><Field label={`Documento ${i + 1}`}><input required value={d.name} onChange={(e) => field('documents', draft.documents.map((v, n) => n === i ? { ...v, name: e.target.value } : v))} /></Field><Field label="URL o ruta"><input required value={d.path} onChange={(e) => field('documents', draft.documents.map((v, n) => n === i ? { ...v, path: e.target.value } : v))} /></Field><button type="button" onClick={() => field('documents', draft.documents.filter((_, n) => n !== i))}>Quitar documento</button></div>)}<button type="button" onClick={() => field('documents', [...draft.documents, { name: '', path: '', type: '', notes: '' }])}>+ Referencia documental</button></details>
    <EstimateEditor value={estimate} config={state.config} saved={savedEstimate} changed={estimateChanged} onChange={(next) => { setEstimate(next); setEstimateChanged(true) }} onReestimate={() => setEstimateChanged(true)} legacy={draft.resources} />
    </fieldset><footer><BusyButton type="submit" className="primary" busy={busy} disabled={!state.areas.length}>Guardar tarea</BusyButton></footer></form>
}
export function EventForm({ event, busy, save }: { event?: RexEvent; busy: boolean; save: Save }) {
  const [draft, set] = useState(() => ({ name: event?.name || '', type: event?.type || 'REX', startDate: event?.startDate?.slice(0, 10) || '', endDate: event?.endDate?.slice(0, 10) || '', exercise: event?.exercise ?? null, status: event?.status || 'PLANNED', notes: event?.notes || '' }))
  return <form onSubmit={(e) => { e.preventDefault(); void save(event ? `/events/${event.id}` : '/events', draft, event ? 'PUT' : 'POST') }}><fieldset disabled={busy}><div className="rex-form-grid">
    <Field label="Nombre del evento"><input required value={draft.name} onChange={(e) => set({ ...draft, name: e.target.value })} /></Field>
    <Field label="Tipo"><select value={draft.type} onChange={(e) => set({ ...draft, type: e.target.value })}>{Object.entries(eventTypes).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
    <Field label="Fecha inicio (opcional)"><RepairDatePicker label="Fecha inicio" value={draft.startDate} onChange={(v) => set({ ...draft, startDate: v, exercise: v ? fiscalYear(v) : draft.exercise })} /></Field>
    <Field label="Fecha fin (opcional)"><RepairDatePicker label="Fecha fin" value={draft.endDate} onChange={(v) => set({ ...draft, endDate: v })} /></Field>
    <Field label="Ejercicio (año de inicio, opcional)"><input type="number" min={1900} max={9998} placeholder="2026 → 2026/27" value={draft.exercise ?? ''} onChange={(e) => set({ ...draft, exercise: e.target.value ? Number(e.target.value) : null })} /></Field>
    <Field label="Estado"><select value={draft.status} onChange={(e) => set({ ...draft, status: e.target.value })}>{Object.entries(eventStatuses).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
    <Field label="Observaciones"><textarea value={draft.notes} onChange={(e) => set({ ...draft, notes: e.target.value })} /></Field>
    </div><p className="rex-muted">No es necesario inventar fechas. Cerrar el evento no elimina los pendientes.</p></fieldset><footer><BusyButton type="submit" className="primary" busy={busy}>Guardar evento</BusyButton></footer></form>
}
function EventSelect({ state, value, onChange }: { state: RexState; value: string; onChange: (value: string) => void }) { return <Field label="Evento (opcional)"><select value={value} onChange={(e) => onChange(e.target.value)}><option value="">Fuera de una parada</option>{state.events.map((v) => <option key={v.id} value={v.id}>{v.name} · {eventStatuses[v.status]}</option>)}</select></Field> }
export function InterventionForm({ state, task, execution, busy, save }: { state: RexState; task: RexTask; execution?: RexExecution; busy: boolean; save: Save }) {
  let estimate = execution?.taskSnapshot.estimate
  let estimateError = ''
  if (!execution && task.estimates?.[0]) { try { estimate = calculateEstimate(estimateInputs(task.estimates[0]), state.config) } catch (e) { estimateError = (e as Error).message } }
  const scope = execution?.items || (task.scope.length ? task.scope : [{ id: 'single', description: task.name, quantity: 1, unit: 'actividad', required: true, notes: '' }])
  const [mode, setMode] = useState<'PLAN' | 'RESULT'>('RESULT')
  const [draft, set] = useState({ eventId: execution?.eventId || '', performedAt: '', startedAt: '', ot: execution?.ot || '', notes: execution?.notes || '', responsibleId: execution?.responsibleId || '' })
  const [items, setItems] = useState(scope.map((s) => ({ id: s.id!, completed: 0, reason: '', notes: '' })))
  const patch = (index: number, data: Partial<typeof items[number]>) => setItems((old) => old.map((v, n) => n === index ? { ...v, ...data } : v))
  return <form onSubmit={(e) => { e.preventDefault(); void save(execution ? `/executions/${execution.id}/finalize` : '/executions', { ...draft, ...(execution ? {} : { taskId: task.id, mode }), items: mode === 'PLAN' ? [] : items }) }}><fieldset disabled={busy}>
    <p><strong>{task.name}</strong> · El resultado se calcula según el alcance realizado.</p>
    {estimate && <details><summary>Estimación de esta intervención · {estimate.currency} {estimate.total}</summary><p className="rex-muted">{execution ? 'Se conserva la estimación guardada al planificar, sin aplicar tarifas nuevas.' : 'Utiliza los recursos de la tarea y la configuración vigente. Al guardar queda congelada, aunque la intervención sea parcial; no representa un costo real facturado.'}</p><EstimateSummary value={estimate} /></details>}
    {estimateError && <p className="rex-error">{estimateError}</p>}
    <div className="rex-form-grid">{!execution && <Field label="Operación"><select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="RESULT">Registrar resultado</option><option value="PLAN">Planificar intervención</option></select></Field>}
      <EventSelect state={state} value={draft.eventId} onChange={(eventId) => set({ ...draft, eventId })} />
      {mode === 'RESULT' && <Field label="Fecha real (opcional)"><RepairDatePicker value={draft.performedAt} max={systemDay()} label="Fecha real" onChange={(performedAt) => set({ ...draft, performedAt })} /></Field>}
      <Field label="OT (opcional)"><input value={draft.ot} onChange={(e) => set({ ...draft, ot: e.target.value })} /></Field>
      <Field label="Responsable (opcional)"><select value={draft.responsibleId} onChange={(e) => set({ ...draft, responsibleId: e.target.value })}><option value="">Sin responsable registrado</option>{state.responsibles.filter((r) => r.active).map((r) => <option value={r.id} key={r.id}>{r.name}</option>)}</select></Field>
      <Field label="Observaciones"><textarea value={draft.notes} onChange={(e) => set({ ...draft, notes: e.target.value })} /></Field>
    </div><h3>{execution ? 'Alcance planificado (snapshot histórico)' : 'Alcance de la intervención'}</h3>
    {scope.map((s, i) => <section className="rex-scope-result" key={s.id}><div className="rex-actions"><strong>{s.description}</strong><span>Previsto: {Number(s.quantity)} {s.unit}{s.required ? ' · Obligatoria' : ' · Opcional'}</span></div>{mode === 'RESULT' && <div className="rex-form-grid"><Field label={`Realizado · ${s.description}`}><input type="number" min={0} max={Number(s.quantity)} step="0.001" required value={items[i].completed} onChange={(e) => patch(i, { completed: Number(e.target.value) })} /></Field><label className="rex-check"><input type="checkbox" checked={items[i].completed === Number(s.quantity)} onChange={(e) => patch(i, { completed: e.target.checked ? Number(s.quantity) : 0 })} />{s.description} realizada</label>{items[i].completed < Number(s.quantity) && <><Field label={`Motivo · ${s.description}`}><select required={s.required} value={items[i].reason} onChange={(e) => patch(i, { reason: e.target.value })}><option value="">Elegir motivo</option>{reasons.map((r) => <option key={r}>{r}</option>)}</select></Field><Field label={`Observaciones · ${s.description}`}><input value={items[i].notes} onChange={(e) => patch(i, { notes: e.target.value })} /></Field></>}</div>}</section>)}
    <p className="rex-muted">{mode === 'PLAN' ? 'Se guarda el alcance sin generar pendientes todavía. Podrás registrar el resultado desde el historial.' : 'El resultado queda en el historial. Las cantidades pendientes se conservan hasta registrar su resolución.'}</p></fieldset><footer><BusyButton type="submit" className="primary" busy={busy}>{mode === 'PLAN' ? 'Guardar planificación' : 'Confirmar intervención'}</BusyButton></footer></form>
}
export function ResolutionForm({ state, pending, busy, save }: { state: RexState; pending: RexPending; busy: boolean; save: Save }) {
  const [draft, set] = useState({ eventId: '', performedAt: '', quantity: Number(pending.remaining), ot: '', notes: '' })
  return <form onSubmit={(e) => { e.preventDefault(); void save(`/pending/${pending.id}/resolutions`, draft) }}><fieldset disabled={busy}><p><strong>{pending.component}</strong> · Cantidad pendiente: {pending.remaining} {pending.unit}</p><p className="rex-muted">Se registra una nueva intervención. El resultado original y la frecuencia del conjunto no cambian.</p><div className="rex-form-grid">
    <Field label="Fecha de resolución"><RepairDatePicker required label="Fecha de resolución" value={draft.performedAt} max={systemDay()} min={pending.originDate?.slice(0, 10)} onChange={(performedAt) => set({ ...draft, performedAt })} /></Field>
    <EventSelect state={state} value={draft.eventId} onChange={(eventId) => set({ ...draft, eventId })} />
    <Field label="Cantidad resuelta"><input type="number" required min="0.001" max={Number(pending.remaining)} step="0.001" value={draft.quantity} onChange={(e) => set({ ...draft, quantity: Number(e.target.value) })} /></Field>
    <Field label="OT"><input value={draft.ot} onChange={(e) => set({ ...draft, ot: e.target.value })} /></Field>
    <Field label="Trabajo realizado / observaciones"><textarea required placeholder="Cilindro hidráulico reemplazado" value={draft.notes} onChange={(e) => set({ ...draft, notes: e.target.value })} /></Field>
    </div></fieldset><footer><BusyButton type="submit" busy={busy} disabled={!draft.performedAt} className="primary">Confirmar resolución</BusyButton></footer></form>
}

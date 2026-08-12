import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { IndustrialAsset } from '../../types/plant'
import { getEquipmentForAsset, getEquipmentSummary, getEventsForSubassembly, getPlanForSubassembly, getSubassembliesForEquipment, getSubassemblyState } from '../domain/maintenanceSelectors'
import type { MaintenanceEventType, MaintenanceIntervalUnit, Subassembly } from '../domain/maintenanceTypes'
import { useMaintenanceStore } from '../store/maintenanceStore'

const statusLabels = { OK: 'OK', WARNING: 'Aviso', CRITICAL: 'Critico', OVERDUE: 'Vencido', NO_PLAN: 'Sin plan', NO_HISTORY: 'Sin historial', INACTIVE: 'Inactivo' }
const eventLabels: Record<MaintenanceEventType, string> = { INSPECTION: 'Inspeccion', LUBRICATION: 'Lubricacion', ADJUSTMENT: 'Ajuste', REPAIR: 'Reparacion', REPLACEMENT: 'Reemplazo', OVERHAUL: 'Reacondicionamiento', FAILURE: 'Falla', NOTE: 'Nota' }

export function MaintenancePanel({ asset, timelineOnly = false }: { asset: IndustrialAsset; timelineOnly?: boolean }) {
  const store = useMaintenanceStore()
  const [creating, setCreating] = useState(false)
  const [timelineFilter, setTimelineFilter] = useState<'ALL' | 'REPLACEMENT' | 'CORRECTIVE' | 'PREVENTIVE' | 'INSPECTION'>('ALL')
  useEffect(() => { store.ensureEquipment(asset) }, [asset.id])
  const equipment = getEquipmentForAsset(store, asset.id)
  const subassemblies = equipment ? getSubassembliesForEquipment(store, equipment.id) : []
  const summary = equipment ? getEquipmentSummary(store, equipment.id, store.referenceDate) : null
  const timeline = useMemo(() => subassemblies.flatMap((subassembly) => getEventsForSubassembly(store, subassembly.id).map((event) => ({ event, subassembly }))).sort((a, b) => b.event.date.localeCompare(a.event.date) || b.event.createdAt.localeCompare(a.event.createdAt)), [store.events, subassemblies.map((item) => item.id).join('|')])

  const filteredTimeline = timeline.filter(({ event }) => timelineFilter === 'ALL' || event.type === timelineFilter || (timelineFilter === 'CORRECTIVE' && (event.type === 'FAILURE' || event.type === 'REPAIR')) || (timelineFilter === 'PREVENTIVE' && ['LUBRICATION', 'ADJUSTMENT', 'OVERHAUL'].includes(event.type)))
  if (timelineOnly) return <><div className="maintenance-timeline-filters">{(['ALL', 'REPLACEMENT', 'CORRECTIVE', 'PREVENTIVE', 'INSPECTION'] as const).map((filter) => <button key={filter} className={timelineFilter === filter ? 'active' : ''} onClick={() => setTimelineFilter(filter)}>{filter}</button>)}</div><TimelineList timeline={filteredTimeline} /></>
  if (!equipment) return <p className="maintenance-empty">Preparando equipo...</p>
  return <>
    <section className="maintenance-summary">
      <div><small>Estado del equipo</small><strong className={`maintenance-chip status-${summary?.status}`}>{summary ? statusLabels[summary.status] : 'Sin datos'}</strong></div>
      <div><small>Atencion</small><strong>{summary?.attentionScore ?? 0}/100</strong></div>
      <div><small>Proximo vencimiento</small><strong>{summary?.nearestDueDate ?? '-'}</strong></div>
    </section>
    <div className="maintenance-section-title"><strong>Subconjuntos</strong><button onClick={() => setCreating(true)}>+ Agregar</button></div>
    {subassemblies.length === 0 ? <div className="maintenance-empty"><strong>Sin subconjuntos</strong><p>Crea el primer componente mantenible de este equipo.</p><button onClick={() => setCreating(true)}>Crear subconjunto</button></div> : <div className="maintenance-table">
      <div className="maintenance-table-head"><span>Subconjunto</span><span>Estado</span><span>Ultimo</span><span>Proximo</span><span>Dias</span></div>
      {subassemblies.map((item) => {
        const state = getSubassemblyState(store, item.id, store.referenceDate)
        return <button key={item.id} className="maintenance-row" onClick={() => store.openSubassembly(item.id)}><span><strong>{item.name}</strong><small>{item.sapId || item.id}</small></span><span className={`maintenance-chip status-${state?.status}`}>{state ? statusLabels[state.status] : '-'}</span><span>{state?.lastEventDate ?? '-'}</span><span>{state?.nextDueDate ?? '-'}</span><span>{state?.daysRemaining ?? '-'}</span></button>
      })}
    </div>}
    {creating && <SubassemblyForm equipmentId={equipment.id} onClose={() => setCreating(false)} />}
    {store.drawerOpen && store.selectedSubassemblyId && <SubassemblyDrawer id={store.selectedSubassemblyId} />}
  </>
}

function SubassemblyForm({ equipmentId, onClose, existing }: { equipmentId: string; onClose: () => void; existing?: Subassembly }) {
  const save = useMaintenanceStore((state) => state.saveSubassembly)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    save({ id: existing?.id ?? `SUB_${crypto.randomUUID()}`, equipmentId, name: String(data.get('name') || 'Subconjunto'), description: String(data.get('description') || ''), sapId: String(data.get('sapId') || ''), active: data.get('active') === 'on', criticality: String(data.get('criticality') || '') as Subassembly['criticality'], createdAt: existing?.createdAt, source: existing?.source })
    onClose()
  }
  return <Modal title={existing ? 'Editar subconjunto' : 'Nuevo subconjunto'} onClose={onClose}><form className="maintenance-form" onSubmit={submit}><label>Nombre<input name="name" required defaultValue={existing?.name} /></label><label>ID SAP<input name="sapId" defaultValue={existing?.sapId} /></label><label>Criticidad<select name="criticality" defaultValue={existing?.criticality}><option value="">-</option><option>A</option><option>B</option><option>C</option><option>D</option></select></label><label>Descripcion<textarea name="description" defaultValue={existing?.description} /></label><label className="field-check"><input name="active" type="checkbox" defaultChecked={existing?.active ?? true} /> Activo</label><div className="inspector-actions"><button type="button" onClick={onClose}>Cancelar</button><button type="submit">Guardar</button></div></form></Modal>
}

function SubassemblyDrawer({ id }: { id: string }) {
  const store = useMaintenanceStore(); const item = store.subassemblies.find((entry) => entry.id === id)
  const [mode, setMode] = useState<'NONE' | 'EDIT' | 'PLAN' | 'EVENT' | 'REPLACEMENT'>('NONE')
  if (!item) return null
  const plan = getPlanForSubassembly(store, id); const state = getSubassemblyState(store, id, store.referenceDate); const events = getEventsForSubassembly(store, id)
  return <div className="maintenance-drawer"><div className="maintenance-drawer-header"><div><small>{item.sapId || item.id}</small><h3>{item.name}</h3></div><button aria-label="Cerrar" onClick={store.closeDrawer}>×</button></div><div className="maintenance-drawer-body">
    <span className={`maintenance-chip status-${state?.status}`}>{state ? statusLabels[state.status] : '-'}</span><p>{item.description || 'Sin descripcion.'}</p>
    <div className="inspector-actions"><button onClick={() => setMode('REPLACEMENT')}>Registrar recambio</button><button onClick={() => setMode('EVENT')}>Registrar intervencion</button><button onClick={() => setMode('PLAN')}>{plan ? 'Editar plan' : 'Crear plan'}</button><button onClick={() => setMode('EDIT')}>Editar subconjunto</button></div>
    <section className="maintenance-plan-card"><strong>{plan?.name ?? 'Sin plan activo'}</strong>{plan && <><span>Cada {plan.intervalValue} {unitLabel(plan.intervalUnit)}</span><span>Aviso {plan.warningDays} d / Critico {plan.criticalDays} d</span><span>Proximo: {state?.nextDueDate ?? '-'}</span></>}</section>
    <h4>Historial</h4><TimelineList timeline={events.map((event) => ({ event, subassembly: item }))} />
  </div>
  {mode === 'EDIT' && <SubassemblyForm equipmentId={item.equipmentId} existing={item} onClose={() => setMode('NONE')} />}
  {mode === 'PLAN' && <PlanForm subassemblyId={id} onClose={() => setMode('NONE')} />}
  {(mode === 'EVENT' || mode === 'REPLACEMENT') && <EventForm subassemblyId={id} defaultType={mode === 'REPLACEMENT' ? 'REPLACEMENT' : 'INSPECTION'} onClose={() => setMode('NONE')} />}</div>
}

function PlanForm({ subassemblyId, onClose }: { subassemblyId: string; onClose: () => void }) {
  const store = useMaintenanceStore(); const existing = getPlanForSubassembly(store, subassemblyId)
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); store.savePlan({ id: existing?.id ?? `PLAN_${crypto.randomUUID()}`, subassemblyId, name: String(data.get('name') || 'Plan preventivo'), intervalValue: Number(data.get('intervalValue')), intervalUnit: data.get('intervalUnit') as MaintenanceIntervalUnit, warningDays: Number(data.get('warningDays')), criticalDays: Number(data.get('criticalDays')), active: data.get('active') === 'on', createdAt: existing?.createdAt, source: existing?.source }); onClose() }
  return <Modal title="Plan de mantenimiento" onClose={onClose}><form className="maintenance-form" onSubmit={submit}><label>Nombre<input name="name" required defaultValue={existing?.name ?? 'Plan preventivo'} /></label><div className="two-columns"><label>Intervalo<input name="intervalValue" type="number" min="1" required defaultValue={existing?.intervalValue ?? 6} /></label><label>Unidad<select name="intervalUnit" defaultValue={existing?.intervalUnit ?? 'MONTHS'}><option value="DAYS">Dias</option><option value="WEEKS">Semanas</option><option value="MONTHS">Meses</option><option value="YEARS">Años</option></select></label></div><div className="two-columns"><label>Aviso (dias)<input name="warningDays" type="number" min="0" defaultValue={existing?.warningDays ?? 30} /></label><label>Critico (dias)<input name="criticalDays" type="number" min="0" defaultValue={existing?.criticalDays ?? 7} /></label></div><label className="field-check"><input name="active" type="checkbox" defaultChecked={existing?.active ?? true} /> Activo</label><button type="submit">Guardar plan</button></form></Modal>
}

function EventForm({ subassemblyId, defaultType, onClose }: { subassemblyId: string; defaultType: MaintenanceEventType; onClose: () => void }) {
  const store = useMaintenanceStore(); const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); store.appendEvent({ subassemblyId, type: data.get('type') as MaintenanceEventType, date: String(data.get('date')), notes: String(data.get('notes') || ''), workOrder: String(data.get('workOrder') || '') }); onClose() }
  return <Modal title={defaultType === 'REPLACEMENT' ? 'Registrar recambio' : 'Registrar intervencion'} onClose={onClose}><form className="maintenance-form" onSubmit={submit}><label>Tipo<select name="type" defaultValue={defaultType}>{Object.entries(eventLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Fecha<input name="date" type="date" required defaultValue={store.referenceDate} /></label><label>Orden de trabajo<input name="workOrder" /></label><label>Notas<textarea name="notes" /></label><button type="submit">Agregar al historial</button></form></Modal>
}

function TimelineList({ timeline }: { timeline: Array<{ event: ReturnType<typeof getEventsForSubassembly>[number]; subassembly: Subassembly }> }) { return timeline.length ? <div className="maintenance-timeline">{timeline.map(({ event, subassembly }) => <article key={event.id}><time>{event.date}</time><div><span className="maintenance-chip">{eventLabels[event.type]}</span><strong>{subassembly.name}</strong><p>{event.notes || 'Sin notas'}{event.workOrder ? ` · OT ${event.workOrder}` : ''}</p></div></article>)}</div> : <p className="maintenance-empty">No hay eventos registrados.</p> }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="maintenance-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="maintenance-modal"><div className="maintenance-drawer-header"><h3>{title}</h3><button onClick={onClose}>×</button></div>{children}</div></div> }
function unitLabel(unit: MaintenanceIntervalUnit) { return ({ DAYS: 'dias', WEEKS: 'semanas', MONTHS: 'meses', YEARS: 'años' })[unit] }

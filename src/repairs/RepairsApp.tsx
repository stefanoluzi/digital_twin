import { PlanFilterBar } from './PlanFilterBar'
import { matchesStateFilters, type StateFilter, repairSearchText } from './meetingFilters'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { BusyButton, ModuleLoading, PageTransition, RefreshStatus } from '../shared/ux/LoadingFeedback'
import { CalendarDays, ClipboardList, History, LayoutDashboard, Settings, X } from 'lucide-react'
import { useAppTheme, useAppUser } from '../shared/AppShell'
import { RepairsRepository } from './repository'
import { BLOCK_OWNERS, OWNER_LABELS, STATUS_LABELS, type BlockOwner, type RepairEvent, type RepairRequest, type RepairState } from './types'
import { blockedDays, dashboardMetrics, requestMetrics, today } from './domain'
import { RepairHistory } from './RepairHistory'
import { ExercisePlan, type RepairSeed } from './ExercisePlan'
import { RepairDatePicker, RepairMonthSelect, useRepairToday } from './RepairCalendar'
import { dateInMonth, fiscalYear, formatRepairDate, monthEnd, monthLabel } from './calendar'
import { RepairImport } from './RepairImport'
import { RepairDetail } from './RepairDetail'
import '../spares/criticalSpares.css'
import './repairs.css'

const repository = new RepairsRepository()
const views = ['Resumen', 'Plan del ejercicio', 'Reparaciones', 'Históricos', 'Configuración'] as const
type View = typeof views[number]
const icons = [LayoutDashboard, CalendarDays, ClipboardList, History, Settings]
export const formatDate = formatRepairDate
const actionLabels = { START: 'Iniciar trabajo', SENT: 'Registrar envío', BLOCK: 'Bloquear', RESOLVE: 'Resolver bloqueo', COMMIT: 'Cambiar compromiso', DELIVER: 'Registrar entrega', CANCEL: 'Cancelar unidades', COMMENT: 'Agregar comentario' }
type Action = keyof typeof actionLabels
export function Panel({ title, children, extra }: { title: string; children: ReactNode; extra?: ReactNode }) { return <section className="spares-panel"><header><h2>{title}</h2>{extra}</header>{children}</section> }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label><span>{label}</span>{children}</label> }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); if (event.key === 'Tab') {
      const nodes = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]') || [])]
      if (!nodes.length) { event.preventDefault(); return }
      if (event.shiftKey && (document.activeElement === nodes[0] || document.activeElement === ref.current)) { event.preventDefault(); nodes[nodes.length - 1]?.focus() }
      else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus() }
    } }
    ref.current?.addEventListener('keydown', key)
    const element = ref.current
    return () => { element?.removeEventListener('keydown', key); previous?.focus() }
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="form-modal repairs-modal"><header><h2>{title}</h2><button className="icon" aria-label="Cerrar" onClick={onClose}><X /></button></header><div className="modal-form-scroll">{children}</div></section></div>
}
export default function RepairsApp() {
  const realToday = useRepairToday()
  const [yearOverride, setYearOverride] = useState<number | null>(null)
  const year = yearOverride ?? fiscalYear(realToday)
  const [seed, setSeed] = useState<RepairSeed | undefined>()
  const theme = useAppTheme()
  const [state, setState] = useState<RepairState | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [actor, setActor] = useState('')
  const user = state?.users.find((item) => item.id === actor)
  useAppUser(user ? `${user.name} · ${user.role}` : undefined)
  const [view, setView] = useState<View>(() => { const value = new URLSearchParams(location.search).get('rt.view'); return views.includes(value as View) ? value as View : 'Plan del ejercicio' })
  const detailDirty = useRef(false)
  const confirmLeaveDetail = () => !detailDirty.current || confirm('Hay cambios sin guardar. ¿Deseas salir?')
  const [selected, setSelected] = useState<string | null>(null)
  const [editor, setEditor] = useState<'NEW' | 'EDIT' | 'EQUIPMENT' | 'CONFIG' | Action | null>(null)
  const [events, setEvents] = useState<RepairEvent[]>([])
  const [eventError, setEventError] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ area: '', trade: '', month: '', status: [] as StateFilter[], criticality: '', owner: '', workshop: '', gmb: '', overdue: false })

  const load = async () => { if (pending.current) return; pending.current = true; setBusy(true); setError(''); try { const next = await repository.load(); setState(next); setActor((value) => next.users.some((user) => user.id === value) ? value : next.users[0]?.id || 'local-user') } catch (e) { setError((e as Error).message) } finally { pending.current = false; setBusy(false) } }
  useEffect(() => { void load() }, [])
  useEffect(() => { const pop = () => { const value = new URLSearchParams(location.search).get('rt.view'); setView(views.includes(value as View) ? value as View : 'Plan del ejercicio') }; window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop) }, [])
  useEffect(() => { if (!selected) return; let cancelled = false; setEvents([]); setEventError(''); void repository.events(selected).then((value) => { if (!cancelled) setEvents(value) }).catch((e) => { if (!cancelled) setEventError(e.message) }); return () => { cancelled = true } }, [selected, state?.revision])
  const navigate = (next: View) => { setView(next); const url = new URL(location.href); url.searchParams.set('rt.view', next); history.pushState(null, '', url) }
  const save = async (path: string, body: unknown, method = 'POST') => {
    if (!state || pending.current) return false
    pending.current = true
    setBusy(true); setError('')
    try { const next = await repository.save(path, body, state.revision, actor, method); setState(next); setEditor(null); if (path === '/requests' && next.id && view !== 'Plan del ejercicio') setSelected(next.id); return true }
    catch (e) { setError((e as Error).message); return false } finally { pending.current = false; setBusy(false) }
  }
  const current = state?.requests.find((request) => request.id === selected)
  const filtered = state?.requests.filter((r) => {
    const m = requestMetrics(r)
    return (!query || repairSearchText(r).includes(query.trim().toLocaleLowerCase())) && (!filters.area || r.equipment.area === filters.area) && (!filters.trade || r.equipment.repairProfile?.trade === filters.trade) && (view === 'Plan del ejercicio' || !filters.month || r.targetMonth.startsWith(filters.month)) && matchesStateFilters(r, filters.status, realToday) && (!filters.criticality || r.criticality === filters.criticality) && (!filters.owner || m.blocks.some((b) => b.owner === filters.owner)) && (!filters.workshop || r.workshop === filters.workshop) && (!filters.gmb || r.responsibleId === filters.gmb) && (view === 'Plan del ejercicio' || !filters.overdue || m.overdue)
  }) || []
  const filterControls = state ? ([['area', 'Área', state.areas.map((a) => [a.id, a.code])], ['trade', 'Rubro', [...new Set(state.equipment.map((e) => e.repairProfile?.trade).filter(Boolean))].map((v) => [v!, v!])], ['status', 'Estado', [...Object.entries(STATUS_LABELS), ['OVERDUE', 'Vencida']]], ['criticality', 'Criticidad', [['NORMAL', 'Normal'], ['HIGH', 'Alta'], ['CRITICAL', 'Crítica']]], ['owner', 'Responsable bloqueo', Object.entries(OWNER_LABELS)], ['workshop', 'Taller', state.config.workshops.map((v) => [v, v])], ['gmb', 'GMB', state.responsibles.map((v) => [v.id, v.name])]] as [Exclude<keyof typeof filters, 'overdue' | 'month'>, string, string[][]][]).map(([key, label, options]) => <select key={key} aria-label={label} value={key === 'status' ? filters.status.length > 1 ? 'MULTI' : filters.status[0] || '' : filters[key]} onChange={(e) => setFilters({ ...filters, [key]: key === 'status' ? e.target.value ? [e.target.value as StateFilter] : [] : e.target.value })}><option value="">{label}: todos</option>{key === 'status' && filters.status.length > 1 && <option value="MULTI" disabled>Estado: {filters.status.map((status) => status === 'OVERDUE' ? 'Vencida' : STATUS_LABELS[status]).join(' + ')}</option>}{options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>) : []
  const clearFilters = () => { setQuery(''); setFilters({ area: '', trade: '', month: '', status: [] as StateFilter[], criticality: '', owner: '', workshop: '', gmb: '', overdue: false }) }
  const filterSearch = <input aria-label="Buscar reparación" placeholder="Buscar IDREP, equipo o descripción…" value={query} onChange={(e) => setQuery(e.target.value)} />
  const filterBar = <div className="spares-toolbar repairs-filters">{filterSearch}{filterControls}<RepairMonthSelect empty value={filters.month} onChange={(month) => setFilters({ ...filters, month })} /><label className="repairs-check"><input type="checkbox" checked={filters.overdue} onChange={(e) => setFilters({ ...filters, overdue: e.target.checked })} />Solo vencidas</label><button className="ghost" onClick={clearFilters}>Limpiar filtros</button></div>
  return <div className={`spares-app text-large theme-${theme} repairs-app`}>
    <header className="spares-header"><div className="spares-brand"><span>RT</span><h1>Reparaciones Taller</h1></div><nav aria-label="Reparaciones Taller">{views.map((name, index) => { const Icon = icons[index]; return <button key={name} className={view === name ? 'active' : ''} onClick={() => navigate(name)}><Icon />{name}</button> })}</nav></header>
    <main className="spares-main">
      {error && <div className="spares-server-error" role="alert">{error}<span> Recargá la página para volver a consultar.</span></div>}
      <RefreshStatus active={busy && !!state} label="Procesando…" />
      <PageTransition transitionKey={`${view}:${Boolean(state)}`}>
      {!state ? error ? <BusyButton busy={busy} className="ghost" onClick={() => void load()}>Reintentar conexión</BusyButton> : <ModuleLoading title="Reparaciones Taller" /> : <>
        <div className="repairs-title"><div><small>Planta · REPARACIONES TALLER</small><h2>{view}</h2></div><button className="primary" onClick={() => { setSelected(null); setSeed(undefined); setEditor('NEW') }} disabled={busy}>+ Nueva necesidad</button></div>
        {view === 'Resumen' && <RepairDashboard state={state} onOpen={setSelected} />}
        {(view === 'Reparaciones' || view === 'Plan del ejercicio') && <>
          {view === 'Reparaciones' && filterBar}
          {view === 'Reparaciones' ? <RepairsTable requests={filtered} onOpen={setSelected} /> : <ExercisePlan selectedStates={filters.status} onStatesChange={(status) => setFilters({ ...filters, status })} filters={(quick, setQuick) => <PlanFilterBar search={filterSearch} area={filterControls[0]} secondary={filterControls.slice(1)} activeCount={[filters.trade, filters.status.length, filters.criticality, filters.owner, filters.workshop, filters.gmb].filter(Boolean).length} nextMonth={quick.includes('NEXT')} onNextMonth={(active) => setQuick(active ? [...quick.filter((key) => key !== 'NEXT'), 'NEXT'] : quick.filter((key) => key !== 'NEXT'))} onClear={() => { clearFilters(); setQuick([]) }} />} state={state} requests={filtered} equipment={state.equipment.filter((e) => e.repairProfile?.active !== false && (!query || `${e.repairProfile?.idrep} ${e.name}`.toLowerCase().includes(query.trim().toLowerCase()) || filtered.some((r) => r.equipmentId === e.id)) && (!filters.area || e.area === filters.area) && (!filters.trade || e.repairProfile?.trade === filters.trade) && (!(filters.status.length || filters.criticality || filters.owner || filters.workshop || filters.gmb) || filtered.some((r) => r.equipmentId === e.id)))} year={year} today={realToday} busy={busy} onYear={(y) => setYearOverride(y === fiscalYear(realToday) ? null : y)} onSave={save} onDetail={setSelected} onDetailedNew={(value) => { setSelected(null); setSeed(value); setEditor('NEW') }} onAction={(id, action) => { setSelected(id); setEditor(action) }} onConfigure={() => navigate('Configuración')} />}
        </>}
        {view === 'Históricos' && <RepairHistory repository={repository} revision={state.revision} year={year} onYear={(y) => setYearOverride(y === fiscalYear(realToday) ? null : y)} asOf={realToday} />}
        {view === 'Configuración' && <Panel title="Importar lote revisado"><RepairImport busy={busy} onImport={(body) => save('/import', body)} /></Panel>}
        {view === 'Configuración' && <><Panel title="Equipos habilitados para taller" extra={<button className="primary" onClick={() => setEditor('EQUIPMENT')}>+ Equipo / vincular catálogo</button>}><div className="table-scroll"><table><thead><tr><th>IDREP</th><th>Equipo</th><th>Área</th><th>Sector</th><th>Rubro</th><th>Activo</th></tr></thead><tbody>{state.equipment.filter((e) => e.repairProfile).map((e) => <tr key={e.id}><td>{e.repairProfile!.idrep}</td><td>{e.name}</td><td>{e.area}</td><td>{e.repairProfile!.sector}</td><td>{e.repairProfile!.trade}</td><td>{e.repairProfile!.active ? 'Sí' : 'No'}</td></tr>)}</tbody></table></div></Panel><Panel title="Talleres y categorías de bloqueo" extra={<button className="ghost" onClick={() => setEditor('CONFIG')}>Editar configuración</button>}><p className="repairs-note">Aviso de criticidad: {state.config.warningDays} días. Talleres: {state.config.workshops.join(' · ')}.</p><div className="repairs-categories">{state.config.blockCategories.map((c, i) => <span key={i}>{OWNER_LABELS[c.owner]}: {c.name}</span>)}</div></Panel><Panel title="Importación legacy"><p className="repairs-note">Prepará el Excel con el script de revisión documentado en docs/REPARACIONES_TALLER.md. No se interpretan colores ni fechas ausentes automáticamente. La carga de datos requiere confirmar áreas, años y fechas concretas.</p></Panel></>}
      </>}
      </PageTransition>
    </main>
    {current && !editor && <Modal title={`${current.equipment.repairProfile?.idrep} · ${current.equipment.name}`} onClose={() => { if (!busy && confirmLeaveDetail()) { detailDirty.current = false; setSelected(null) } }}>
      <RepairDetail saveError={error} request={current} state={state!} events={events} eventError={eventError} busy={busy} onSave={save} onDirtyChange={(dirty) => { detailDirty.current = dirty }} onAction={(action) => { if (!busy && confirmLeaveDetail()) { detailDirty.current = false; setEditor(action) } }} />
    </Modal>}
    {editor && state && <RepairEditor key={`${editor}:${selected || seed?.month || ''}`} seed={seed} kind={editor} state={state} request={current} busy={busy} error={error} onClose={() => { if (!busy) setEditor(null) }} onSave={save} />}
  </div>
}

function RepairDashboard({ state, onOpen }: { state: RepairState; onOpen: (id: string) => void }) {
  const kpis = dashboardMetrics(state.requests, today(), state.config.warningDays)
  const attention = state.requests.filter((r) => requestMetrics(r, today(), state.config.warningDays).priority < 6).sort((a, b) => requestMetrics(a, today(), state.config.warningDays).priority - requestMetrics(b, today(), state.config.warningDays).priority)
  const own = state.requests.flatMap((r) => r.items.flatMap((item) => item.blocks.filter((b) => !b.resolvedAt && ['PLANT', 'PURCHASING', 'ENGINEERING'].includes(b.owner)).map((b) => ({ r, item, b }))))
  return <div className="repairs-stack"><div className="coverage-kpis repair-kpis">{([['REPARACIONES ACTIVAS', kpis.active], ['EN CURSO', kpis.inProgress], ['BLOQUEADAS', kpis.blocked], ['VENCIDAS', kpis.overdue], ['CRÍTICAS EN RIESGO', kpis.critical], ['PENDIENTES DE PLANTA', kpis.plant], ['ENTREGADAS ESTE MES', kpis.deliveredMonth]] as const).map(([label, value], i) => <article className="coverage-kpi" key={label}><span>{label}</span><strong>{value}</strong><small>{i === 6 ? 'unidades entregadas' : 'necesidades'}</small></article>)}</div><RepairsTable requests={attention} title="Puntos de atención" onOpen={onOpen} /><Panel title="Pendientes de nuestra parte"><div className="table-scroll"><table><thead><tr><th>Equipo / unidad</th><th>Qué falta</th><th>Responsabilidad</th><th>GMB interno</th><th>Desde</th><th>Días</th><th>Necesidad</th></tr></thead><tbody>{own.map(({ r, item, b }) => <tr key={b.id}><td><button className="ghost" onClick={() => onOpen(r.id)}>{r.equipment.repairProfile?.idrep} · #{item.ordinal}</button><small>{r.equipment.name}</small></td><td>{b.category}<small>{b.description}</small></td><td>{OWNER_LABELS[b.owner]}</td><td>{r.responsible?.name || 'No indicado'}</td><td>{formatDate(b.startedAt)}</td><td>{blockedDays(b)}</td><td>{formatDate(r.requiredDate)}</td></tr>)}</tbody></table></div>{!own.length && <p className="repairs-note">Sin pendientes abiertos de Planta, Compras o Ingeniería.</p>}</Panel></div>
}
function RepairsTable({ requests, onOpen, title = 'Reparaciones' }: { requests: RepairRequest[]; onOpen: (id: string) => void; title?: string }) { return <Panel title={title}><div className="table-scroll"><table><thead><tr>{['IDREP / Equipo', 'Área / Rubro', 'Cantidad', 'Entregados', 'Mes', 'Necesidad Planta', 'Compromiso Taller', 'Estado', 'Criticidad', 'Bloqueo / Responsable', 'Atraso', 'Actualización'].map((v) => <th key={v}>{v}</th>)}</tr></thead><tbody>{requests.map((r) => { const m = requestMetrics(r); const commitments = [...new Set(m.items.map((i) => formatDate(i.committed)))]; return <tr key={r.id}><td><button className="ghost" onClick={() => onOpen(r.id)}>{r.equipment.repairProfile?.idrep || r.equipmentId}</button><small>{r.equipment.name}</small></td><td>{r.equipment.area}<small>{r.equipment.repairProfile?.trade}</small></td><td>{r.quantity}</td><td>{m.delivered}</td><td>{monthLabel(r.targetMonth)}</td><td>{formatDate(r.requiredDate)}</td><td>{commitments.join(' · ')}{m.items.some((i) => i.commitmentMismatch) && <small className="repair-risk">Posterior a necesidad</small>}</td><td><span className={`repair-status ${m.tone}`}>{m.overdue ? 'Vencida · ' : ''}{Object.entries(m.counts).filter(([, count]) => count).map(([status, count]) => `${count} ${STATUS_LABELS[status as keyof typeof STATUS_LABELS]}`).join(' / ')}</span></td><td>{r.criticality === 'CRITICAL' ? 'Crítica' : r.criticality === 'HIGH' ? 'Alta' : 'Normal'}</td><td>{m.blocks.map((b) => `${OWNER_LABELS[b.owner]}: ${b.category}`).join(' / ') || '—'}</td><td>{m.lateDays || '—'}</td><td>{formatDate(r.updatedAt)}</td></tr> })}</tbody></table></div>{!requests.length && <p className="repairs-note">No hay reparaciones para mostrar.</p>}</Panel> }
function RepairEditor({ kind, state, request, busy, error, onClose, onSave, seed }: { seed?: RepairSeed; kind: NonNullable<'NEW' | 'EDIT' | 'EQUIPMENT' | 'CONFIG' | Action>; state: RepairState; request?: RepairRequest; busy: boolean; error: string; onClose: () => void; onSave: (path: string, body: unknown, method?: string) => Promise<boolean> }) {
  const [targetMonth, setTargetMonth] = useState(seed?.month || request?.targetMonth.slice(0, 7) || today().slice(0, 7))
  const [requiredDate, setRequiredDate] = useState(seed?.requiredDate || request?.requiredDate?.slice(0, 10) || '')
  const [criticalDate, setCriticalDate] = useState(request?.criticalDueDate?.slice(0, 10) || '')
  const [actionDate, setActionDate] = useState(today())
  const [owner, setOwner] = useState<BlockOwner>('PLANT')
  const [equipmentId, setEquipmentId] = useState('')
  const [localError, setLocalError] = useState('')
  const eq = state.equipment.find((e) => e.id === equipmentId)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLocalError('')
    const data = new FormData(event.currentTarget); const value = (name: string) => String(data.get(name) || '')
    try {
      if (kind === 'CONFIG') {
        const categories = value('categories').split('\n').filter((v) => v.trim()).map((line) => { const split = line.indexOf(':'); if (split < 0) throw new Error('Cada categoría debe tener RESPONSABLE: descripción'); return { owner: line.slice(0, split).trim(), name: line.slice(split + 1).trim() } })
        await onSave('/config', { warningDays: Number(value('warningDays')), workshops: value('workshops').split('\n').map((v) => v.trim()).filter(Boolean), blockCategories: categories }, 'PUT')
      } else if (kind === 'EQUIPMENT') await onSave('/equipment', { ...(equipmentId ? { equipmentId } : {}), idrep: value('idrep'), name: eq?.name || value('name'), area: eq?.area || value('area'), sector: value('sector'), trade: value('trade'), active: data.has('active') })
      else if (kind === 'NEW' || kind === 'EDIT') {
        if (!dateInMonth(requiredDate, targetMonth)) throw new Error('La fecha de necesidad debe pertenecer al mes objetivo')
        const draft = { targetMonth: `${targetMonth}-01`, requiredDate: requiredDate || null, criticality: value('criticality'), criticalReason: value('criticalReason'), fixedDeadline: data.has('fixedDeadline'), criticalDueDate: value('criticalDueDate'), responsibleId: value('responsibleId'), workshop: value('workshop'), notes: value('notes') }
        await onSave(kind === 'NEW' ? '/requests' : `/requests/${request!.id}`, kind === 'NEW' ? { ...draft, equipmentId: value('equipmentId'), quantity: Number(value('quantity')) } : { ...draft, reason: value('reason') }, kind === 'NEW' ? 'POST' : 'PUT')
      } else if (request) { if (kind !== 'COMMENT' && !actionDate) throw new Error('Seleccioná una fecha'); await onSave(`/requests/${request.id}/actions`, { action: kind, comment: value('comment'), ...(kind !== 'COMMENT' ? { itemIds: data.getAll('itemIds'), date: value('date') } : {}), ...(kind === 'BLOCK' ? { owner, category: value('category'), description: value('description') } : {}) }) }
    } catch (e) { setLocalError((e as Error).message) }
  }
  return <Modal title={kind === 'NEW' ? 'Nueva necesidad de reparación' : kind === 'EDIT' ? 'Editar necesidad' : kind === 'EQUIPMENT' ? 'Equipo de taller' : kind === 'CONFIG' ? 'Configuración de taller' : actionLabels[kind]} onClose={onClose}><form onSubmit={(e) => void submit(e)}>
    {(error || localError) && <p className="spares-server-error" role="alert">{localError || error}</p>}
    <fieldset disabled={busy} className="repair-form form-grid">
      {kind === 'CONFIG' ? <><Field label="Aviso crítico (días)"><input name="warningDays" type="number" min="1" max="365" defaultValue={state.config.warningDays} required /></Field><Field label="Talleres (uno por línea)"><textarea name="workshops" rows={5} defaultValue={state.config.workshops.join('\n')} required /></Field><Field label="Categorías (OWNER: nombre). OWNER: PLANT, WORKSHOP, PURCHASING, ENGINEERING, EXTERNAL, OTHER"><textarea name="categories" rows={12} defaultValue={state.config.blockCategories.map((c) => `${c.owner}: ${c.name}`).join('\n')} required /></Field></> : kind === 'EQUIPMENT' ? <>
        <Field label="Vincular equipo existente"><select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}><option value="">Crear equipo nuevo</option>{state.equipment.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.area}</option>)}</select></Field>
        <Field label="IDREP"><input key={`id-${equipmentId}`} name="idrep" defaultValue={eq?.repairProfile?.idrep || ''} required /></Field><Field label="Descripción"><input name="name" key={equipmentId} defaultValue={eq?.name || ''} readOnly={!!eq} required /></Field><Field label="Área explícita"><select key={`area-${equipmentId}`} name="area" defaultValue={eq?.area || ''} disabled={!!eq} required><option value="">Seleccionar área</option>{state.areas.map((a) => <option key={a.id} value={a.id}>{a.code}</option>)}</select></Field><Field label="Sector"><input name="sector" key={`sector-${equipmentId}`} defaultValue={eq?.repairProfile?.sector || 'Planta'} required /></Field><Field label="Rubro"><input name="trade" key={`trade-${equipmentId}`} defaultValue={eq?.repairProfile?.trade || ''} required /></Field><label className="repairs-check"><input name="active" key={`active-${equipmentId}`} type="checkbox" defaultChecked={eq?.repairProfile?.active !== false} />Activo</label>
      </> : kind === 'NEW' || kind === 'EDIT' ? <>
        {kind === 'NEW' && <><Field label="Equipo / IDREP"><select name="equipmentId" defaultValue={seed?.equipmentId || ''} required><option value="">Seleccionar equipo</option>{state.equipment.filter((e) => e.repairProfile?.active).map((e) => <option key={e.id} value={e.id}>{e.repairProfile!.idrep} · {e.name}</option>)}</select></Field><Field label="Cantidad solicitada"><input name="quantity" type="number" min="1" max="1000" defaultValue={seed?.quantity || 1} required /></Field></>}
        {seed && kind === 'NEW' ? <p>Mes objetivo: {monthLabel(targetMonth, true)}</p> : <div><span>Mes objetivo</span><RepairMonthSelect value={targetMonth} onChange={setTargetMonth} /></div>}<div><span>Fecha necesidad Planta (opcional)</span><RepairDatePicker name="requiredDate" label="Fecha necesidad Planta" value={requiredDate} onChange={setRequiredDate} initialMonth={targetMonth} min={`${targetMonth}-01`} max={monthEnd(targetMonth)} /></div><Field label="Taller"><select name="workshop" defaultValue={request?.workshop}>{state.config.workshops.map((w) => <option key={w}>{w}</option>)}</select></Field><Field label="GMB responsable (si aplica)"><select name="responsibleId" defaultValue={request?.responsibleId || ''}><option value="">No aplica</option>{state.responsibles.filter((r) => r.active || r.id === request?.responsibleId).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field><Field label="Criticidad"><select name="criticality" defaultValue={seed?.criticality || request?.criticality || 'NORMAL'}><option value="NORMAL">Normal</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select></Field><Field label="Motivo criticidad"><input name="criticalReason" list="repair-critical-reasons" defaultValue={seed?.criticalReason || request?.criticalReason || ''} /><datalist id="repair-critical-reasons">{['Sin pie de máquina', 'Fecha inamovible', 'REX / intervención programada', 'Riesgo operativo', 'Otro'].map((v) => <option key={v}>{v}</option>)}</datalist></Field><div><span>Fecha límite crítica (opcional)</span><RepairDatePicker name="criticalDueDate" label="Fecha límite crítica" value={criticalDate} onChange={setCriticalDate} initialMonth={targetMonth} /></div><label className="repairs-check"><input name="fixedDeadline" type="checkbox" defaultChecked={request?.fixedDeadline} />Fecha inamovible</label><Field label="Observaciones"><textarea name="notes" defaultValue={request?.notes || ''} /></Field>{kind === 'EDIT' && <Field label="Motivo del cambio"><input name="reason" required /></Field>}
      </> : <>
        {kind !== 'COMMENT' && <><div className="repair-unit-picker"><b>Aplicar a unidades</b>{request?.items.filter((i) => !['DELIVERED', 'CANCELLED'].includes(i.status) && (kind === 'START' ? i.status === 'PENDING' : kind === 'RESOLVE' ? i.status === 'BLOCKED' : kind === 'DELIVER' || kind === 'BLOCK' ? i.status !== 'BLOCKED' : true)).map((i) => <label className="repairs-check" key={i.id}><input type="checkbox" name="itemIds" value={i.id} defaultChecked />Unidad #{i.ordinal} · {STATUS_LABELS[i.status]}</label>)}</div><div><span>{kind === 'COMMIT' ? 'Fecha compromiso del taller' : 'Fecha real'}</span><RepairDatePicker label={kind === 'COMMIT' ? 'Fecha compromiso del taller' : 'Fecha real'} name="date" value={actionDate} onChange={setActionDate} required max={kind === 'COMMIT' ? undefined : today()} /></div></>}
        {kind === 'BLOCK' && <><Field label="Responsable del bloqueo"><select value={owner} onChange={(e) => setOwner(e.target.value as BlockOwner)}>{BLOCK_OWNERS.map((v) => <option key={v} value={v}>{OWNER_LABELS[v]}</option>)}</select></Field><Field label="Categoría"><select key={owner} name="category" required>{state.config.blockCategories.filter((c) => c.owner === owner).map((c) => <option key={c.name}>{c.name}</option>)}</select></Field><Field label="Qué falta / descripción"><textarea name="description" required /></Field></>}
        <Field label={kind === 'COMMIT' ? 'Motivo del compromiso / reprogramación' : 'Comentario / motivo'}><textarea name="comment" required={['COMMIT', 'CANCEL', 'RESOLVE', 'COMMENT', 'BLOCK'].includes(kind)} /></Field>
      </>}
    </fieldset><footer className="repairs-actions"><button className="ghost" type="button" onClick={onClose} disabled={busy}>Volver</button><BusyButton className="primary" type="submit" busy={busy}>Guardar</BusyButton></footer>
  </form></Modal>
}

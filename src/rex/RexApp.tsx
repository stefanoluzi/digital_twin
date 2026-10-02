import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAppTheme } from '../shared/AppShell'
import { BusyButton, ModuleLoading, PageTransition, RefreshStatus } from '../shared/ux/LoadingFeedback'
import { fiscalLabel, fiscalYear, formatRepairDate, systemDay } from '../repairs/calendar'
import { useRepairToday } from '../repairs/RepairCalendar'
import { RexRepository } from './repository'
import { taskMetrics, executionLabel, compareExecutions, compareTaskDueRows } from './domain'
import { cycleLabels, frequencyLabels, statusLabels, type RexState, type RexTask, type RexExecution, type RexPending } from './types'
import { TaskForm, EventForm, InterventionForm, ResolutionForm, RexModal, criticalities, eventTypes, eventStatuses } from './RexForms'
import { RexConfigForm, EstimateSummary, LegacyResources } from './RexEstimate'
import '../spares/criticalSpares.css'
import '../repairs/repairs.css'
import './rex.css'

const repository = new RexRepository()
const views = ['Resumen', 'Parque de tareas', 'Pendientes', 'Eventos'] as const
type View = typeof views[number]
type Editor = { type: 'TASK'; id?: string } | { type: 'EVENT'; id?: string } | { type: 'EXECUTION'; taskId: string; id?: string } | { type: 'RESOLUTION'; id: string } | { type: 'CONFIG'; id?: never }
const frequency = (task: RexTask) => task.frequencyType === 'PERIODIC' ? `${task.intervalMonths} meses` : frequencyLabels[task.frequencyType]
function Panel({ title, children, extra }: { title: string; children: ReactNode; extra?: ReactNode }) { return <section className="rex-panel"><header><h2>{title}</h2>{extra}</header>{children}</section> }
function Badge({ status, label }: { status: string; label?: string }) { return <span className={`rex-badge rex-${status.toLowerCase()}`}>{label || statusLabels[status] || cycleLabels[status] || status}</span> }
function originName(p: RexPending, state: RexState) { const execution = state.executions.find((e) => e.id === p.executionId); return state.events.find((e) => e.id === execution?.eventId)?.name || (p.originDate ? formatRepairDate(p.originDate) : 'Intervención sin fecha exacta') }
function PendingList({ state, items, onTask, onResolve, busy }: { state: RexState; items: RexPending[]; onTask: (id: string) => void; onResolve: (id: string) => void; busy: boolean }) {
  return items.length ? <div className="rex-table-scroll"><table><thead><tr><th>Área / tarea origen</th><th>Componente</th><th>Restante</th><th>Origen / fecha</th><th>Motivo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{items.map((p) => {
    const task = state.tasks.find((t) => t.id === p.taskId)
    const days = p.originDate ? Math.floor((Date.parse(systemDay()) - Date.parse(p.originDate.slice(0, 10))) / 86400000) : null
    return <tr key={p.id}><td><strong>{state.areas.find((a) => a.id === task?.areaId)?.code}</strong><br />{task?.name}</td><td>{p.component}</td><td>{Number(p.remaining)} {p.unit}</td><td>{originName(p, state)}<small>{p.originDate ? `${formatRepairDate(p.originDate)} · ${days} días` : 'Fecha exacta no registrada'}</small></td><td>{p.reason}<small>{p.notes}</small></td><td><Badge status={Number(p.remaining) > 0 ? 'PARTIAL' : 'COMPLETED'} label={Number(p.remaining) > 0 ? 'Abierto' : 'Resuelto'} /></td><td><div className="rex-actions"><button onClick={() => onTask(p.taskId)}>Ver tarea</button>{Number(p.remaining) > 0 && <button className="primary" disabled={busy} onClick={() => onResolve(p.id)}>Registrar resolución</button>}</div></td></tr>
  })}</tbody></table></div> : <p className="rex-empty">No hay pendientes en esta selección.</p>
}
export default function RexApp() {
  const theme = useAppTheme()
  const today = useRepairToday()
  const [state, setState] = useState<RexState | null>(null)
  const [view, setView] = useState<View>(() => { const value = new URLSearchParams(location.search).get('rex.view'); return views.includes(value as View) ? value as View : 'Resumen' })
  const [selected, setSelected] = useState<string | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const locked = useRef(false)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ area: '', specialty: '', criticality: '', status: '', pending: false })
  const [page, setPage] = useState(0)
  const [closed, setClosed] = useState(false)
  const load = async () => { if (locked.current) return; locked.current = true; setBusy(true); setError(''); try { setState(await repository.load()) } catch (e) { setError((e as Error).message) } finally { locked.current = false; setBusy(false) } }
  useEffect(() => { void load() }, [view])
  useEffect(() => { const pop = () => { const v = new URLSearchParams(location.search).get('rex.view'); setView(views.includes(v as View) ? v as View : 'Resumen'); setSelected(null) }; window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop) }, [])
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(id) }, [notice])
  const navigate = (v: View) => { setView(v); setSelected(null); setPage(0); const url = new URL(location.href); url.searchParams.set('rex.view', v); history.pushState(null, '', url) }
  const openEditor = (value: Editor) => { setError(''); setEditor(value) }
  const save = async (path: string, body: unknown, method = 'POST') => {
    if (!state || locked.current) return false
    locked.current = true; setBusy(true); setError(''); setNotice('')
    try { const next = await repository.save(path, body, state.revision, method); setState(next); setEditor(null); setNotice('Operación confirmada.'); if (path === '/tasks') setSelected(next.id); return true }
    catch (e) { setError((e as Error).message); return false }
    finally { locked.current = false; setBusy(false) }
  }
  const task = state?.tasks.find((t) => t.id === selected)
  const rows = state?.tasks.map((t) => ({ task: t, metrics: taskMetrics(t, state, today) })).filter(({ task: t, metrics: m }) => (!query || `${t.name} ${t.code} ${t.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) && (!filters.area || t.areaId === filters.area) && (!filters.specialty || t.specialty === filters.specialty) && (!filters.criticality || t.criticality === filters.criticality) && (!filters.status || m.status === filters.status || m.cycle === filters.status) && (!filters.pending || m.open.length > 0)).sort(compareTaskDueRows) || []
  const openPending = state?.pending.filter((p) => Number(p.remaining) > 0) || []
  const showTask = (id: string) => { setSelected(id); window.scrollTo(0, 0) }
  return <div className={`spares-app text-large theme-${theme} rex-app`}>
    <header className="rex-header"><div><a href="/">← Inicio</a><h1>Tareas Globales REX</h1></div><nav aria-label="Tareas Globales REX">{views.map((v) => <button key={v} aria-current={view === v && !selected ? 'page' : undefined} className={view === v && !selected ? 'active' : ''} onClick={() => navigate(v)}>{v}</button>)}</nav><button disabled={busy || !state} onClick={() => openEditor({ type: 'CONFIG' })}>Configuración REX</button></header>
    <main className="rex-main">
      {error && !editor && <div className="rex-error" role="alert">{error}</div>}
      {notice && <div className="rex-notice" role="status">{notice}</div>}
      <RefreshStatus active={busy && !!state} label={editor ? 'Guardando…' : 'Actualizando…'} />
      {!state ? error ? <BusyButton busy={busy} onClick={() => void load()}>Reintentar conexión</BusyButton> : <ModuleLoading title="Tareas Globales REX" /> : <PageTransition transitionKey={`${view}:${selected || ''}`}>
        {task ? <TaskDetail state={state} task={task} today={today} busy={busy} onBack={() => setSelected(null)} onEditor={openEditor} onTask={showTask} /> : <>
          <div className="rex-title"><div><small>{fiscalLabel(fiscalYear(today))} · JULIO–JUNIO</small><h2>{view}</h2></div><button className="primary" disabled={busy} onClick={() => openEditor(view === 'Eventos' ? { type: 'EVENT' } : { type: 'TASK' })}>{view === 'Eventos' ? '+ Nuevo evento' : '+ Nueva tarea'}</button></div>
          {view === 'Resumen' && <>
            <div className="rex-kpis">{(() => { const active = state.tasks.filter((t) => t.active).map((t) => taskMetrics(t, state, today)); return [['Tareas activas', active.length, ''], ['Pendientes abiertos', openPending.length, 'attention'], ['Tareas con ejecución parcial', active.filter((m) => m.partial).length, 'attention'], ['Vencidas', active.filter((m) => m.cycle === 'OVERDUE').length, 'danger'], ['Próximas 90 días', active.filter((m) => m.cycle === 'UPCOMING').length, ''], ['Sin fecha/historial suficiente', active.filter((m) => !m.lastComplete || (m.cycle === 'UNCERTAIN')).length, '']].map(([label, value, tone]) => <div key={label} className={`rex-kpi ${tone}`}><span>{label}</span><strong>{value}</strong></div>) })()}</div>
            <Panel title="Pendientes heredados" extra={<span className="rex-badge rex-partial">{openPending.length} abiertos</span>}><PendingList state={state} items={openPending} onTask={showTask} onResolve={(id) => openEditor({ type: 'RESOLUTION', id })} busy={busy} /></Panel>
            <Panel title="Atención al próximo ciclo"><div className="rex-cycle-list">{state.tasks.filter((t) => t.active).map((t) => ({ task: t, metrics: taskMetrics(t, state, today) })).filter(({ metrics: m }) => ['OVERDUE', 'UPCOMING'].includes(m.cycle)).sort(compareTaskDueRows).map(({ task: t, metrics: m }) => <button key={t.id} onClick={() => showTask(t.id)}><strong>{t.name}</strong><span>{formatRepairDate(m.due)}</span><Badge status={m.cycle} /></button>)}{!state.tasks.some((t) => t.active && ['OVERDUE', 'UPCOMING'].includes(taskMetrics(t, state, today).cycle)) && <p className="rex-empty">No hay vencimientos calculables próximos o vencidos. Las tareas sin fecha completa requieren revisión técnica.</p>}</div></Panel>
          </>}
          {view === 'Parque de tareas' && <>
            <div className="rex-filters"><input aria-label="Buscar tarea" placeholder="Buscar tarea, código o descripción…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0) }} />{([['area', 'Área', state.areas.map((a) => [a.id, a.code])], ['specialty', 'Especialidad', ['MEC', 'ELE', 'LUB', 'MEC/ELE'].map((s) => [s, s])], ['criticality', 'Criticidad', Object.entries(criticalities)], ['status', 'Estado', Object.entries(cycleLabels)]] as const).map(([key, label, options]) => <select key={key} aria-label={label} value={filters[key]} onChange={(e) => { setFilters({ ...filters, [key]: e.target.value }); setPage(0) }}><option value="">{label}: todas</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>)}<label className="rex-check"><input type="checkbox" checked={filters.pending} onChange={(e) => { setFilters({ ...filters, pending: e.target.checked }); setPage(0) }} />Con pendientes</label></div>
            <Panel title={`${rows.length} tareas`} extra={<span className="rex-muted">Vencidas primero · Próxima requerida ascendente · Sin fecha al final</span>}><div className="rex-table-scroll"><table><thead><tr>{['Área', 'Tarea', 'Especialidad', 'Criticidad', 'Frecuencia', 'Última completa', 'Última intervención', 'Próxima requerida', 'Estado', 'Pendientes'].map((l) => <th key={l}>{l}</th>)}</tr></thead><tbody>{rows.slice(page * 25, (page + 1) * 25).map(({ task: t, metrics: m }) => <tr key={t.id} onClick={() => showTask(t.id)} className="rex-clickable"><td>{state.areas.find((a) => a.id === t.areaId)?.code}</td><td><button className="rex-link" onClick={(e) => { e.stopPropagation(); showTask(t.id) }}>{t.name}</button>{!t.active && <small>Inactiva</small>}</td><td>{t.specialty}</td><td>{criticalities[t.criticality]}</td><td>{frequency(t)}</td><td>{executionLabel(m.lastComplete, state)}</td><td>{executionLabel(m.lastIntervention, state)}</td><td>{formatRepairDate(m.due)}</td><td><Badge status={m.status} />{m.status !== m.cycle && ['OVERDUE', 'UPCOMING'].includes(m.cycle) && <Badge status={m.cycle} />}</td><td>{m.open.length}</td></tr>)}</tbody></table>{!rows.length && <p className="rex-empty">No hay tareas para esta selección. Creá la primera tarea para comenzar.</p>}</div><div className="rex-pagination"><button disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page + 1} de {Math.max(1, Math.ceil(rows.length / 25))}</span><button disabled={(page + 1) * 25 >= rows.length} onClick={() => setPage(page + 1)}>Siguiente</button></div></Panel>
          </>}
          {view === 'Pendientes' && <Panel title={closed ? 'Pendientes y resoluciones' : 'Pendientes abiertos'} extra={<label className="rex-check"><input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} />Incluir resueltos</label>}><PendingList state={state} items={closed ? state.pending : openPending} onTask={showTask} onResolve={(id) => openEditor({ type: 'RESOLUTION', id })} busy={busy} /></Panel>}
          {view === 'Eventos' && <Panel title="Ventanas de mantenimiento"><div className="rex-table-scroll"><table><thead><tr><th>Evento</th><th>Tipo</th><th>Inicio</th><th>Fin</th><th>Ejercicio</th><th>Estado</th><th>Intervenciones</th><th /></tr></thead><tbody>{state.events.map((event) => <tr key={event.id}><td><strong>{event.name}</strong></td><td>{eventTypes[event.type]}</td><td>{formatRepairDate(event.startDate)}</td><td>{formatRepairDate(event.endDate)}</td><td>{event.exercise ? fiscalLabel(event.exercise) : 'Sin confirmar'}</td><td>{eventStatuses[event.status]}</td><td>{state.executions.filter((e) => e.eventId === event.id).length}</td><td><button disabled={busy} onClick={() => openEditor({ type: 'EVENT', id: event.id })}>Editar evento</button></td></tr>)}</tbody></table>{!state.events.length && <p className="rex-empty">Todavía no hay eventos. Podés crear uno sin fechas exactas.</p>}</div></Panel>}
        </>}
      </PageTransition>}
    </main>
    {editor && state && <RexModal title={{ CONFIG: 'Configuración REX', TASK: editor.id ? 'Editar tarea' : 'Nueva tarea', EVENT: editor.id ? 'Editar evento' : 'Nuevo evento', EXECUTION: editor.id ? 'Registrar resultado planificado' : 'Registrar intervención', RESOLUTION: 'Registrar resolución' }[editor.type]} busy={busy} error={error} onClose={() => { if (!busy) { setEditor(null); setError('') } }}>
      {editor.type === 'CONFIG' && <RexConfigForm config={state.config} busy={busy} save={save} />}
      {editor.type === 'TASK' && <TaskForm state={state} task={state.tasks.find((t) => t.id === editor.id)} busy={busy} save={save} />}
      {editor.type === 'EVENT' && <EventForm event={state.events.find((e) => e.id === editor.id)} busy={busy} save={save} />}
      {editor.type === 'EXECUTION' && <InterventionForm state={state} task={state.tasks.find((t) => t.id === editor.taskId)!} execution={state.executions.find((e) => e.id === editor.id)} busy={busy} save={save} />}
      {editor.type === 'RESOLUTION' && <ResolutionForm state={state} pending={state.pending.find((p) => p.id === editor.id)!} busy={busy} save={save} />}
    </RexModal>}
  </div>
}
function TaskDetail({ state, task, today, busy, onBack, onEditor, onTask }: { state: RexState; task: RexTask; today: string; busy: boolean; onBack: () => void; onEditor: (editor: Editor) => void; onTask: (id: string) => void }) {
  const m = taskMetrics(task, state, today)
  const historyItems = state.executions.filter((e) => e.taskId === task.id).sort((a, b) => compareExecutions(a, b, state))
  return <><button onClick={onBack}>← Volver</button><div className="rex-title"><div><small>{state.areas.find((a) => a.id === task.areaId)?.code} · {task.specialty} · {criticalities[task.criticality]}</small><h2>{task.name}</h2><Badge status={m.status} />{m.status !== m.cycle && <Badge status={m.cycle} />}{!task.active && <span> · Inactiva</span>}</div><div className="rex-actions"><button disabled={busy} onClick={() => onEditor({ type: 'TASK', id: task.id })}>Editar tarea</button><button className="primary" disabled={busy || !task.active} onClick={() => onEditor({ type: 'EXECUTION', taskId: task.id })}>+ Registrar intervención</button></div></div>
    <div className="rex-kpis">{[['Última ejecución completa', executionLabel(m.lastComplete, state)], ['Última intervención', executionLabel(m.lastIntervention, state)], ['Próxima requerida', formatRepairDate(m.due)], ['Frecuencia', frequency(task)], ['Pendientes abiertos', m.open.length]].map(([label, value]) => <div className="rex-kpi" key={label}><span>{label}</span><b>{value}</b></div>)}</div>
    <Panel title="Alcance estándar"><p>{task.description}</p><p className="rex-muted">{task.frequencyCriteria}</p><div className="rex-table-scroll"><table><thead><tr><th>Actividad</th><th>Cantidad</th><th>Unidad</th><th>Obligatoria</th></tr></thead><tbody>{(task.scope.length ? task.scope : [{ description: task.name, quantity: 1, unit: 'actividad', required: true }]).map((s, i) => <tr key={i}><td>{s.description}</td><td>{Number(s.quantity)}</td><td>{s.unit}</td><td>{s.required ? 'Sí' : 'No'}</td></tr>)}</tbody></table></div></Panel>
    <Panel title="Pendientes abiertos"><PendingList state={state} items={m.open} onTask={onTask} onResolve={(id) => onEditor({ type: 'RESOLUTION', id })} busy={busy} /></Panel>
    <Panel title="Historial de intervenciones"><div className="rex-timeline">{historyItems.map((execution) => <ExecutionCard key={execution.id} execution={execution} state={state} busy={busy} onEditor={onEditor} />)}{!historyItems.length && <p className="rex-empty">Sin intervenciones registradas.</p>}</div></Panel>
    <Panel title="Información técnica"><div className="rex-info">{[['Impacto', task.impact], ['Equipo', state.equipment.find((e) => e.id === task.equipmentId)?.name], ['OT referencia', task.referenceOt], ['Plan asociado', task.technicalPlan], ['Datos de control', task.controlData], ['Justificación', task.justification], ['Tiempo estimado', task.interventionTime]].map(([label, value]) => <div key={label}><strong>{label}</strong><p>{value || '—'}</p></div>)}</div>{task.documents.map((d, i) => <p key={i}><strong>{d.name}</strong>: {/^(https?):\/\//i.test(d.path) ? <a target="_blank" rel="noreferrer" href={d.path}>{d.path}</a> : <code>{d.path}</code>}</p>)}<details><summary>Recursos y costos</summary>{task.estimates?.[0] ? <><p className="rex-muted">Estimación guardada; no cambia al modificar Configuración REX.</p><EstimateSummary value={task.estimates[0]} /></> : <p>Sin estimación estructurada. Podés crearla desde Editar tarea.</p>}<LegacyResources values={task.resources} /></details></Panel>
  </>
}
function ExecutionCard({ execution: e, state, busy, onEditor }: { execution: RexExecution; state: RexState; busy: boolean; onEditor: (editor: Editor) => void }) {
  const event = state.events.find((event) => event.id === e.eventId)
  return <article><div className="rex-actions"><strong>{executionLabel(e, state)}</strong><Badge status={e.status} />{e.intent === 'PENDING_RESOLUTION' && <span>Resolución de pendiente</span>}</div>{event && e.performedAt && <p>{event.name}</p>}<p>{e.notes}</p>{e.ot && <p>OT: {e.ot}</p>}<p className="rex-muted">{e.items.filter((i) => Number(i.completed) === Number(i.quantity)).length} / {e.items.length} actividades completas · Registro: {formatRepairDate(e.createdAt)}</p>
    {e.resolutions.map((r) => { const p = state.pending.find((p) => p.id === r.pendingId); return <p key={r.pendingId}>Resolvió {Number(r.quantity)} {p?.unit}: {p?.component} · Origen: {p ? originName(p, state) : '—'}</p> })}
    <details open={e.status === 'PARTIAL'}><summary>Ver alcance histórico</summary><div className="rex-table-scroll"><table><thead><tr><th>Actividad</th><th>Realizado / previsto</th><th>Resultado original</th><th>Motivo / observación</th></tr></thead><tbody>{e.items.map((i) => <tr key={i.id}><td>{i.description}</td><td>{Number(i.completed)} / {Number(i.quantity)} {i.unit}</td><td><Badge status={i.status} /></td><td>{i.reason}<small>{i.notes}</small></td></tr>)}</tbody></table></div></details>
    {e.intent === 'FULL_TASK' && <details><summary>Recursos y costos históricos</summary>{e.taskSnapshot.estimate ? <><p className="rex-muted">Estimación al registrar/planificar esta intervención; no es el costo real de ejecución.</p><EstimateSummary value={e.taskSnapshot.estimate} /></> : <p className="rex-muted">No había una estimación estructurada registrada. No se calcula con tarifas actuales.</p>}<LegacyResources values={e.taskSnapshot.resources || {}} /></details>}
    {e.status === 'PLANNED' && <button className="primary" disabled={busy} onClick={() => onEditor({ type: 'EXECUTION', taskId: e.taskId, id: e.id })}>Registrar resultado</button>}
  </article>
}

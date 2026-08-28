import { useMemo, useState } from 'react'
import { areaLabel } from '../../config/areas'
import {
  GLOBAL_MAINTENANCE_CATALOG,
  campaignStatusLabels,
  compareGlobalTasks,
  getGlobalCatalogSummary,
  getGlobalTaskCampaignStatus,
  getGlobalTaskHistorySummary,
  globalTaskCriticalityLabels,
  globalTaskKindLabels,
  type GlobalMaintenanceTask,
  type GlobalTaskCriticality,
  type GlobalTaskKind,
} from '../data/globalMaintenanceCatalog'

type CatalogQuickFilter = 'ALL' | 'REPLACEMENT' | 'REPAIR' | 'HIGH' | 'PLANNED'
type HistoryFilter = 'ALL' | 'WITH_HISTORY' | 'PLANNED' | 'NO_HISTORY' | 'REVIEW'

const summary = getGlobalCatalogSummary()
const formatNumber = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })
const formatCurrency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function GlobalTaskCatalog() {
  const [query, setQuery] = useState('')
  const [sector, setSector] = useState('ALL')
  const [specialty, setSpecialty] = useState('ALL')
  const [criticality, setCriticality] = useState<'ALL' | GlobalTaskCriticality>('ALL')
  const [kind, setKind] = useState<'ALL' | GlobalTaskKind>('ALL')
  const [history, setHistory] = useState<HistoryFilter>('ALL')
  const [quick, setQuick] = useState<CatalogQuickFilter>('ALL')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const sectorOptions = useMemo(() => [...new Set(GLOBAL_MAINTENANCE_CATALOG.tasks.map((task) => task.sectorCode))].sort(compareSectorCodes), [])
  const specialtyOptions = useMemo(() => [...new Set(GLOBAL_MAINTENANCE_CATALOG.tasks.map((task) => task.specialty))].sort(), [])
  const filtered = useMemo(() => GLOBAL_MAINTENANCE_CATALOG.tasks.filter((task) => {
    const taskHistory = getGlobalTaskHistorySummary(task)
    const search = query.trim().toLocaleLowerCase('es')
    const searchable = [task.name, task.sectorCode, task.specialty, task.referenceWorkOrder, task.associatedPlan, task.controlData, task.justification, ...task.impacts].join(' ').toLocaleLowerCase('es')
    const matchesHistory = history === 'ALL'
      || (history === 'WITH_HISTORY' && taskHistory.doneCount > 0)
      || (history === 'PLANNED' && taskHistory.plannedCount > 0)
      || (history === 'NO_HISTORY' && taskHistory.doneCount === 0 && taskHistory.plannedCount === 0)
      || (history === 'REVIEW' && taskHistory.hasUnknown)
    const matchesQuick = quick === 'ALL'
      || (quick === 'REPLACEMENT' && task.kind === 'REPLACEMENT')
      || (quick === 'REPAIR' && task.kind === 'REPAIR')
      || (quick === 'HIGH' && task.criticality === 'HIGH')
      || (quick === 'PLANNED' && taskHistory.plannedCount > 0)
    return (!search || searchable.includes(search))
      && (sector === 'ALL' || task.sectorCode === sector)
      && (specialty === 'ALL' || task.specialty === specialty)
      && (criticality === 'ALL' || task.criticality === criticality)
      && (kind === 'ALL' || task.kind === kind)
      && matchesHistory
      && matchesQuick
  }).sort(compareGlobalTasks), [criticality, history, kind, query, quick, sector, specialty])
  const selectedTask = GLOBAL_MAINTENANCE_CATALOG.tasks.find((task) => task.id === selectedTaskId) ?? null

  return <>
    <section className="global-catalog-kpis" aria-label="Resumen de la base global">
      <article><small>TAREAS NORMALIZADAS</small><strong>{summary.total}</strong><span>10 sectores + transversales</span></article>
      <article><small>ALTA CRITICIDAD</small><strong>{summary.highCriticality}</strong><span>{Math.round(summary.highCriticality / summary.total * 100)}% de la base</span></article>
      <article><small>CON EJECUCIÓN REX / BO</small><strong>{summary.withExecution}</strong><span>{summary.withPlannedCampaign} con campañas planificadas</span></article>
      <article><small>PORTAFOLIO REGISTRADO</small><strong>{formatCompactUsd(summary.totalCostUsd)}</strong><span>USD · suma de la fuente</span></article>
    </section>

    <div className="replacement-quick-filters global-task-quick-filters">
      {([
        ['ALL', `Todas (${summary.total})`],
        ['REPLACEMENT', `Cambios / recambios (${summary.replacements})`],
        ['REPAIR', `Reparaciones (${summary.repairs})`],
        ['HIGH', `Alta criticidad (${summary.highCriticality})`],
        ['PLANNED', `Planificadas (${summary.withPlannedCampaign})`],
      ] as const).map(([value, label]) => <button key={value} className={quick === value ? 'active' : ''} onClick={() => setQuick(value)}>{label}</button>)}
    </div>

    <section className="replacement-filters global-task-filters">
      <label>Buscar<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tarea, sector, impacto, plan, OT..." /></label>
      <label>Sector<select value={sector} onChange={(event) => setSector(event.target.value)}><option value="ALL">Todos</option>{sectorOptions.map((value) => <option key={value} value={value}>{sectorLabel(value)}</option>)}</select></label>
      <label>Especialidad<select value={specialty} onChange={(event) => setSpecialty(event.target.value)}><option value="ALL">Todas</option>{specialtyOptions.map((value) => <option key={value} value={value}>{specialtyLabel(value)}</option>)}</select></label>
      <label>Criticidad<select value={criticality} onChange={(event) => setCriticality(event.target.value as typeof criticality)}><option value="ALL">Todas</option>{(['HIGH', 'MEDIUM', 'LOW', 'UNSPECIFIED'] as const).map((value) => <option key={value} value={value}>{globalTaskCriticalityLabels[value]}</option>)}</select></label>
      <label>Tipo de tarea<select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="ALL">Todos</option>{(['REPLACEMENT', 'REPAIR', 'INSPECTION', 'PROCUREMENT', 'OTHER'] as const).map((value) => <option key={value} value={value}>{globalTaskKindLabels[value]}</option>)}</select></label>
      <label>Historial<select value={history} onChange={(event) => setHistory(event.target.value as HistoryFilter)}><option value="ALL">Todo</option><option value="WITH_HISTORY">Con ejecución</option><option value="PLANNED">Con planificación</option><option value="NO_HISTORY">Sin historial</option><option value="REVIEW">Datos a revisar</option></select></label>
    </section>

    <div className="global-catalog-result-bar"><strong>{filtered.length}</strong> tareas visibles <span>Ordenadas por sector, criticidad y nombre</span></div>
    <div className="replacement-table-wrap global-task-table-wrap"><table className="replacement-table global-task-table"><thead><tr><th>Tarea global</th><th>Sector</th><th>Frecuencia / parada</th><th>Impacto</th><th>Criticidad</th><th>Historial REX / BO</th><th>Referencias</th><th /></tr></thead><tbody>{renderGroupedRows(filtered, setSelectedTaskId)}{!filtered.length && <tr><td colSpan={8} className="maintenance-empty">No hay tareas que coincidan con los filtros.</td></tr>}</tbody></table></div>
    <p className="global-catalog-source-note">Fuente: {GLOBAL_MAINTENANCE_CATALOG.metadata.sourceFile} · hoja {GLOBAL_MAINTENANCE_CATALOG.metadata.sheet}. Se importaron {GLOBAL_MAINTENANCE_CATALOG.metadata.validTasks} tareas; se excluyeron {GLOBAL_MAINTENANCE_CATALOG.metadata.excludedRowsWithoutTask} filas sin tarea, incluidas {GLOBAL_MAINTENANCE_CATALOG.metadata.unlinkedPlanIds.length} referencias de plan sin relación trazable.</p>
    {selectedTask && <GlobalTaskDetail task={selectedTask} onClose={() => setSelectedTaskId(null)} />}
  </>
}

function renderGroupedRows(tasks: GlobalMaintenanceTask[], selectTask: (id: string) => void) {
  const grouped = new Map<string, GlobalMaintenanceTask[]>()
  tasks.forEach((task) => { const values = grouped.get(task.sectorCode) ?? []; values.push(task); grouped.set(task.sectorCode, values) })
  return [...grouped.entries()].flatMap(([sector, sectorTasks]) => [
    <tr className="global-task-sector-row" key={`sector-${sector}`}><td colSpan={8}><strong>{sectorLabel(sector)}</strong><span>{sectorTasks.length} tareas</span></td></tr>,
    ...sectorTasks.map((task) => {
      const history = getGlobalTaskHistorySummary(task)
      return <tr key={task.id} className="global-task-row">
        <td><strong>{task.name}</strong><small><span className={`global-task-kind kind-${task.kind}`}>{globalTaskKindLabels[task.kind]}</span> {specialtyLabel(task.specialty)}</small></td>
        <td><strong>{task.sectorCode === 'TRANSVERSAL' ? 'Transversal' : task.sectorCode}</strong><small>{areaLabel(task.areaCode)}</small></td>
        <td><strong>{frequencyLabel(task)}</strong><small>{task.interventionDays === null ? 'Parada sin dato' : `${formatNumber.format(task.interventionDays)} días de intervención`}</small></td>
        <td>{task.impacts.length ? task.impacts.map((impact) => <span className="global-task-impact" key={impact}>{impact}</span>) : <small>Sin dato</small>}</td>
        <td><span className={`global-criticality criticality-${task.criticality}`}>{globalTaskCriticalityLabels[task.criticality]}</span></td>
        <td><strong>{history.latestDone?.label ?? 'Sin ejecución registrada'}</strong><small>{history.doneCount ? `${history.doneCount} campañas ejecutadas` : history.plannedCount ? `${history.plannedCount} planificadas` : 'Sin historial confirmado'}{history.hasUnknown ? ' · revisar fuente' : ''}</small></td>
        <td><strong>{task.associatedPlan ? `Plan ${task.associatedPlan}` : task.referenceWorkOrder ? `OT ${task.referenceWorkOrder}` : '—'}</strong><small>{task.documentationAvailable ? 'Documentación indicada' : task.referenceWorkOrder ? `OT ${task.referenceWorkOrder}` : 'Sin referencia'}</small></td>
        <td><button onClick={() => selectTask(task.id)}>Ver ficha</button></td>
      </tr>
    }),
  ])
}

function GlobalTaskDetail({ task, onClose }: { task: GlobalMaintenanceTask; onClose: () => void }) {
  const history = getGlobalTaskHistorySummary(task)
  return <div className="global-task-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><aside className="global-task-drawer" role="dialog" aria-modal="true" aria-label={`Ficha de ${task.name}`}>
    <header><div><small>{task.id} · FILA {task.sourceRow}</small><h2>{task.name}</h2><p>{sectorLabel(task.sectorCode)} · {specialtyLabel(task.specialty)}</p></div><button aria-label="Cerrar ficha" onClick={onClose}>×</button></header>
    <div className="global-task-drawer-body">
      <div className="global-task-badges"><span className={`global-criticality criticality-${task.criticality}`}>{globalTaskCriticalityLabels[task.criticality]}</span><span className={`global-task-kind kind-${task.kind}`}>{globalTaskKindLabels[task.kind]}</span>{task.impacts.map((impact) => <span className="global-task-impact" key={impact}>{impact}</span>)}</div>
      <section className="global-task-metrics"><Metric label="Frecuencia" value={frequencyLabel(task)} /><Metric label="Intervención" value={task.interventionDays === null ? 'Sin dato' : `${formatNumber.format(task.interventionDays)} días`} /><Metric label="Última ejecución" value={history.latestDone?.label ?? 'Sin registro'} /><Metric label="Costo total" value={currency(task.costsUsd.total)} /></section>
      <DetailSection title="Alcance y criterio"><DetailText label="Dato de control" value={task.controlData} /><DetailText label="Justificación" value={task.justification} /></DetailSection>
      <DetailSection title="Recursos estimados"><div className="global-task-detail-grid"><DetailValue label="Terceros MEC" value={task.workforce.mechanicalContractors} /><DetailValue label="Terceros ELE" value={task.workforce.electricalContractors} /><DetailValue label="Terceros total" value={task.workforce.totalContractors} /><DetailValue label="Horas-hombre" value={task.workforce.contractorHours} /></div></DetailSection>
      <DetailSection title="Costos de la base (USD)"><div className="global-task-detail-grid"><DetailValue label="MRO" value={currency(task.costsUsd.mro)} /><DetailValue label="Mano de obra terceros" value={currency(task.costsUsd.contractorLabor)} /><DetailValue label="Servicios" value={currency(task.costsUsd.services)} /><DetailValue label="Labor propia" value={currency(task.costsUsd.ownLabor)} /></div></DetailSection>
      <DetailSection title="Historial REX / BO"><div className="global-campaign-grid">{GLOBAL_MAINTENANCE_CATALOG.campaigns.map((campaign) => { const status = getGlobalTaskCampaignStatus(task, campaign.id); return <article className={`campaign-${status}`} key={campaign.id}><small>{campaign.kind}</small><strong>{campaign.label.replace(`${campaign.kind} `, '')}</strong><span>{campaignStatusLabels[status]}</span>{task.campaignRaw[campaign.id] && <em>Original: {task.campaignRaw[campaign.id]}</em>}</article> })}</div></DetailSection>
      <DetailSection title="Referencias"><div className="global-task-detail-grid"><DetailValue label="OT de referencia" value={task.referenceWorkOrder || 'Sin dato'} /><DetailValue label="Plan asociado" value={task.associatedPlan || 'Sin dato'} /><DetailValue label="Documentación" value={task.documentationAvailable ? 'Indicada en la fuente' : 'No indicada'} /><DetailValue label="Línea" value={task.line || 'Sin dato'} /></div></DetailSection>
      {task.sourceWarnings.length > 0 && <section className="global-task-warning"><strong>Datos de origen a revisar</strong>{task.sourceWarnings.map((warning) => <span key={warning}>{warning}</span>)}</section>}
    </div>
  </aside></div>
}

function Metric({ label, value }: { label: string; value: string }) { return <article><small>{label}</small><strong>{value}</strong></article> }
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="global-task-detail-section"><h3>{title}</h3>{children}</section> }
function DetailText({ label, value }: { label: string; value: string }) { return <div className="global-task-detail-text"><strong>{label}</strong><p>{value || 'Sin dato en la fuente.'}</p></div> }
function DetailValue({ label, value }: { label: string; value: string | number | null }) { return <div><small>{label}</small><strong>{value === null || value === '' ? 'Sin dato' : typeof value === 'number' ? formatNumber.format(value) : value}</strong></div> }

function frequencyLabel(task: GlobalMaintenanceTask) {
  if (task.frequencyYears !== null) return `${formatNumber.format(task.frequencyYears)} ${task.frequencyYears === 1 ? 'año' : 'años'}`
  return task.frequencySource ? `${task.frequencySource} años (origen)` : 'Sin frecuencia'
}
function currency(value: number | null) { return value === null ? 'Sin dato' : formatCurrency.format(value) }
function formatCompactUsd(value: number) { return value >= 1_000_000 ? `${(value / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} M` : formatNumber.format(value) }
function specialtyLabel(value: string) { return ({ MEC: 'Mecánica', ELE: 'Eléctrica', LUB: 'Lubricación', 'MEC/ELE': 'Mecánica / Eléctrica', OTRA: 'Otra' } as Record<string, string>)[value] ?? value }
function sectorLabel(value: string) { return value === 'TRANSVERSAL' ? 'Transversal / múltiples sectores' : value }
function compareSectorCodes(a: string, b: string) { if (a === 'TRANSVERSAL') return 1; if (b === 'TRANSVERSAL') return -1; return Number.parseInt(a, 10) - Number.parseInt(b, 10) }

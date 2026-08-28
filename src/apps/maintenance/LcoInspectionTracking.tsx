import { useMemo, useState } from 'react'
import { createDefaultLcoCouplingTopology, type LcoCouplingModuleData } from '../../maintenance/domain/lcoCouplings'
import { differenceInCalendarDays } from '../../maintenance/domain/maintenanceDateService'
import { classifyInspectionAge, getLcoCouplingState, type InspectionAgeStatus } from '../../maintenance/domain/lcoCouplingSelectors'

type AgeFilter = InspectionAgeStatus | 'ALL'
type TrackingSort = 'AGE_DESC' | 'AGE_ASC' | 'DATE_DESC' | 'DATE_ASC'

const topology = createDefaultLcoCouplingTopology()

const dateFormat = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

export function LcoInspectionTracking({ data, referenceDate, onViewPosition, onInspect, onEditControl }: { data: LcoCouplingModuleData; referenceDate: string; onViewPosition: (couplingId: string) => void; onInspect: (couplingId: string) => void; onEditControl: (eventId: string, couplingId: string) => void }) {
  const [filter, setFilter] = useState<AgeFilter>('ALL')
  const [sort, setSort] = useState<TrackingSort>('AGE_DESC')
  const thresholds = data.inspectionAgeThresholds
  const allRows = useMemo(() => topology.couplings.map((coupling) => {
    const wear = getLcoCouplingState(data, coupling.id, referenceDate)
    const lastInspectionDate = wear.lastInspection?.event.date ?? null
    const daysSinceLastInspection = lastInspectionDate ? differenceInCalendarDays(referenceDate, lastInspectionDate) : null
    return { coupling, wear, age: { couplingId: coupling.id, lastInspectionDate, daysSinceLastInspection, status: classifyInspectionAge(daysSinceLastInspection, thresholds) } }
  }), [data, referenceDate, thresholds])
  const summary = useMemo(() => ({
    neverInspected: allRows.filter((row) => row.age.status === 'NEVER_INSPECTED').length,
    veryOld: allRows.filter((row) => row.age.status === 'VERY_OLD').length,
    old: allRows.filter((row) => row.age.status === 'OLD').length,
    due: allRows.filter((row) => row.age.status === 'DUE').length,
    recent: allRows.filter((row) => row.age.status === 'RECENT').length,
  }), [allRows])
  const rows = useMemo(() => allRows.filter((row) => filter === 'ALL' || row.age.status === filter).sort((a, b) => compareTrackingRows(a.age.lastInspectionDate, a.age.daysSinceLastInspection, b.age.lastInspectionDate, b.age.daysSinceLastInspection, sort) || a.coupling.id.localeCompare(b.coupling.id)), [allRows, filter, sort])

  return <section className="lco-control-tracking">
    <header><div><small>SEGUIMIENTO INDEPENDIENTE DEL DESGASTE</small><h2>Tiempo desde el último control</h2><p>Prioriza los acoplamientos nunca inspeccionados y los controles más antiguos.</p></div><label>Ordenar por<select value={sort} onChange={(event) => setSort(event.target.value as TrackingSort)}><option value="AGE_DESC">Hace: mayor a menor</option><option value="AGE_ASC">Hace: menor a mayor</option><option value="DATE_DESC">Fecha: más reciente</option><option value="DATE_ASC">Fecha: más antigua</option></select></label></header>
    <nav className="lco-age-summary" aria-label="Resumen de antigüedad de controles">
      <AgeSummaryButton active={filter === 'NEVER_INSPECTED'} status="never" value={summary.neverInspected} label="Nunca inspeccionados" onClick={() => setFilter(filter === 'NEVER_INSPECTED' ? 'ALL' : 'NEVER_INSPECTED')} />
      <AgeSummaryButton active={filter === 'VERY_OLD'} status="very-old" value={summary.veryOld} label={`> ${thresholds.oldDays} días`} onClick={() => setFilter(filter === 'VERY_OLD' ? 'ALL' : 'VERY_OLD')} />
      <AgeSummaryButton active={filter === 'OLD'} status="old" value={summary.old} label={`${thresholds.dueDays + 1}–${thresholds.oldDays} días`} onClick={() => setFilter(filter === 'OLD' ? 'ALL' : 'OLD')} />
      <AgeSummaryButton active={filter === 'DUE'} status="due" value={summary.due} label={`${thresholds.recentDays + 1}–${thresholds.dueDays} días`} onClick={() => setFilter(filter === 'DUE' ? 'ALL' : 'DUE')} />
      <AgeSummaryButton active={filter === 'RECENT'} status="recent" value={summary.recent} label={`≤ ${thresholds.recentDays} días`} onClick={() => setFilter(filter === 'RECENT' ? 'ALL' : 'RECENT')} />
    </nav>
    <div className="lco-control-table-wrap"><table className="lco-control-table"><thead><tr><th>Acoplamiento</th><th>Jaula</th><th>Posición</th><th>Lado</th><th>Estado desgaste</th><th>Último control</th><th>Hace</th><th>Último recambio</th><th>Acciones</th></tr></thead><tbody>{rows.map(({ age, coupling, wear }) => <tr key={coupling.id} className={`age-${age.status.toLowerCase()}`}><td><strong>{coupling.id}</strong></td><td>J{coupling.cageNumber}</td><td>{coupling.shaftPosition === 'UPPER' ? 'SUP' : 'INF'}</td><td>{coupling.side === 'GEARBOX' ? 'Reductor' : 'Jaula'}</td><td>{wear.wearSource === 'REPLACEMENT' ? <b className="wear-text-new">N · Nuevo</b> : wear.currentWearLevel ? <b className={`wear-text-${wear.currentWearLevel}`}>{wear.currentWearLevel}/5</b> : '— Sin inspección'}</td><td>{age.lastInspectionDate ? formatDate(age.lastInspectionDate) : 'Nunca'}</td><td><span className={`lco-age-badge ${age.status.toLowerCase()}`}>{age.daysSinceLastInspection === null ? 'Nunca' : `${age.daysSinceLastInspection} días · ${ageLabel(age.status)}`}</span></td><td>{wear.lastReplacement ? formatDate(wear.lastReplacement.date) : '—'}</td><td><div className="lco-control-actions"><button onClick={() => onViewPosition(coupling.id)}>Ver posición</button>{wear.lastInspection && <button className="edit" onClick={() => onEditControl(wear.lastInspection!.event.id, coupling.id)}>Editar control</button>}<button className="primary" onClick={() => onInspect(coupling.id)}>Inspeccionar</button></div></td></tr>)}</tbody></table>{!rows.length && <p className="maintenance-empty">No hay acoplamientos para este filtro.</p>}</div>
  </section>
}

function AgeSummaryButton({ active, status, value, label, onClick }: { active: boolean; status: string; value: number; label: string; onClick: () => void }) {
  return <button className={`${status} ${active ? 'active' : ''}`} onClick={onClick}><strong>{value}</strong><span>{label}</span></button>
}

function ageLabel(status: InspectionAgeStatus) {
  return status === 'RECENT' ? 'Reciente' : status === 'DUE' ? 'Próximo' : status === 'OLD' ? 'Antiguo' : status === 'VERY_OLD' ? 'Muy antiguo' : 'Nunca inspeccionado'
}

function compareTrackingRows(aDate: string | null, aDays: number | null, bDate: string | null, bDays: number | null, sort: TrackingSort) {
  if (sort === 'AGE_DESC') return (bDays ?? Number.MAX_SAFE_INTEGER) - (aDays ?? Number.MAX_SAFE_INTEGER)
  if (sort === 'AGE_ASC') return (aDays ?? Number.MAX_SAFE_INTEGER) - (bDays ?? Number.MAX_SAFE_INTEGER)
  if (!aDate && !bDate) return 0
  if (!aDate) return 1
  if (!bDate) return -1
  return sort === 'DATE_DESC' ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate)
}

function formatDate(value: string) { return dateFormat.format(new Date(`${value}T00:00:00Z`)) }

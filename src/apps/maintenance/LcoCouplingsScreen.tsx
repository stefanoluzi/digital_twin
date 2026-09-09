import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { differenceInCalendarDays, todayDateOnly } from '../../maintenance/domain/maintenanceDateService'
import {
  COUPLING_CONDITION_CODES,
  COUPLING_WEAR_LEVELS,
  LCO_CAGE_NUMBERS,
  LCO_NORTH_CAGES,
  LCO_SHAFT_POSITIONS,
  LCO_SOUTH_CAGES,
  couplingWearLabels,
  createDefaultLcoCouplingTopology,
  createLcoShaftId,
  getCouplingsForCage,
  getCouplingsForShaft,
  getLcoCouplingById,
  getLcoShaftById,
  type CouplingWearLevel,
  type CouplingConditionCode,
  type LcoCageNumber,
  type LcoCoupling,
  type LcoPhotoAttachment,
  type LcoShaftPosition,
  type LcoCouplingModuleData,
} from '../../maintenance/domain/lcoCouplings'
import {
  getLcoCouplingHistory,
  getLcoCouplingState,
  getLcoCouplingSummary,
  getLcoShaftState,
  type LcoCouplingState,
  type LcoShaftState,
} from '../../maintenance/domain/lcoCouplingSelectors'
import { useMaintenanceStore } from '../../maintenance/store/maintenanceStore'
import {
  buildLcoInspectionReadings,
  findNextUnevaluatedSelected,
  getInspectionProgress,
  matchesLcoFilter,
  setCageSelected,
  setCouplingsSelected,
  setShaftSelected,
  type LcoFilter,
} from './lcoCouplingUx'
import { LcoActivityPanel, LcoEditEventDialog, LcoHistorySection } from './LcoHistoryWorkspace'
import { LcoPhotoLightbox, LcoPhotoPicker } from './LcoPhotoControls'
import type { LcoHistoryRow } from '../../maintenance/domain/lcoHistorySelectors'
import { LcoInspectionTracking } from './LcoInspectionTracking'
import { dismissLegacyLcoCandidate, importLegacyLcoCandidate, initializeLcoPersistence, replacePersistentLcoData } from '../../maintenance/services/lcoPersistenceService'
import { getLcoBackupStats, lcoBackupFileName, parseLcoBackup, serializeLcoBackup } from '../../maintenance/services/lcoBackupService'
import { exportLcoExcelBackup } from '../../maintenance/services/lcoExcelBackupService'

type SelectedTarget = { type: 'COUPLING'; id: string } | { type: 'SHAFT'; id: string } | null
type LcoView = 'STATE' | 'TRACKING' | 'HISTORY'
type ModalState =
  | { type: 'INSPECTION'; couplingIds: string[] }
  | { type: 'EDIT_INSPECTION'; eventId: string; couplingId: string }
  | { type: 'COUPLING_REPLACEMENT'; couplingId: string }
  | { type: 'SHAFT_REPLACEMENT'; cageNumber: LcoCageNumber; shaftPosition: LcoShaftPosition }
  | { type: 'SETTINGS' }
  | null

const topology = createDefaultLcoCouplingTopology()
const displayDate = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

export function LcoCouplingsScreen({ standalone = false, standaloneThemeControl }: { standalone?: boolean; standaloneThemeControl?: ReactNode }) {
  const maintenance = useMaintenanceStore()
  const importRef = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState<LcoFilter>('ALL')
  const [view, setView] = useState<LcoView>('STATE')
  const [selected, setSelected] = useState<SelectedTarget>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [gallery, setGallery] = useState<LcoPhotoAttachment[] | null>(null)
  const [highlightedCouplingId, setHighlightedCouplingId] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<LcoCouplingModuleData | null>(null)
  const [importError, setImportError] = useState('')
  const [exportingExcel, setExportingExcel] = useState(false)
  const states = useMemo(() => new Map(topology.couplings.map((coupling) => [coupling.id, getLcoCouplingState(maintenance.lcoCouplings, coupling.id, maintenance.referenceDate)])), [maintenance.lcoCouplings, maintenance.referenceDate])
  const shaftStates = useMemo(() => new Map(topology.shafts.map((shaft) => [shaft.id, getLcoShaftState(maintenance.lcoCouplings, shaft.cageNumber, shaft.position, maintenance.referenceDate)])), [maintenance.lcoCouplings, maintenance.referenceDate])
  const summary = useMemo(() => getLcoCouplingSummary(maintenance.lcoCouplings, maintenance.referenceDate), [maintenance.lcoCouplings, maintenance.referenceDate])
  const openHistoryTarget = (row: LcoHistoryRow) => setSelected(row.couplingId ? { type: 'COUPLING', id: row.couplingId } : { type: 'SHAFT', id: createLcoShaftId(row.cageNumber, row.shaftPosition) })
  useEffect(() => { void initializeLcoPersistence() }, [])

  const showPosition = (couplingId: string) => {
    setView('STATE'); setHighlightedCouplingId(couplingId)
    window.setTimeout(() => setHighlightedCouplingId((current) => current === couplingId ? null : current), 3000)
    window.setTimeout(() => document.querySelector(`[data-coupling-id="${couplingId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }
  const exportBackup = () => {
    const blob = new Blob([serializeLcoBackup(maintenance.lcoCouplings)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = lcoBackupFileName(); anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  const exportExcel = async () => {
    try {
      setImportError('')
      setExportingExcel(true)
      await exportLcoExcelBackup(maintenance.lcoCouplings, maintenance.referenceDate)
    } catch (error) {
      setImportError(error instanceof Error ? `No se pudo generar el Excel: ${error.message}` : 'No se pudo generar el Excel.')
    } finally {
      setExportingExcel(false)
    }
  }
  const readImport = async (file?: File) => {
    if (!file) return
    try { setImportError(''); setPendingImport(parseLcoBackup(await file.text())) }
    catch (error) { setImportError(error instanceof Error ? error.message : 'No se pudo leer el respaldo.') }
  }

  if (maintenance.lcoStorageStatus === 'IDLE' || maintenance.lcoStorageStatus === 'LOADING') return <main className="lco-couplings-screen lco-storage-loading"><strong>Inicializando almacenamiento local…</strong><span>Preparando los 32 acoplamientos.</span></main>

  return <main className="lco-couplings-screen">
    {standalone ? <header className="lco-standalone-header"><div><small>LACO 1</small><h1>Acoplamientos LCO</h1><span className="lco-local-storage-note" title="Los datos permanecen en este navegador. Guarde periódicamente el respaldo restaurable y el informe Excel.">● Datos almacenados localmente en este equipo</span></div><div className="lco-standalone-actions">{standaloneThemeControl}<StorageStatus status={maintenance.lcoStorageStatus} error={maintenance.lcoStorageError} /><button title="Copia completa para recuperar la aplicación, incluidas las fotos" onClick={exportBackup}>Guardar respaldo</button><button title="Informe legible con estado actual e historial" disabled={exportingExcel} onClick={() => void exportExcel()}>{exportingExcel ? 'Generando Excel…' : 'Exportar Excel'}</button><button onClick={() => importRef.current?.click()}>Importar respaldo</button><button onClick={() => setModal({ type: 'SETTINGS' })}>Configurar</button><button className="primary" onClick={() => setModal({ type: 'INSPECTION', couplingIds: [] })}>+ Registrar inspección</button><input ref={importRef} hidden type="file" accept=".lcocouplings,.json,application/json" onChange={(event) => { void readImport(event.target.files?.[0]); event.target.value = '' }} /></div></header> : <header className="lco-screen-header">
      <div><small>MÓDULO ESPECIALIZADO · LAMINADOR CONTINUO</small><h1>Estado Acoplamientos LCO</h1><p>REDUCTOR → ACOPLAMIENTO → ALUNGA → ACOPLAMIENTO → JAULA</p></div>
      <div className="lco-header-actions"><label>Fecha de referencia<input type="date" value={maintenance.referenceDate} onChange={(event) => maintenance.setReferenceDate(event.target.value)} /></label><button onClick={() => setModal({ type: 'SETTINGS' })}>Configurar</button><button className="primary" onClick={() => setModal({ type: 'INSPECTION', couplingIds: [] })}>+ Registrar inspección</button></div>
    </header>}

    {standalone && <div className="lco-standalone-reference"><label>Fecha de referencia<input type="date" value={maintenance.referenceDate} onChange={(event) => maintenance.setReferenceDate(event.target.value)} /></label></div>}
    {importError && <div className="lco-storage-error">{importError}<button onClick={() => setImportError('')}>×</button></div>}
    {maintenance.lcoLegacyCandidate && <section className="lco-migration-banner"><div><strong>Se encontraron datos de Acoplamientos LCO en el proyecto actual.</strong><span>Podés importarlos una sola vez al almacenamiento independiente.</span></div><button onClick={() => void dismissLegacyLcoCandidate()}>Ignorar</button><button className="primary" onClick={() => void importLegacyLcoCandidate()}>Importar datos del proyecto</button></section>}
    <nav className="lco-view-tabs" aria-label="Vistas de Acoplamientos LCO">{([['STATE', 'Estado actual'], ['TRACKING', 'Seguimiento controles'], ['HISTORY', 'Historial']] as const).map(([id, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>)}</nav>

    {view === 'STATE' && <><LcoStateOverview summary={summary} />

    <nav className="lco-filter-bar" aria-label="Filtros rápidos">
      {([
        ['ALL', 'Todos'], ['WORN', '4–5'], ['CRITICAL', '5 críticos'], ['NO_INSPECTION', 'Sin inspección'],
      ] as const).map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}
      <span>El filtro atenúa el resto sin ocultar la topología.</span>
    </nav>

    <section className="lco-operations-layout">
      <section className="lco-train-panel">
        <header className="lco-train-toolbar"><div><small>VISTA DE PLANTA · TREN DE LAMINACIÓN</small><strong>Sinóptico longitudinal</strong></div><WearLegend /></header>
        <TrainSynoptic states={states} shaftStates={shaftStates} filter={filter} highlightedCouplingId={highlightedCouplingId} onSelect={setSelected} onInspect={(ids) => setModal({ type: 'INSPECTION', couplingIds: ids })} />
      </section>
      <LcoActivityPanel data={maintenance.lcoCouplings} onOpenTarget={openHistoryTarget} onOpenPhotos={setGallery} />
    </section></>}

    {view === 'TRACKING' && <LcoInspectionTracking data={maintenance.lcoCouplings} referenceDate={maintenance.referenceDate} onViewPosition={showPosition} onInspect={(couplingId) => setModal({ type: 'INSPECTION', couplingIds: [couplingId] })} onEditControl={(eventId, couplingId) => setModal({ type: 'EDIT_INSPECTION', eventId, couplingId })} />}
    {view === 'HISTORY' && <LcoHistorySection data={maintenance.lcoCouplings} onOpenTarget={openHistoryTarget} onOpenPhotos={setGallery} />}

    {selected?.type === 'COUPLING' && <CouplingDetail couplingId={selected.id} onClose={() => setSelected(null)} onInspect={(id) => setModal({ type: 'INSPECTION', couplingIds: [id] })} onReplace={(id) => setModal({ type: 'COUPLING_REPLACEMENT', couplingId: id })} onEditControl={(eventId, couplingId) => setModal({ type: 'EDIT_INSPECTION', eventId, couplingId })} onOpenPhotos={setGallery} />}
    {selected?.type === 'SHAFT' && <ShaftDetail shaftId={selected.id} onClose={() => setSelected(null)} onInspect={(ids) => setModal({ type: 'INSPECTION', couplingIds: ids })} onReplace={(cageNumber, shaftPosition) => setModal({ type: 'SHAFT_REPLACEMENT', cageNumber, shaftPosition })} onOpenPhotos={setGallery} />}
    {modal?.type === 'INSPECTION' && <InspectionDialog initialCouplingIds={modal.couplingIds} onClose={() => setModal(null)} />}
    {modal?.type === 'EDIT_INSPECTION' && <LcoEditEventDialog couplingId={modal.couplingId} event={maintenance.lcoCouplings.events.find((event) => event.id === modal.eventId)!} onSave={(event) => { maintenance.replaceLcoEvent(event); setModal(null) }} onClose={() => setModal(null)} />}
    {modal?.type === 'COUPLING_REPLACEMENT' && <CouplingReplacementDialog couplingId={modal.couplingId} onClose={() => setModal(null)} />}
    {modal?.type === 'SHAFT_REPLACEMENT' && <ShaftReplacementDialog cageNumber={modal.cageNumber} shaftPosition={modal.shaftPosition} onClose={() => setModal(null)} />}
    {modal?.type === 'SETTINGS' && <LcoSettingsDialog onClose={() => setModal(null)} />}
    {pendingImport && <ImportBackupDialog data={pendingImport} onClose={() => setPendingImport(null)} onConfirm={() => { void replacePersistentLcoData(pendingImport); setPendingImport(null) }} />}
    {gallery && <LcoPhotoLightbox photos={gallery} onClose={() => setGallery(null)} />}
  </main>
}

function StorageStatus({ status, error }: { status: ReturnType<typeof useMaintenanceStore.getState>['lcoStorageStatus']; error: string }) {
  return <span className={`lco-storage-status ${status.toLowerCase()}`} title={error}>{status === 'SAVING' ? 'Guardando…' : status === 'ERROR' ? 'Error al guardar' : '✓ Guardado'}</span>
}

function ImportBackupDialog({ data, onClose, onConfirm }: { data: LcoCouplingModuleData; onClose: () => void; onConfirm: () => void }) {
  const stats = getLcoBackupStats(data)
  return <LcoDialog title="Importar respaldo" subtitle="ESTA ACCIÓN REEMPLAZA LOS DATOS LOCALES" onClose={onClose} footer={<><button onClick={onClose}>Cancelar</button><button className="danger" onClick={onConfirm}>Importar y reemplazar</button></>}><div className="lco-import-summary"><p>El respaldo contiene:</p><strong>{stats.inspections} inspecciones</strong><strong>{stats.replacements} recambios</strong><strong>{stats.photos} fotos</strong><p>¿Desea reemplazar los datos locales actuales?</p></div></LcoDialog>
}

function WearLegend() {
  return <div className="lco-wear-legend"><span>DESGASTE</span><span><i className="wear-new">N</i>Nuevo por recambio</span>{COUPLING_WEAR_LEVELS.map((level) => <span key={level}><i className={`wear-${level}`}>{level}</i>{level === 1 ? 'Nuevo' : level === 2 ? 'Bueno' : level === 3 ? 'Regular' : level === 4 ? 'Desgastado' : 'Crítico'}</span>)}<span><i className="wear-none">—</i>Sin inspección</span></div>
}

function LcoStateOverview({ summary }: { summary: ReturnType<typeof getLcoCouplingSummary> }) {
  const inspected = Math.max(0, summary.total - summary.withoutInspection)
  const stable = Math.max(0, summary.total - summary.critical - summary.worn - summary.withoutInspection)
  const attention = summary.critical + summary.worn
  const percent = (value: number) => summary.total ? (value / summary.total) * 100 : 0
  const criticalEnd = percent(summary.critical)
  const wornEnd = criticalEnd + percent(summary.worn)
  const stableEnd = wornEnd + percent(stable)
  const coverage = summary.total ? Math.round((inspected / summary.total) * 100) : 0
  const chartBackground = `conic-gradient(#bd2d3d 0 ${criticalEnd}%, #d97827 ${criticalEnd}% ${wornEnd}%, #3c9870 ${wornEnd}% ${stableEnd}%, #59636e ${stableEnd}% 100%)`

  return <section className="lco-state-overview" aria-label="Estadística del estado de los acoplamientos">
    <div className="lco-state-donut" style={{ background: chartBackground }} role="img" aria-label={`${coverage}% de acoplamientos inspeccionados`}>
      <div><strong>{coverage}%</strong><span>inspeccionados</span></div>
    </div>
    <div className="lco-state-chart">
      <header><div><small>ESTADO GLOBAL</small><strong>{summary.total} acoplamientos relevados</strong></div><span>{inspected}/{summary.total} con control</span></header>
      <div className="lco-state-bar" role="img" aria-label={`${summary.critical} críticos, ${summary.worn} desgastados, ${stable} estables y ${summary.withoutInspection} sin inspección`}>
        {summary.critical > 0 && <i className="critical" style={{ flex: summary.critical }} />}
        {summary.worn > 0 && <i className="worn" style={{ flex: summary.worn }} />}
        {stable > 0 && <i className="stable" style={{ flex: stable }} />}
        {summary.withoutInspection > 0 && <i className="unchecked" style={{ flex: summary.withoutInspection }} />}
      </div>
      <div className="lco-state-legend">
        <span className="critical"><i />Críticos <strong>{summary.critical}</strong></span>
        <span className="worn"><i />Desgastados <strong>{summary.worn}</strong></span>
        <span className="stable"><i />Estables 1–3 <strong>{stable}</strong></span>
        <span className="unchecked"><i />Sin inspección <strong>{summary.withoutInspection}</strong></span>
      </div>
    </div>
    <aside className={attention ? 'requires-attention' : 'controlled'}><small>{attention ? 'REQUIEREN ATENCIÓN' : 'ESTADO GENERAL'}</small><strong>{attention}</strong><span>{attention ? `${Math.round(percent(attention))}% del total en nivel 4–5` : 'Sin niveles 4–5 registrados'}</span></aside>
  </section>
}

function TrainSynoptic({ states, shaftStates, filter, highlightedCouplingId, onSelect, onInspect }: { states: Map<string, LcoCouplingState>; shaftStates: Map<string, LcoShaftState>; filter: LcoFilter; highlightedCouplingId: string | null; onSelect: (value: SelectedTarget) => void; onInspect: (ids: string[]) => void }) {
  return <div className="lco-train-synoptic"><TrainLane side="north" cages={LCO_NORTH_CAGES} states={states} shaftStates={shaftStates} filter={filter} highlightedCouplingId={highlightedCouplingId} onSelect={onSelect} onInspect={onInspect} /><div className="lco-train-direction" aria-label="Dirección de laminación hacia la derecha"><i /><span>DIRECCIÓN DE LAMINACIÓN <b>→</b></span><i /></div><TrainLane side="south" cages={LCO_SOUTH_CAGES} states={states} shaftStates={shaftStates} filter={filter} highlightedCouplingId={highlightedCouplingId} onSelect={onSelect} onInspect={onInspect} /></div>
}

function TrainLane({ side, cages, states, shaftStates, filter, highlightedCouplingId, onSelect, onInspect }: { side: 'south' | 'north'; cages: LcoCageNumber[]; states: Map<string, LcoCouplingState>; shaftStates: Map<string, LcoShaftState>; filter: LcoFilter; highlightedCouplingId: string | null; onSelect: (value: SelectedTarget) => void; onInspect: (ids: string[]) => void }) {
  return <section className={`lco-train-lane ${side}`}><header><strong>{side === 'south' ? 'SUR' : 'NORTE'}</strong><span>{side === 'south' ? 'JAULAS IMPARES' : 'JAULAS PARES'}</span></header><div>{cages.map((cageNumber) => <TrainCage key={cageNumber} cageNumber={cageNumber} states={states} shaftStates={shaftStates} filter={filter} highlightedCouplingId={highlightedCouplingId} onSelect={onSelect} onInspect={onInspect} />)}</div></section>
}

function TrainCage({ cageNumber, states, shaftStates, filter, highlightedCouplingId, onSelect, onInspect }: { cageNumber: LcoCageNumber; states: Map<string, LcoCouplingState>; shaftStates: Map<string, LcoShaftState>; filter: LcoFilter; highlightedCouplingId: string | null; onSelect: (value: SelectedTarget) => void; onInspect: (ids: string[]) => void }) {
  const cageCouplings = getCouplingsForCage(cageNumber)
  const cageStates = cageCouplings.map((coupling) => states.get(coupling.id)!)
  const missing = cageStates.filter((state) => state.wearSource !== 'INSPECTION').length
  return <article className={`lco-train-cage ${cageStates.some((state) => matchesLcoFilter(state, filter)) ? '' : 'filtered-out'}`}>
    <header><button aria-label={`Inspeccionar J${cageNumber}, 4 acoplamientos`} onClick={() => onInspect(cageCouplings.map((coupling) => coupling.id))}>J{cageNumber}</button><span>{missing ? `${4 - missing}/4 controlados` : '4/4 controlados'}</span></header>
    <div className="lco-mechanical-labels"><span>REDUCTOR</span><span>ALUNGA</span><span>JAULA</span></div>
    {LCO_SHAFT_POSITIONS.map((shaftPosition) => {
      const shaft = topology.shafts.find((item) => item.cageNumber === cageNumber && item.position === shaftPosition)!
      const couplings = getCouplingsForShaft(cageNumber, shaftPosition)
      const shaftState = shaftStates.get(shaft.id)!
      return <div className="lco-train-shaft" key={shaftPosition}><strong>{shaftPosition === 'UPPER' ? 'SUP' : 'INF'}</strong><CouplingNode coupling={couplings[0]} state={states.get(couplings[0].id)!} dimmed={!matchesLcoFilter(states.get(couplings[0].id)!, filter)} highlighted={highlightedCouplingId === couplings[0].id} onClick={() => onSelect({ type: 'COUPLING', id: couplings[0].id })} /><ShaftNode cageNumber={cageNumber} position={shaftPosition} state={shaftState} onClick={() => onSelect({ type: 'SHAFT', id: shaft.id })} /><CouplingNode coupling={couplings[1]} state={states.get(couplings[1].id)!} dimmed={!matchesLcoFilter(states.get(couplings[1].id)!, filter)} highlighted={highlightedCouplingId === couplings[1].id} onClick={() => onSelect({ type: 'COUPLING', id: couplings[1].id })} /></div>
    })}
  </article>
}

function CouplingNode({ coupling, state, dimmed, highlighted, onClick }: { coupling: LcoCoupling; state: LcoCouplingState; dimmed: boolean; highlighted: boolean; onClick: () => void }) {
  const level = state.currentWearLevel
  const displayWear = state.wearSource === 'REPLACEMENT' ? 'N' : level ?? '—'
  const ariaWear = state.wearSource === 'REPLACEMENT' ? 'nuevo por recambio, aún no inspeccionado' : level ? `desgaste ${level}` : 'sin inspección'
  const hoverPhotos = uniquePhotos([...(state.lastInspection?.attachments ?? []), ...(state.lastReplacement?.attachments ?? [])]).slice(0, 3)
  return <span className={`lco-coupling-wrap ${coupling.side === 'GEARBOX' ? 'gearbox' : 'stand'} ${dimmed ? 'dimmed' : ''}`}><button data-coupling-id={coupling.id} className={`lco-coupling-node ${state.wearSource === 'REPLACEMENT' ? 'wear-new installed-new' : `wear-${level ?? 'none'}`} ${highlighted ? 'highlighted' : ''}`} aria-label={`J${coupling.cageNumber} ${coupling.shaftPosition === 'UPPER' ? 'superior' : 'inferior'} lado ${coupling.side === 'GEARBOX' ? 'reductor' : 'jaula'} ${ariaWear}`} onClick={onClick}><span>{displayWear}</span></button><FreshnessSignal state={state} /><span className={`lco-hover-tooltip ${hoverPhotos.length ? 'with-photos' : ''}`} role="tooltip"><strong>{couplingTitle(coupling)}</strong><span>Desgaste: {state.wearSource === 'REPLACEMENT' ? 'N · Nuevo por recambio' : level ? `${level} / 5 · ${couplingWearLabel(level)}` : '— · Sin inspección'}</span>{state.wearSource === 'REPLACEMENT' && <em>Nuevo por recambio. Aún no inspeccionado.</em>}<span>Última inspección: {state.lastInspection ? formatDate(state.lastInspection.event.date) : 'Sin registro'}</span><span>Último recambio: {state.lastReplacement ? formatDate(state.lastReplacement.date) : 'Sin registro'}</span>{hoverPhotos.length > 0 && <span className="lco-hover-photos">{hoverPhotos.map((photo, index) => <img key={`${photo.createdAt}-${index}`} src={photo.dataUrl} alt={photo.caption || `Evidencia ${index + 1}`} />)}{state.photoCount > hoverPhotos.length && <b>+{state.photoCount - hoverPhotos.length}</b>}</span>}<span>Fotos: {state.photoCount}</span><small>Click para abrir ficha completa</small></span></span>
}

function ShaftNode({ cageNumber, position, state, onClick }: { cageNumber: LcoCageNumber; position: LcoShaftPosition; state: LcoShaftState; onClick: () => void }) {
  const [gearbox, stand] = state.couplings
  return <span className="lco-shaft-wrap"><button className="lco-shaft-line" aria-label={`Abrir detalle de alunga J${cageNumber} ${position === 'UPPER' ? 'superior' : 'inferior'}`} onClick={onClick}><span /></button><span className="lco-hover-tooltip shaft" role="tooltip"><strong>J{cageNumber} · Alunga {position === 'UPPER' ? 'superior' : 'inferior'}</strong><span>Último recambio: {state.lastShaftReplacement ? formatDate(state.lastShaftReplacement.date) : 'Sin registro'}</span><span>Reductor: {couplingDisplayValue(gearbox)}</span><span>Jaula: {couplingDisplayValue(stand)}</span><small>Click para historial</small></span></span>
}

function FreshnessSignal({ state }: { state: LcoCouplingState }) {
  if (state.wearSource === 'REPLACEMENT') return <small className="lco-freshness-signal new">sin insp.</small>
  if (state.daysSinceInspection === null) return <small className="lco-freshness-signal none">sin insp.</small>
  return <small className={`lco-freshness-signal ${state.freshness.toLowerCase()}`}>{state.daysSinceInspection}d{state.freshness === 'STALE' ? ' ◷' : state.freshness === 'VERY_STALE' ? ' ⚠' : ''}</small>
}

function InspectionDialog({ initialCouplingIds, onClose }: { initialCouplingIds: string[]; onClose: () => void }) {
  const record = useMaintenanceStore((state) => state.recordLcoInspection)
  const [date, setDate] = useState(todayDateOnly())
  const [inspector, setInspector] = useState('')
  const [observations, setObservations] = useState('')
  const [generalPhotos, setGeneralPhotos] = useState<LcoPhotoAttachment[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>(() => Object.fromEntries(initialCouplingIds.map((id) => [id, true])))
  const [wear, setWear] = useState<Record<string, CouplingWearLevel | undefined>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [conditionCodes, setConditionCodes] = useState<Record<string, CouplingConditionCode | undefined>>({})
  const [readingPhotos, setReadingPhotos] = useState<Record<string, LcoPhotoAttachment[]>>({})
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({})
  const [activeCouplingId, setActiveCouplingId] = useState(initialCouplingIds[0] ?? '')
  const [error, setError] = useState('')
  const progress = getInspectionProgress(selected, wear)

  const assignWear = (couplingId: string, level: CouplingWearLevel) => {
    const nextSelected = setCouplingsSelected(selected, [couplingId], true)
    const nextWear = { ...wear, [couplingId]: level }
    setSelected(nextSelected)
    setWear(nextWear)
    setActiveCouplingId(findNextUnevaluatedSelected(couplingId, nextSelected, nextWear) ?? couplingId)
    setError('')
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onClose(); return }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return
      if (event.key === 'Enter') {
        const next = findNextUnevaluatedSelected(activeCouplingId, selected, wear)
        if (next) setActiveCouplingId(next)
        event.preventDefault()
        return
      }
      if (!activeCouplingId || !selected[activeCouplingId] || !/^[1-5]$/.test(event.key)) return
      assignWear(activeCouplingId, Number(event.key) as CouplingWearLevel)
      event.preventDefault()
    }
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown)
  }, [activeCouplingId, onClose, selected, wear])

  const toggleCoupling = (couplingId: string, value: boolean) => {
    setSelected((current) => setCouplingsSelected(current, [couplingId], value))
    if (value) setActiveCouplingId(couplingId)
    setError('')
  }
  const toggleShaft = (cageNumber: LcoCageNumber, shaftPosition: LcoShaftPosition) => {
    const ids = getCouplingsForShaft(cageNumber, shaftPosition).map((coupling) => coupling.id)
    const value = !ids.every((id) => selected[id])
    setSelected((current) => setShaftSelected(current, cageNumber, shaftPosition, value))
    if (value) setActiveCouplingId(ids.find((id) => wear[id] === undefined) ?? ids[0])
    setError('')
  }
  const toggleCage = (cageNumber: LcoCageNumber) => {
    const ids = getCouplingsForCage(cageNumber).map((coupling) => coupling.id)
    const nextValue = !ids.every((id) => selected[id])
    setSelected((current) => setCageSelected(current, cageNumber, nextValue))
    if (nextValue) setActiveCouplingId(ids.find((id) => wear[id] === undefined) ?? ids[0])
    setError('')
  }
  const save = () => {
    if (!progress.selectedCount) { setError('Selecciona al menos un acoplamiento inspeccionado.'); return }
    if (!progress.canSave) { setError(`Faltan ${progress.selectedCount - progress.evaluatedCount} posiciones por evaluar.`); return }
    const readings = buildLcoInspectionReadings(selected, wear, notes, conditionCodes, readingPhotos)
    record({ date, inspector, observations, readings, attachments: generalPhotos }); onClose()
  }
  return <LcoDialog title="Registrar inspección parcial" subtitle={`${progress.selectedCount} seleccionados · ${progress.evaluatedCount} evaluados`} wide onClose={onClose} footer={<><span className="lco-dialog-error">{error}</span><button onClick={onClose}>Cancelar</button><button className="primary" disabled={!progress.canSave} onClick={save}>Guardar inspección ({progress.selectedCount})</button></>}>
    <section className="lco-inspection-general"><label>Fecha<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Técnico / Inspector<input value={inspector} onChange={(event) => setInspector(event.target.value)} placeholder="Opcional" /></label><label>Observación general<input value={observations} onChange={(event) => setObservations(event.target.value)} placeholder="Opcional" /></label></section>
    <LcoPhotoPicker photos={generalPhotos} onChange={setGeneralPhotos} label="Agregar fotos generales" />
    <div className="lco-inspection-progress"><strong>{progress.selectedCount}</strong><span>seleccionados</span><strong>{progress.evaluatedCount}</strong><span>evaluados</span><i style={{ width: `${progress.selectedCount ? (progress.evaluatedCount / progress.selectedCount) * 100 : 0}%` }} /></div>
    <p className="lco-keyboard-hint">Selecciona sólo lo inspeccionado. Usa 1–5 para asignar desgaste; el foco avanza automáticamente. Enter salta al siguiente.</p>
    <div className="lco-inspection-grid">{LCO_CAGE_NUMBERS.map((cageNumber) => {
      const cageIds = getCouplingsForCage(cageNumber).map((coupling) => coupling.id)
      const count = cageIds.filter((id) => selected[id]).length
      return <section key={cageNumber}><header><div><h3>J{cageNumber}</h3><small>{count}/4 seleccionados</small></div><button className={count === 4 ? 'active' : ''} onClick={() => toggleCage(cageNumber)}>{count === 4 ? 'Quitar J' : 'Seleccionar J'}{cageNumber}</button></header>{LCO_SHAFT_POSITIONS.map((shaftPosition) => {
        const shaftCouplings = getCouplingsForShaft(cageNumber, shaftPosition)
        const bothSelected = shaftCouplings.every((coupling) => selected[coupling.id])
        return <div className="lco-inspection-shaft" key={shaftPosition}><div className="lco-inspection-shaft-header"><strong>{shaftPosition === 'UPPER' ? 'SUPERIOR' : 'INFERIOR'}</strong><button className={bothSelected ? 'active' : ''} onClick={() => toggleShaft(cageNumber, shaftPosition)}>{bothSelected ? 'Quitar ambos' : 'Seleccionar ambos'}</button></div>{shaftCouplings.map((coupling) => {
          const isSelected = Boolean(selected[coupling.id])
          const isActive = activeCouplingId === coupling.id
          return <div className={`lco-reading-row ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`} key={coupling.id}><label><input type="checkbox" checked={isSelected} onChange={(event) => toggleCoupling(coupling.id, event.target.checked)} /><span>{coupling.side === 'GEARBOX' ? 'REDUCTOR' : 'JAULA'}</span></label>{isSelected ? <><div className="lco-wear-picker" onFocus={() => setActiveCouplingId(coupling.id)}>{COUPLING_WEAR_LEVELS.map((level) => <button aria-label={`${couplingTitle(coupling)} desgaste ${level}`} className={`wear-${level} ${wear[coupling.id] === level ? 'active' : ''}`} key={level} onClick={() => assignWear(coupling.id, level)}>{level}</button>)}</div><button className="lco-note-toggle" onClick={() => setDetailsOpen((current) => ({ ...current, [coupling.id]: !current[coupling.id] }))}>{detailsOpen[coupling.id] ? 'Ocultar detalle' : notes[coupling.id] || conditionCodes[coupling.id] ? 'Editar nota' : '+ Nota'}</button><LcoPhotoPicker compact photos={readingPhotos[coupling.id] ?? []} onChange={(photos) => setReadingPhotos((current) => ({ ...current, [coupling.id]: photos }))} label="Foto" />{detailsOpen[coupling.id] && <div className="lco-reading-details"><input className="lco-reading-note" value={notes[coupling.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [coupling.id]: event.target.value }))} placeholder="Nota opcional" /><select aria-label={`Condición ${couplingTitle(coupling)}`} value={conditionCodes[coupling.id] ?? ''} onChange={(event) => setConditionCodes((current) => ({ ...current, [coupling.id]: event.target.value as CouplingConditionCode || undefined }))}><option value="">Condición opcional</option>{COUPLING_CONDITION_CODES.map((code) => <option key={code} value={code}>{conditionCodeLabel(code)}</option>)}</select></div>}</> : <span className="lco-select-prompt">Seleccionar posición</span>}</div>
        })}</div>
      })}</section>
    })}</div>
  </LcoDialog>
}

function CouplingReplacementDialog({ couplingId, onClose }: { couplingId: string; onClose: () => void }) {
  const record = useMaintenanceStore((state) => state.recordLcoCouplingReplacement)
  const coupling = getLcoCouplingById(couplingId)!
  const [wearAtRemoval, setWearAtRemoval] = useState<CouplingWearLevel | null>(null)
  const [photos, setPhotos] = useState<LcoPhotoAttachment[]>([])
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); record({ couplingId, date: String(data.get('date')), inspector: String(data.get('inspector') || ''), reason: String(data.get('reason') || ''), sapWorkOrder: String(data.get('sapWorkOrder') || ''), notes: String(data.get('notes') || ''), wearAtRemoval, attachments: photos }); onClose() }
  return <LcoDialog title="Cambiar acoplamiento" subtitle={couplingTitle(coupling)} onClose={onClose}><form className="lco-event-form" onSubmit={submit}><label>Fecha<input name="date" type="date" required defaultValue={todayDateOnly()} /></label><label>Técnico / Inspector<input name="inspector" placeholder="Opcional" /></label><label>Motivo<input name="reason" placeholder="Opcional" /></label><label>OT SAP<input name="sapWorkOrder" placeholder="Opcional" /></label><label>Desgaste al retiro <span className="lco-wear-picker">{COUPLING_WEAR_LEVELS.map((level) => <button type="button" className={`wear-${level} ${wearAtRemoval === level ? 'active' : ''}`} key={level} onClick={() => setWearAtRemoval(wearAtRemoval === level ? null : level)}>{level}</button>)}</span></label><label>Observación<textarea name="notes" placeholder="Opcional" /></label><LcoPhotoPicker photos={photos} onChange={setPhotos} label="Agregar fotos del recambio" /><p>El nuevo acoplamiento quedará como <strong>N · Nuevo por recambio</strong>, sin crear una inspección ficticia.</p><button className="primary" type="submit">Registrar recambio individual</button></form></LcoDialog>
}

function ShaftReplacementDialog({ cageNumber, shaftPosition, onClose }: { cageNumber: LcoCageNumber; shaftPosition: LcoShaftPosition; onClose: () => void }) {
  const record = useMaintenanceStore((state) => state.recordLcoShaftReplacement)
  const [photos, setPhotos] = useState<LcoPhotoAttachment[]>([])
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); record({ cageNumber, shaftPosition, date: String(data.get('date')), inspector: String(data.get('inspector') || ''), reason: String(data.get('reason') || ''), sapWorkOrder: String(data.get('sapWorkOrder') || ''), notes: String(data.get('notes') || ''), attachments: photos }); onClose() }
  return <LcoDialog title="Cambiar alunga completa" subtitle={`J${cageNumber} · ${shaftPosition === 'UPPER' ? 'Superior' : 'Inferior'}`} onClose={onClose}><form className="lco-event-form" onSubmit={submit}><label>Fecha<input name="date" type="date" required defaultValue={todayDateOnly()} /></label><label>Técnico / Inspector<input name="inspector" placeholder="Opcional" /></label><label>Motivo<input name="reason" placeholder="Opcional" /></label><label>OT SAP<input name="sapWorkOrder" placeholder="Opcional" /></label><label>Observación<textarea name="notes" placeholder="Opcional" /></label><LcoPhotoPicker photos={photos} onChange={setPhotos} label="Agregar fotos del cambio de alunga" /><p>Este único evento reemplaza la alunga y deriva ambos extremos —Reductor y Jaula— como nuevos instalados. La alunga conserva sólo su fecha e historial de recambio.</p><button className="primary" type="submit">Registrar cambio de alunga</button></form></LcoDialog>
}

function CouplingDetail({ couplingId, onClose, onInspect, onReplace, onEditControl, onOpenPhotos }: { couplingId: string; onClose: () => void; onInspect: (id: string) => void; onReplace: (id: string) => void; onEditControl: (eventId: string, couplingId: string) => void; onOpenPhotos: (photos: LcoPhotoAttachment[]) => void }) {
  const data = useMaintenanceStore((state) => state.lcoCouplings); const referenceDate = useMaintenanceStore((state) => state.referenceDate)
  const coupling = getLcoCouplingById(couplingId)!; const state = getLcoCouplingState(data, couplingId, referenceDate); const history = getLcoCouplingHistory(data, couplingId)
  const evolution = history.slice().reverse()
  const photos = uniquePhotos(history.flatMap((entry) => entry.attachments))
  const latest = state.lastInspection
  return <LcoDetailDrawer title={`J${coupling.cageNumber} · ALUNGA ${coupling.shaftPosition === 'UPPER' ? 'SUPERIOR' : 'INFERIOR'}`} code={`ACOPLAMIENTO LADO ${coupling.side === 'GEARBOX' ? 'REDUCTOR' : 'JAULA'}`} onClose={onClose}><CurrentState state={state} referenceDate={referenceDate} />{latest && <section className="lco-coupling-facts"><span><small>INSPECTOR</small><strong>{latest.event.inspector || 'Sin informar'}</strong></span><span><small>CONDICIÓN</small><strong>{latest.conditionCode ? conditionCodeLabel(latest.conditionCode) : 'Sin informar'}</strong></span>{(latest.note || latest.event.observations) && <span className="wide"><small>OBSERVACIÓN</small><strong>{latest.note || latest.event.observations}</strong></span>}</section>}<CouplingPhotoEvidence photos={photos} onOpen={onOpenPhotos} /><div className="lco-detail-actions"><button className="primary" onClick={() => onInspect(couplingId)}>Registrar inspección</button>{latest && <button className="edit" onClick={() => onEditControl(latest.event.id, couplingId)}>Editar último control</button>}<button onClick={() => onReplace(couplingId)}>Cambiar acoplamiento</button></div><section><h3>Evolución de desgaste</h3>{evolution.length ? <div className="lco-wear-evolution">{evolution.map((entry) => <span key={`${entry.eventId}-${entry.type}`}><time>{formatDate(entry.date)}</time><strong className={entry.type === 'INSPECTION' ? `wear-text-${entry.wearLevel}` : entry.type === 'COUPLING_REPLACEMENT' ? 'wear-text-new' : 'wear-text-none'}>{entry.type === 'INSPECTION' ? `${entry.wearLevel}/5` : entry.type === 'COUPLING_REPLACEMENT' ? 'N' : '—'}</strong></span>)}</div> : <p className="maintenance-empty">Sin eventos registrados.</p>}</section><HistoryList entries={history} onOpenPhotos={onOpenPhotos} onEditControl={(eventId) => onEditControl(eventId, couplingId)} /></LcoDetailDrawer>
}

function CouplingPhotoEvidence({ photos, onOpen }: { photos: LcoPhotoAttachment[]; onOpen: (photos: LcoPhotoAttachment[]) => void }) {
  if (!photos.length) return <section className="lco-coupling-evidence empty"><div><small>EVIDENCIA FOTOGRÁFICA</small><strong>Sin fotos cargadas</strong><span>Las imágenes de futuras inspecciones aparecerán aquí.</span></div></section>
  return <section className="lco-coupling-evidence"><button className="lco-evidence-hero" onClick={() => onOpen(photos)}><img src={photos[0].dataUrl} alt={photos[0].caption || 'Evidencia principal del acoplamiento'} /><span>Ver {photos.length === 1 ? 'foto' : `${photos.length} fotos`}</span></button><div><small>EVIDENCIA FOTOGRÁFICA</small><strong>{photos.length} {photos.length === 1 ? 'imagen disponible' : 'imágenes disponibles'}</strong>{photos[0].caption && <span>{photos[0].caption}</span>}<div className="lco-evidence-thumbs">{photos.slice(0, 4).map((photo, index) => <button key={`${photo.createdAt}-${index}`} onClick={() => onOpen(photos)}><img src={photo.dataUrl} alt={photo.caption || `Evidencia ${index + 1}`} /></button>)}</div></div></section>
}

function ShaftDetail({ shaftId, onClose, onInspect, onReplace, onOpenPhotos }: { shaftId: string; onClose: () => void; onInspect: (ids: string[]) => void; onReplace: (cage: LcoCageNumber, position: LcoShaftPosition) => void; onOpenPhotos: (photos: LcoPhotoAttachment[]) => void }) {
  const data = useMaintenanceStore((state) => state.lcoCouplings); const referenceDate = useMaintenanceStore((state) => state.referenceDate); const shaft = getLcoShaftById(shaftId)!; const state = getLcoShaftState(data, shaft.cageNumber, shaft.position, referenceDate)
  const installedDays = state.lastShaftReplacement ? differenceInCalendarDays(referenceDate, state.lastShaftReplacement.date) : null
  return <LcoDetailDrawer title={`J${shaft.cageNumber} · ALUNGA ${shaft.position === 'UPPER' ? 'SUPERIOR' : 'INFERIOR'}`} code={shaft.id} onClose={onClose}><div className="lco-shaft-current">{state.couplings.map((couplingState) => { const coupling = getLcoCouplingById(couplingState.couplingId)!; return <article key={couplingState.couplingId}><small>{coupling.side === 'GEARBOX' ? 'ACOPLAMIENTO LADO REDUCTOR' : 'ACOPLAMIENTO LADO JAULA'}</small><strong className={couplingState.wearSource === 'REPLACEMENT' ? 'wear-text-new' : `wear-text-${couplingState.currentWearLevel ?? 'none'}`}>{couplingDisplayValue(couplingState)}</strong><span>{couplingState.wearSource === 'REPLACEMENT' ? 'Nuevo por recambio' : couplingState.currentWearLevel ? couplingWearLabels[couplingState.currentWearLevel] : 'Sin datos'}</span><em>Última inspección: {couplingState.lastInspection ? formatDate(couplingState.lastInspection.event.date) : '—'}</em></article> })}</div><section className="lco-shaft-installation"><span>Último cambio de alunga<strong>{state.lastShaftReplacement ? formatDate(state.lastShaftReplacement.date) : 'Sin registro'}</strong></span><span>Tiempo instalada<strong>{installedDays === null ? '—' : `${installedDays} días`}</strong></span></section><div className="lco-detail-actions"><button className="primary" onClick={() => onInspect(shaft.couplingIds)}>Inspeccionar acoplamientos</button><button onClick={() => onReplace(shaft.cageNumber, shaft.position)}>Cambiar alunga completa</button></div><HistoryList entries={state.history} onOpenPhotos={onOpenPhotos} /></LcoDetailDrawer>
}

function CurrentState({ state, referenceDate }: { state: LcoCouplingState; referenceDate: string }) {
  const replacementDays = state.lastReplacement ? differenceInCalendarDays(referenceDate, state.lastReplacement.date) : null
  return <section className="lco-current-state"><article><small>ESTADO ACTUAL</small><strong className={state.wearSource === 'REPLACEMENT' ? 'wear-text-new' : `wear-text-${state.currentWearLevel ?? 'none'}`}>{couplingDisplayValue(state)}</strong><span>{state.wearSource === 'REPLACEMENT' ? 'Nuevo por recambio' : state.currentWearLevel ? couplingWearLabels[state.currentWearLevel] : 'Sin datos'}</span>{state.wearSource === 'REPLACEMENT' && <em>Aún no inspeccionado</em>}</article><article><small>ÚLTIMA INSPECCIÓN</small><strong>{state.lastInspection ? formatDate(state.lastInspection.event.date) : '—'}</strong><span>{state.daysSinceInspection === null ? 'Sin inspección' : `Hace ${state.daysSinceInspection} días`}</span><em>{freshnessLabel(state)}</em></article><article><small>ÚLTIMO RECAMBIO</small><strong>{state.lastReplacement ? formatDate(state.lastReplacement.date) : '—'}</strong><span>{replacementDays === null ? 'Sin registro' : `Hace ${replacementDays} días`}</span><em>{state.lastReplacement?.sapWorkOrder ? `OT ${state.lastReplacement.sapWorkOrder}` : 'Sin OT'}</em></article></section>
}

function HistoryList({ entries, onOpenPhotos, onEditControl }: { entries: ReturnType<typeof getLcoCouplingHistory>; onOpenPhotos: (photos: LcoPhotoAttachment[]) => void; onEditControl?: (eventId: string) => void }) {
  return <section><h3>Historial</h3>{entries.length ? <div className="lco-history-list">{entries.map((entry) => <article key={`${entry.eventId}-${entry.type}-${entry.couplingId}`}><time>{formatHistoryDate(entry.date)}</time><div><strong>{entry.title}</strong>{entry.note && <p>{entry.note}</p>}{entry.sapWorkOrder && <small>OT SAP · {entry.sapWorkOrder}</small>}<span className="lco-history-inline-actions">{entry.attachments.length > 0 && <button className="lco-photo-count" onClick={() => onOpenPhotos(entry.attachments)}>📷 {entry.attachments.length}</button>}{entry.type === 'INSPECTION' && onEditControl && <button onClick={() => onEditControl(entry.eventId)}>Editar</button>}</span></div>{entry.type === 'INSPECTION' && entry.wearLevel && <span className={`wear-${entry.wearLevel}`}>{entry.wearLevel}</span>}{entry.type === 'COUPLING_REPLACEMENT' && <span className="wear-new">N</span>}</article>)}</div> : <p className="maintenance-empty">Sin eventos registrados.</p>}</section>
}

function uniquePhotos(photos: LcoPhotoAttachment[]) {
  const seen = new Set<string>()
  return photos.filter((photo) => { const key = `${photo.createdAt}|${photo.dataUrl}`; if (seen.has(key)) return false; seen.add(key); return true })
}

function LcoSettingsDialog({ onClose }: { onClose: () => void }) {
  const maintenance = useMaintenanceStore()
  const current = maintenance.lcoCouplings.inspectionAgeThresholds
  const [recentDays, setRecentDays] = useState(current.recentDays)
  const [dueDays, setDueDays] = useState(current.dueDays)
  const [oldDays, setOldDays] = useState(current.oldDays)
  const valid = recentDays > 0 && dueDays > recentDays && oldDays > dueDays
  const save = () => {
    if (!valid) return
    maintenance.setLcoInspectionAgeThresholds({ recentDays, dueDays, oldDays })
    maintenance.setLcoFreshnessThresholds({ staleDays: recentDays, veryStaleDays: oldDays })
    onClose()
  }
  return <LcoDialog title="Configuración Acoplamientos LCO" subtitle="ANTIGÜEDAD DE CONTROLES" onClose={onClose} footer={<><button onClick={onClose}>Cancelar</button><button className="primary" disabled={!valid} onClick={save}>Guardar configuración</button></>}><p className="lco-settings-intro">Definí cuándo un control pasa de reciente a próximo, antiguo y muy antiguo. Estos estados dependen únicamente de la fecha de inspección, no del desgaste.</p><section className="lco-settings-thresholds"><label>Control reciente hasta<input type="number" min="1" value={recentDays} onChange={(event) => setRecentDays(Number(event.target.value))} /><span>días</span></label><label>Control próximo hasta<input type="number" min={recentDays + 1} value={dueDays} onChange={(event) => setDueDays(Number(event.target.value))} /><span>días</span></label><label>Control antiguo hasta<input type="number" min={dueDays + 1} value={oldDays} onChange={(event) => setOldDays(Number(event.target.value))} /><span>días</span></label></section>{!valid && <p className="lco-settings-error">Los límites deben ser crecientes. Ejemplo recomendado: 30 / 60 / 90 días.</p>}<div className="lco-settings-preview"><span>0–{recentDays}: reciente</span><span>{recentDays + 1}–{dueDays}: próximo</span><span>{dueDays + 1}–{oldDays}: antiguo</span><span>&gt; {oldDays}: muy antiguo</span></div></LcoDialog>
}

function LcoDialog({ title, subtitle, wide, onClose, children, footer }: { title: string; subtitle: string; wide?: boolean; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  return <div className="lco-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className={`lco-dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true"><header><div><small>{subtitle}</small><h2>{title}</h2></div><button aria-label="Cerrar" onClick={onClose}>×</button></header><div className="lco-dialog-body">{children}</div>{footer && <footer>{footer}</footer>}</section></div>
}

function LcoDetailDrawer({ title, code, onClose, children }: { title: string; code: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  return <div className="lco-detail-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><aside className="lco-detail-drawer" role="dialog" aria-modal="true" aria-label={`${code} · ${title}`}><header><div><small>{code}</small><h2>{title}</h2></div><button aria-label="Cerrar detalle" onClick={onClose}>×</button></header><div className="lco-detail-body">{children}</div></aside></div>
}

function freshnessLabel(state: LcoCouplingState) { return ({ FRESH: 'Dato reciente', STALE: 'Dato desactualizado', VERY_STALE: 'Dato muy desactualizado', NO_INSPECTION: 'Sin inspección registrada' } as const)[state.freshness] }
function couplingTitle(coupling: LcoCoupling) { return `J${coupling.cageNumber} · ${coupling.shaftPosition === 'UPPER' ? 'Superior' : 'Inferior'} · Lado ${coupling.side === 'GEARBOX' ? 'Reductor' : 'Jaula'}` }
function couplingDisplayValue(state: LcoCouplingState) { return state.wearSource === 'REPLACEMENT' ? 'N' : state.currentWearLevel ? `${state.currentWearLevel}/5` : '—' }
function couplingWearLabel(level: CouplingWearLevel) { return level === 1 ? 'Nuevo / muy bueno' : level === 2 ? 'Bueno' : level === 3 ? 'Regular' : level === 4 ? 'Desgastado' : 'Crítico' }
function conditionCodeLabel(code: CouplingConditionCode) { return ({ NORMAL: 'Normal', JUEGO: 'Juego', DESGASTE_DIENTES: 'Desgaste de dientes', MARCAS: 'Marcas', FISURA: 'Fisura', LUBRICACION: 'Lubricación', OTRO: 'Otro' } as const)[code] }
function formatDate(value: string) { return displayDate.format(new Date(`${value}T00:00:00Z`)) }
function formatHistoryDate(value: string) { return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)).toUpperCase() }

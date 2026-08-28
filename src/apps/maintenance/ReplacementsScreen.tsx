import { useMemo, useState } from 'react'
import { AREA_FILTER_ALL, PLANT_AREAS, areaLabel } from '../../config/areas'
import { ALL_LEVELS, LEVEL_0, LEVEL_1 } from '../../config/plantLevels'
import { GlobalTaskCatalog } from '../../maintenance/components/GlobalTaskCatalog'
import { intervalLabel, replacementStatusLabels, replacementTimingLabel } from '../../maintenance/components/replacementPresentation'
import { GLOBAL_MAINTENANCE_CATALOG } from '../../maintenance/data/globalMaintenanceCatalog'
import { getReplacementRows } from '../../maintenance/domain/maintenanceSelectors'
import type { OperationalReplacementStatus } from '../../maintenance/domain/maintenanceTypes'
import { useMaintenanceStore } from '../../maintenance/store/maintenanceStore'
import { navigate } from '../../shared/navigation'
import { useSceneStore } from '../../store/sceneStore'

type QuickFilter = 'ALL' | 'OVERDUE' | 'NEXT_30' | 'NEXT_60' | 'NO_DATA'
type ReplacementView = 'GLOBAL' | 'TRACKING'

export function ReplacementsScreen() {
  const maintenance = useMaintenanceStore()
  const assets = useSceneStore((state) => state.objects)
  const rows = useMemo(() => getReplacementRows(maintenance, assets, maintenance.referenceDate), [maintenance.equipment, maintenance.subassemblies, maintenance.plans, maintenance.events, maintenance.referenceDate, assets])
  const [view, setView] = useState<ReplacementView>('GLOBAL')
  const [area, setArea] = useState(AREA_FILTER_ALL)
  const [level, setLevel] = useState(ALL_LEVELS)
  const [status, setStatus] = useState<'ALL' | OperationalReplacementStatus>('ALL')
  const [equipment, setEquipment] = useState('ALL')
  const [query, setQuery] = useState('')
  const [quick, setQuick] = useState<QuickFilter>('ALL')
  const equipmentOptions = useMemo(() => [...new Map(rows.map((row) => [row.asset.id, row.asset])).values()].sort((a, b) => a.name.localeCompare(b.name)), [rows])
  const filtered = rows.filter((row) => {
    const q = query.trim().toLocaleLowerCase()
    const matchesQuery = !q || [row.asset.id, row.asset.name, row.functionalPosition.id, row.functionalPosition.name, row.functionalPosition.sapId].some((value) => value.toLocaleLowerCase().includes(q))
    const matchesQuick = quick === 'ALL'
      || (quick === 'OVERDUE' && row.state.operationalStatus === 'OVERDUE')
      || (quick === 'NO_DATA' && row.state.operationalStatus === 'NO_DATA')
      || (quick === 'NEXT_30' && row.state.daysRemaining !== null && row.state.daysRemaining >= 0 && row.state.daysRemaining <= 30)
      || (quick === 'NEXT_60' && row.state.daysRemaining !== null && row.state.daysRemaining >= 0 && row.state.daysRemaining <= 60)
    return matchesQuery && matchesQuick
      && (area === AREA_FILTER_ALL || row.asset.areaCode === area)
      && (level === ALL_LEVELS || row.asset.levelCode === level)
      && (status === 'ALL' || row.state.operationalStatus === status)
      && (equipment === 'ALL' || row.asset.id === equipment)
  })
  const viewInPlant = (assetId: string, positionId: string) => navigate(`/maintenance/twin?equipment=${encodeURIComponent(assetId)}&position=${encodeURIComponent(positionId)}`)

  return <main className="replacements-screen">
    <header><div><small>MAINTENANCE OPERATIONS</small><h1>Recambios</h1><p>{view === 'GLOBAL' ? 'Base global de tareas, subconjuntos e historial REX de la planta.' : 'Estado de las posiciones funcionales vinculadas al modelo 3D.'}</p></div>{view === 'TRACKING' && <label>Fecha de referencia<input type="date" value={maintenance.referenceDate} onChange={(event) => maintenance.setReferenceDate(event.target.value)} /></label>}</header>
    <nav className="replacement-view-tabs" aria-label="Vistas de recambios">
      <button className={view === 'GLOBAL' ? 'active' : ''} onClick={() => setView('GLOBAL')}><span>Base global REX</span><strong>{GLOBAL_MAINTENANCE_CATALOG.tasks.length}</strong></button>
      <button className={view === 'TRACKING' ? 'active' : ''} onClick={() => setView('TRACKING')}><span>Seguimiento 3D</span><strong>{rows.length}</strong></button>
    </nav>
    {view === 'GLOBAL' ? <GlobalTaskCatalog /> : <>
      <div className="replacement-quick-filters">{([['ALL', 'Todos'], ['OVERDUE', 'Vencidos'], ['NEXT_30', 'Próximos 30 días'], ['NEXT_60', 'Próximos 60 días'], ['NO_DATA', 'Sin datos']] as const).map(([value, label]) => <button key={value} className={quick === value ? 'active' : ''} onClick={() => setQuick(value)}>{label}</button>)}</div>
      <section className="replacement-filters"><label>Buscar<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Equipo, posición, SAP..." /></label><label>Área<select value={area} onChange={(event) => setArea(event.target.value as typeof area)}><option value={AREA_FILTER_ALL}>Todas</option>{PLANT_AREAS.map((item) => <option key={item.code} value={item.code}>{areaLabel(item.code)}</option>)}</select></label><label>Nivel<select value={level} onChange={(event) => setLevel(event.target.value as typeof level)}><option value={ALL_LEVELS}>Todos</option><option value={LEVEL_0}>Nivel 0</option><option value={LEVEL_1}>Nivel 1</option></select></label><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="ALL">Todos</option>{(['OVERDUE', 'DUE_SOON', 'CURRENT', 'NO_DATA'] as const).map((value) => <option key={value} value={value}>{replacementStatusLabels[value]}</option>)}</select></label><label>Equipo<select value={equipment} onChange={(event) => setEquipment(event.target.value)}><option value="ALL">Todos</option>{equipmentOptions.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label></section>
      <div className="replacement-table-wrap"><table className="replacement-table"><thead><tr><th>Equipo</th><th>Posición funcional</th><th>Área</th><th>Último recambio</th><th>Vida esperada</th><th>Vencimiento</th><th>Estado</th><th /></tr></thead><tbody>{filtered.map((row) => <tr key={row.functionalPosition.id}><td><strong>{row.asset.name}</strong><small>{row.asset.id}</small></td><td><strong>{row.functionalPosition.name}</strong><small>{row.functionalPosition.sapId || row.functionalPosition.id}</small></td><td>{areaLabel(row.asset.areaCode)}<small>{row.asset.levelCode}</small></td><td>{row.state.lastEventDate ?? '-'}</td><td>{row.plan ? intervalLabel(row.plan.intervalValue, row.plan.intervalUnit) : '-'}</td><td>{row.state.nextDueDate ?? '-'}</td><td><span className={`maintenance-chip status-${row.state.operationalStatus}`}>{replacementStatusLabels[row.state.operationalStatus]}</span><small>{replacementTimingLabel(row.state)}</small></td><td><button onClick={() => viewInPlant(row.asset.id, row.functionalPosition.id)}>Ver en planta</button></td></tr>)}{!filtered.length && <tr><td colSpan={8} className="maintenance-empty">No hay posiciones que coincidan con los filtros.</td></tr>}</tbody></table></div>
    </>}
  </main>
}

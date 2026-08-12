import { useMemo } from 'react'
import { AREA_FILTER_ALL, PLANT_AREAS, areaLabel } from '../../config/areas'
import { ALL_LEVELS, LEVEL_0, LEVEL_1, isLevelVisible } from '../../config/plantLevels'
import { getMaintenanceAssetVisualStateMap, getReplacementKpis } from '../../maintenance/domain/maintenanceSelectors'
import { searchMaintenance } from '../../maintenance/domain/maintenanceSearch'
import type { OperationalReplacementStatus } from '../../maintenance/domain/maintenanceTypes'
import { useMaintenanceStore } from '../../maintenance/store/maintenanceStore'
import { useSceneStore } from '../../store/sceneStore'

const labels: Record<OperationalReplacementStatus, string> = { CURRENT: 'Vigente', DUE_SOON: 'Próximo a vencer', OVERDUE: 'Vencido', NO_DATA: 'Sin datos', INACTIVE: 'Inactivo' }
const statuses: OperationalReplacementStatus[] = ['OVERDUE', 'DUE_SOON', 'CURRENT', 'NO_DATA']

export function MaintenanceSidebar({ query }: { query: string }) {
  const maintenance = useMaintenanceStore()
  const scene = useSceneStore()
  const visualMap = useMemo(() => getMaintenanceAssetVisualStateMap(maintenance, scene.objects, maintenance.referenceDate), [maintenance.equipment, maintenance.subassemblies, maintenance.plans, maintenance.events, maintenance.referenceDate, scene.objects])
  const kpis = useMemo(() => getReplacementKpis(maintenance, maintenance.referenceDate), [maintenance.subassemblies, maintenance.plans, maintenance.events, maintenance.referenceDate])
  const grouped = useMemo(() => searchMaintenance(maintenance, scene.objects, query), [query, maintenance.equipment, maintenance.subassemblies, maintenance.events, scene.objects])
  const chooseAsset = (assetId: string, functionalPositionId?: string) => { scene.focusObject(assetId); if (functionalPositionId) maintenance.openSubassembly(functionalPositionId) }
  const focusResults = () => {
    const ids = scene.objects.filter((asset) => {
      const status = visualMap.get(asset.id)?.status
      return (maintenance.areaFilter === AREA_FILTER_ALL || asset.areaCode === maintenance.areaFilter) && isLevelVisible(asset.levelCode, maintenance.levelFilter) && (maintenance.statusFilter === 'ALL' || status === maintenance.statusFilter) && (maintenance.criticalityFilter === 'ALL' || asset.criticality === maintenance.criticalityFilter)
    }).map((asset) => asset.id)
    if (!ids.length) return
    scene.selectOnly(ids[0]); ids.slice(1).forEach(scene.toggleObjectSelection); scene.requestCameraView('fit_selection')
  }
  return <aside className="maintenance-sidebar">
    {query ? <section><h3>Resultados</h3>
      {!!grouped.equipment.length && <ResultGroup title="Equipos" items={grouped.equipment.map(({ equipment, asset }) => ({ id: asset.id, primary: asset.name, secondary: equipment?.id ?? asset.id, action: () => chooseAsset(asset.id) }))} />}
      {!!grouped.functionalPositions.length && <ResultGroup title="Posiciones funcionales" items={grouped.functionalPositions.map(({ functionalPosition, asset }) => ({ id: functionalPosition.id, primary: functionalPosition.name, secondary: functionalPosition.sapId || functionalPosition.id, action: () => chooseAsset(asset.id, functionalPosition.id) }))} />}
      {!!grouped.events.length && <ResultGroup title="Eventos" items={grouped.events.map(({ event, functionalPosition, asset }) => ({ id: event.id, primary: event.workOrder || event.type, secondary: `${event.date} · ${functionalPosition.name}`, action: () => chooseAsset(asset.id, functionalPosition.id) }))} />}
      {!grouped.equipment.length && !grouped.functionalPositions.length && !grouped.events.length && <p className="maintenance-empty">Sin resultados.</p>}
    </section> : <>
      <section><h3>Recambios</h3><div className="maintenance-overview-list">{statuses.map((status) => <button key={status} className={maintenance.statusFilter === status ? 'active' : ''} onClick={() => maintenance.setStatusFilter(maintenance.statusFilter === status ? 'ALL' : status)}><span className={`status-dot status-${status}`} />{labels[status]}<strong>{kpis[status]}</strong></button>)}</div><p className="maintenance-kpi-note">{kpis.equipmentWithOverdueCount} equipos con posiciones vencidas</p></section>
      <section><h3>Filtros de planta</h3><label>Área<select value={maintenance.areaFilter} onChange={(event) => maintenance.setAreaFilter(event.target.value as typeof maintenance.areaFilter)}><option value={AREA_FILTER_ALL}>Todas las áreas</option>{PLANT_AREAS.map((area) => <option key={area.code} value={area.code}>{areaLabel(area.code)}</option>)}</select></label><label>Nivel<select value={maintenance.levelFilter} onChange={(event) => maintenance.setLevelFilter(event.target.value as typeof maintenance.levelFilter)}><option value={ALL_LEVELS}>Todos</option><option value={LEVEL_0}>Nivel 0</option><option value={LEVEL_1}>Nivel 1</option></select></label><label>Estado<select value={maintenance.statusFilter} onChange={(event) => maintenance.setStatusFilter(event.target.value as typeof maintenance.statusFilter)}><option value="ALL">Todos</option>{statuses.map((status) => <option key={status} value={status}>{labels[status]}</option>)}</select></label><label>Criticidad<select value={maintenance.criticalityFilter} onChange={(event) => maintenance.setCriticalityFilter(event.target.value as typeof maintenance.criticalityFilter)}><option value="ALL">Todas</option><option>A</option><option>B</option><option>C</option><option>D</option></select></label><div className="maintenance-filter-mode"><button className={maintenance.filterBehavior === 'DIM' ? 'active' : ''} onClick={() => maintenance.setFilterBehavior('DIM')}>Atenuar</button><button className={maintenance.filterBehavior === 'HIDE' ? 'active' : ''} onClick={() => maintenance.setFilterBehavior('HIDE')}>Ocultar</button></div><button className="maintenance-focus-results" onClick={focusResults}>Enfocar resultados</button></section>
    </>}
  </aside>
}

function ResultGroup({ title, items }: { title: string; items: Array<{ id: string; primary: string; secondary: string; action: () => void }> }) { return <div className="maintenance-result-group"><h4>{title}</h4>{items.slice(0, 12).map((item) => <button key={item.id} onClick={item.action}><strong>{item.primary}</strong><small>{item.secondary}</small></button>)}</div> }

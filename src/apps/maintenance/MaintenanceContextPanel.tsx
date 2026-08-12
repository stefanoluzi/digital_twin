import { useEffect, useMemo, useState } from 'react'
import { areaLabel } from '../../config/areas'
import { MaintenancePanel } from '../../maintenance/components/MaintenancePanel'
import { ReplacementDetail } from '../../maintenance/components/ReplacementDetail'
import { getEquipmentForAsset, getEventsForSubassembly, getMaintenanceAssetVisualStateMap, getPlanForSubassembly, getReplacementKpis, getSubassembliesForEquipment, getSubassemblyState } from '../../maintenance/domain/maintenanceSelectors'
import { useMaintenanceStore } from '../../maintenance/store/maintenanceStore'
import { navigate } from '../../shared/navigation'
import { useSceneStore } from '../../store/sceneStore'

type ContextTab = 'SUMMARY' | 'POSITIONS' | 'TIMELINE' | 'EXPECTED_LIFE'
const tabLabels: Record<ContextTab, string> = { SUMMARY: 'RESUMEN', POSITIONS: 'POSICIONES', TIMELINE: 'HISTORIAL', EXPECTED_LIFE: 'VIDA ESPERADA' }

export function MaintenanceContextPanel() {
  const maintenance = useMaintenanceStore(); const scene = useSceneStore(); const [tab, setTab] = useState<ContextTab>('SUMMARY'); const asset = scene.objects.find((item) => item.id === scene.selectedObjectId)
  useEffect(() => { setTab('SUMMARY') }, [asset?.id])
  if (!asset) return <aside className="maintenance-context"><div className="maintenance-context-title"><strong>Resumen de Recambios</strong><small>Selecciona un equipo en la planta</small></div><MaintenanceOverviewSummary /></aside>
  const equipment = getEquipmentForAsset(maintenance, asset.id); const positions = equipment ? getSubassembliesForEquipment(maintenance, equipment.id) : []; const visualState = getMaintenanceAssetVisualStateMap(maintenance, [asset], maintenance.referenceDate).get(asset.id)
  const allEvents = positions.flatMap((item) => getEventsForSubassembly(maintenance, item.id).map((event) => ({ ...event, positionName: item.name }))).sort((a, b) => b.date.localeCompare(a.date)); const latest = allEvents[0]
  return <aside className="maintenance-context"><div className="maintenance-context-title"><div><small>{asset.id}</small><strong>{asset.name}</strong></div><button onClick={() => navigate(`/editor?asset=${encodeURIComponent(asset.id)}`)}>Abrir en Editor</button></div><div className="maintenance-context-tabs" role="tablist">{(['SUMMARY', 'POSITIONS', 'TIMELINE', 'EXPECTED_LIFE'] as const).map((item) => <button role="tab" aria-selected={tab === item} className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}>{tabLabels[item]}</button>)}</div><div className="maintenance-context-body">
    {tab === 'SUMMARY' && <><div className="maintenance-equipment-meta"><span><small>ID</small>{asset.id}</span><span><small>Área</small>{areaLabel(asset.areaCode)}</span><span><small>Nivel</small>{asset.levelCode}</span><span><small>Criticidad</small>{asset.criticality || '-'}</span></div><div className={`maintenance-equipment-state status-${visualState?.status}`}><small>Estado de recambios</small><strong>{visualState?.status === 'OVERDUE' ? 'Vencido' : visualState?.status === 'DUE_SOON' ? 'Próximo a vencer' : visualState?.status === 'CURRENT' ? 'Vigente' : 'Sin datos'}</strong><span>{visualState?.total ?? 0} posiciones funcionales</span></div><dl className="maintenance-facts"><dt>Último evento</dt><dd>{latest ? `${latest.date} · ${latest.type} · ${latest.positionName}` : 'Sin historial'}</dd></dl></>}
    {tab === 'POSITIONS' && <MaintenancePanel asset={asset} />}
    {tab === 'TIMELINE' && <MaintenancePanel asset={asset} timelineOnly />}
    {tab === 'EXPECTED_LIFE' && <div className="maintenance-plans">{positions.filter((item) => item.trackingMode === 'REPLACEMENT').map((item) => { const plan = getPlanForSubassembly(maintenance, item.id); const state = getSubassemblyState(maintenance, item.id, maintenance.referenceDate); return <button key={item.id} onClick={() => maintenance.openSubassembly(item.id)}><strong>{item.name}</strong><span>{plan ? `Intervalo: ${plan.intervalValue} ${plan.intervalUnit}` : 'Sin vida esperada'}</span><small>Próximo vencimiento: {state?.nextDueDate ?? '-'}</small></button> })}{!positions.length && <p className="maintenance-empty">Sin posiciones funcionales.</p>}</div>}
  </div>{maintenance.drawerOpen && maintenance.selectedSubassemblyId && tab !== 'POSITIONS' && <ReplacementDetail id={maintenance.selectedSubassemblyId} />}</aside>
}

function MaintenanceOverviewSummary() {
  const store = useMaintenanceStore(); const kpis = useMemo(() => getReplacementKpis(store, store.referenceDate), [store.subassemblies, store.plans, store.events, store.referenceDate])
  return <><div className="maintenance-overview-cards">{([['OVERDUE', 'Vencidas'], ['DUE_SOON', 'Próximas'], ['CURRENT', 'Vigentes'], ['NO_DATA', 'Sin datos']] as const).map(([status, label]) => <button key={status} className={`status-${status}`} onClick={() => store.setStatusFilter(status)}><strong>{kpis[status]}</strong><span>{label}</span></button>)}</div><p>{kpis.equipmentWithOverdueCount} equipos con al menos una posición vencida.</p></>
}

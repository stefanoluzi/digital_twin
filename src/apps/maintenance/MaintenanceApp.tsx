import { useEffect, useMemo, useState } from 'react'
import { PlantScene, type AssetVisualState } from '../../components/Scene/PlantScene'
import { getMaintenanceAssetVisualStateMap } from '../../maintenance/domain/maintenanceSelectors'
import { useMaintenanceStore } from '../../maintenance/store/maintenanceStore'
import { useSceneStore } from '../../store/sceneStore'
import { MaintenanceContextPanel } from './MaintenanceContextPanel'
import { MaintenanceSidebar } from './MaintenanceSidebar'
import { MaintenanceTopBar } from './MaintenanceTopBar'
import { ReplacementsScreen } from './ReplacementsScreen'

const visualLabels = { CURRENT: 'Vigente', DUE_SOON: 'Próximo', OVERDUE: 'Vencido', NO_DATA: 'Sin datos', INACTIVE: 'Inactivo' } as const

export function MaintenanceApp() {
  const [query, setQuery] = useState(''); const maintenance = useMaintenanceStore(); const objects = useSceneStore((state) => state.objects); const isReplacements = window.location.pathname === '/maintenance/replacements'
  const rawVisualMap = useMemo(() => getMaintenanceAssetVisualStateMap(maintenance, objects, maintenance.referenceDate), [maintenance.equipment, maintenance.subassemblies, maintenance.plans, maintenance.events, maintenance.referenceDate, objects])
  const assetVisualStates = useMemo(() => new Map<string, AssetVisualState>([...rawVisualMap].map(([assetId, value]) => [assetId, { status: value.status, label: visualLabels[value.status], badgeCount: value.badgeCount, showBadge: value.status === 'OVERDUE' || (maintenance.showOkBadges && value.status !== 'INACTIVE'), outlineColor: value.status === 'OVERDUE' ? '#ff244f' : value.status === 'DUE_SOON' ? '#ff9f1c' : undefined, title: value.title }])), [rawVisualMap, maintenance.showOkBadges])
  const recentAssetIds = useMemo(() => {
    if (!maintenance.recentDays) return null
    const cutoff = new Date(`${maintenance.referenceDate}T00:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate() - maintenance.recentDays)
    const positionIds = new Set(maintenance.events.filter((event) => new Date(`${event.date}T00:00:00Z`) >= cutoff).map((event) => event.subassemblyId)); const equipmentIds = new Set(maintenance.subassemblies.filter((item) => positionIds.has(item.id)).map((item) => item.equipmentId))
    return new Set(maintenance.equipment.filter((item) => equipmentIds.has(item.id)).map((item) => item.assetId))
  }, [maintenance.recentDays, maintenance.referenceDate, maintenance.events, maintenance.subassemblies, maintenance.equipment])
  const nonMatching = useMemo(() => new Set(objects.filter((asset) => (maintenance.statusFilter !== 'ALL' && rawVisualMap.get(asset.id)?.status !== maintenance.statusFilter) || (maintenance.criticalityFilter !== 'ALL' && asset.criticality !== maintenance.criticalityFilter) || Boolean(recentAssetIds && !recentAssetIds.has(asset.id))).map((asset) => asset.id)), [objects, maintenance.statusFilter, maintenance.criticalityFilter, rawVisualMap, recentAssetIds])
  useEffect(() => {
    const scene = useSceneStore.getState(); const store = useMaintenanceStore.getState(); store.setViewMode('MAINTENANCE'); scene.cancelLayoutCalibration(); scene.cancelLayoutCrop()
    if (!isReplacements) {
      scene.clearSelection(); scene.requestCameraView('isometric')
      const params = new URLSearchParams(window.location.search); const requested = params.get('equipment'); const position = params.get('position')
      if (requested && scene.objects.some((asset) => asset.id === requested)) { scene.focusObject(requested); if (position) store.openSubassembly(position) }
    }
    return () => store.setViewMode('NORMAL')
  }, [isReplacements])
  return <div className="module-shell maintenance-module"><MaintenanceTopBar query={query} onQueryChange={setQuery} />{isReplacements ? <ReplacementsScreen /> : <main className="maintenance-workspace"><MaintenanceSidebar query={query} /><PlantScene mode="MAINTENANCE" areaFilter={maintenance.areaFilter} levelFilter={maintenance.levelFilter} assetVisualStates={assetVisualStates} dimmedAssetIds={maintenance.filterBehavior === 'DIM' ? nonMatching : undefined} hiddenAssetIds={maintenance.filterBehavior === 'HIDE' ? nonMatching : undefined} /><MaintenanceContextPanel /></main>}</div>
}

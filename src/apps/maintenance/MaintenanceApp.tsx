import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { PlantScene, type AssetVisualState } from '../../components/Scene/PlantScene'
import { getMaintenanceAssetVisualStateMap } from '../../maintenance/domain/maintenanceSelectors'
import { useMaintenanceStore } from '../../maintenance/store/maintenanceStore'
import { useSceneStore } from '../../store/sceneStore'
import { useProjectStore } from '../../store/projectStore'
import { openProjectFile } from '../../services/projectSessionService'
import { navigate } from '../../shared/navigation'
import { AppNavigation } from '../../shared/AppNavigation'
import { MaintenanceContextPanel } from './MaintenanceContextPanel'
import { MaintenanceSidebar } from './MaintenanceSidebar'
import { MaintenanceTopBar } from './MaintenanceTopBar'
import { ReplacementsScreen } from './ReplacementsScreen'
import { AREA_FILTER_ALL, type PlantAreaCode } from '../../config/areas'
import { useVisualizationStore } from '../../visualization/visualizationStore'
import { LcoCouplingsScreen } from './LcoCouplingsScreen'
import { getActiveMaintenanceModule, MAINTENANCE_MODULES } from './maintenanceModules'

const PlannerApp = lazy(() => import('../../planner/PlannerApp'))

const visualLabels = { CURRENT: 'Vigente', DUE_SOON: 'Próximo', OVERDUE: 'Vencido', NO_DATA: 'Sin datos', INACTIVE: 'Inactivo' } as const

export function MaintenanceApp() {
  const activeModule = getActiveMaintenanceModule(window.location.pathname)
  if (activeModule.id === 'LCO_COUPLINGS') return <MaintenanceLcoShell />
  if (activeModule.id === 'PLANNER') return <MaintenancePlannerShell />
  return <MaintenancePlatformWorkspace />
}

function MaintenancePlannerShell() {
  return <div className="planner-platform-shell">
    <AppNavigation active="MAINTENANCE" />
    <header className="planner-module-strip"><strong>LACO 1 Maintenance</strong><nav aria-label="Módulos de Maintenance">{MAINTENANCE_MODULES.map((module) => <button key={module.id} className={module.id === 'PLANNER' ? 'active' : ''} onClick={() => navigate(module.path)}>{module.label}</button>)}</nav></header>
    <Suspense fallback={<main className="app-route-loading">Cargando Planner…</main>}><PlannerApp embedded /></Suspense>
  </div>
}

function MaintenanceLcoShell() {
  const [query, setQuery] = useState('')
  return <div className="module-shell maintenance-module"><MaintenanceTopBar query={query} onQueryChange={setQuery} /><LcoCouplingsScreen /></div>
}

function MaintenancePlatformWorkspace() {
  const [query, setQuery] = useState(''); const maintenance = useMaintenanceStore(); const objects = useSceneStore((state) => state.objects); const hasActiveProject = useProjectStore((state) => state.hasActiveProject); const activeModule = getActiveMaintenanceModule(window.location.pathname); const isReplacements = activeModule.id === 'REPLACEMENTS'
  const rawVisualMap = useMemo(() => getMaintenanceAssetVisualStateMap(maintenance, objects, maintenance.referenceDate), [maintenance.equipment, maintenance.subassemblies, maintenance.plans, maintenance.events, maintenance.referenceDate, objects])
  const assetVisualStates = useMemo(() => new Map<string, AssetVisualState>([...rawVisualMap].map(([assetId, value]) => [assetId, { status: value.status, label: visualLabels[value.status], badgeCount: value.badgeCount, showBadge: value.status === 'OVERDUE' || value.status === 'DUE_SOON' || (maintenance.showOkBadges && value.status !== 'INACTIVE'), outlineColor: value.status === 'OVERDUE' ? '#ff244f' : value.status === 'DUE_SOON' ? '#ff9f1c' : undefined, title: value.title }])), [rawVisualMap, maintenance.showOkBadges])
  const recentAssetIds = useMemo(() => {
    if (!maintenance.recentDays) return null
    const cutoff = new Date(`${maintenance.referenceDate}T00:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate() - maintenance.recentDays)
    const positionIds = new Set(maintenance.events.filter((event) => new Date(`${event.date}T00:00:00Z`) >= cutoff).map((event) => event.subassemblyId)); const equipmentIds = new Set(maintenance.subassemblies.filter((item) => positionIds.has(item.id)).map((item) => item.equipmentId))
    return new Set(maintenance.equipment.filter((item) => equipmentIds.has(item.id)).map((item) => item.assetId))
  }, [maintenance.recentDays, maintenance.referenceDate, maintenance.events, maintenance.subassemblies, maintenance.equipment])
  const nonMatching = useMemo(() => new Set(objects.filter((asset) => (maintenance.statusFilter !== 'ALL' && rawVisualMap.get(asset.id)?.status !== maintenance.statusFilter) || (maintenance.criticalityFilter !== 'ALL' && asset.criticality !== maintenance.criticalityFilter) || Boolean(recentAssetIds && !recentAssetIds.has(asset.id))).map((asset) => asset.id)), [objects, maintenance.statusFilter, maintenance.criticalityFilter, rawVisualMap, recentAssetIds])
  useEffect(() => {
    const visualization = useVisualizationStore.getState()
    visualization.setFocusMode(maintenance.filterBehavior)
    if (maintenance.areaFilter === AREA_FILTER_ALL) visualization.clearFocusedArea()
    else if (visualization.focusedAreaCode !== maintenance.areaFilter) visualization.focusArea(maintenance.areaFilter as PlantAreaCode)
  }, [maintenance.areaFilter, maintenance.filterBehavior])
  useEffect(() => {
    const scene = useSceneStore.getState(); const store = useMaintenanceStore.getState(); store.setViewMode('MAINTENANCE'); scene.cancelLayoutCalibration(); scene.cancelLayoutCrop()
    if (activeModule.id === 'TWIN') {
      const params = new URLSearchParams(window.location.search); const requested = params.get('equipment'); const position = params.get('position')
      if (requested && scene.objects.some((asset) => asset.id === requested)) { scene.focusObject(requested); if (position) store.openSubassembly(position) }
    }
    return () => store.setViewMode('NORMAL')
  }, [activeModule.id])
  return <div className="module-shell maintenance-module"><MaintenanceTopBar query={query} onQueryChange={setQuery} />{isReplacements ? <ReplacementsScreen /> : !hasActiveProject ? <MaintenanceEmptyProject /> : <main className="maintenance-workspace"><MaintenanceSidebar query={query} /><PlantScene mode="MAINTENANCE" areaFilter={AREA_FILTER_ALL} levelFilter={maintenance.levelFilter} assetVisualStates={assetVisualStates} dimmedAssetIds={maintenance.filterBehavior === 'DIM' ? nonMatching : undefined} hiddenAssetIds={maintenance.filterBehavior === 'HIDE' ? nonMatching : undefined} /><MaintenanceContextPanel /></main>}</div>
}

function MaintenanceEmptyProject() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const open = async (file?: File) => {
    if (!file) return
    try {
      setError('')
      await openProjectFile(file)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo abrir el proyecto.')
    }
  }

  return <main className="maintenance-empty-workspace">
    <PlantScene mode="MAINTENANCE" />
    <section className="maintenance-empty-project" role="status">
      <strong>No hay un proyecto cargado.</strong>
      <p>Abre una sesión LACO3D para consultar la planta y sus datos de mantenimiento.</p>
      <div>
        <button onClick={() => inputRef.current?.click()}>Abrir proyecto</button>
        <button onClick={() => navigate('/editor')}>Ir al Plant Editor</button>
      </div>
      {error && <small>{error}</small>}
      <input ref={inputRef} hidden type="file" accept=".laco3d,.json,application/json" onChange={(event) => { void open(event.target.files?.[0]); event.target.value = '' }} />
    </section>
  </main>
}

import { useEffect, useState } from 'react'
import { PlantScene } from '../../components/Scene/PlantScene'
import { useMaintenanceStore } from '../../maintenance/store/maintenanceStore'
import { useSceneStore } from '../../store/sceneStore'
import { MaintenanceContextPanel } from './MaintenanceContextPanel'
import { MaintenanceSidebar } from './MaintenanceSidebar'
import { MaintenanceTopBar } from './MaintenanceTopBar'

export function MaintenanceApp() {
  const [query, setQuery] = useState('')
  const areaFilter = useMaintenanceStore((state) => state.areaFilter)
  const levelFilter = useMaintenanceStore((state) => state.levelFilter)
  useEffect(() => {
    const scene = useSceneStore.getState(); const maintenance = useMaintenanceStore.getState(); maintenance.setViewMode('MAINTENANCE'); scene.cancelLayoutCalibration(); scene.cancelLayoutCrop(); scene.clearSelection(); scene.requestCameraView('isometric')
    const requested = new URLSearchParams(window.location.search).get('equipment'); if (requested && scene.objects.some((asset) => asset.id === requested)) scene.focusObject(requested)
    return () => maintenance.setViewMode('NORMAL')
  }, [])
  return <div className="module-shell maintenance-module"><MaintenanceTopBar query={query} onQueryChange={setQuery} /><main className="maintenance-workspace"><MaintenanceSidebar query={query} /><PlantScene mode="MAINTENANCE" areaFilter={areaFilter} levelFilter={levelFilter} /><MaintenanceContextPanel /></main></div>
}

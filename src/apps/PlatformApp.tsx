import { useEffect } from 'react'
import { EditorApp } from './editor/EditorApp'
import { HomeApp } from './home/HomeApp'
import { MaintenanceApp } from './maintenance/MaintenanceApp'
import { findDuplicateMaintenanceIds, findOrphanMaintenanceRelations, hasIntegrityDiagnostics } from '../maintenance/domain/maintenanceIntegrity'
import { useMaintenanceStore } from '../maintenance/store/maintenanceStore'
import { useProjectStore } from '../store/projectStore'
import { useSceneStore } from '../store/sceneStore'

export default function PlatformApp({ location }: { location: string }) {
  const theme = useSceneStore((state) => state.view.theme)
  useEffect(() => useSceneStore.subscribe((state, previous) => { if (state.objects !== previous.objects || state.referenceLayout !== previous.referenceLayout || state.snap !== previous.snap || state.view !== previous.view) useProjectStore.getState().markDirty() }), [])
  useEffect(() => useMaintenanceStore.subscribe((state, previous) => { if (state.equipment !== previous.equipment || state.subassemblies !== previous.subassemblies || state.plans !== previous.plans || state.events !== previous.events || state.units !== previous.units) useProjectStore.getState().markDirty() }), [])
  useEffect(() => {
    if (!Boolean((import.meta as any).env?.DEV)) return
    const inspect = () => { const maintenance = useMaintenanceStore.getState().exportMaintenance(); const assetIds = useSceneStore.getState().objects.map((asset) => asset.id); const orphans = findOrphanMaintenanceRelations(maintenance, assetIds); const duplicates = findDuplicateMaintenanceIds(maintenance); if (hasIntegrityDiagnostics(orphans)) console.warn('[Maintenance] Relaciones huérfanas', orphans); if (hasIntegrityDiagnostics(duplicates)) console.warn('[Maintenance] IDs duplicados', duplicates) }
    inspect(); const unsubscribeScene = useSceneStore.subscribe(inspect); const unsubscribeMaintenance = useMaintenanceStore.subscribe(inspect); return () => { unsubscribeScene(); unsubscribeMaintenance() }
  }, [])
  useEffect(() => { const beforeUnload = (event: BeforeUnloadEvent) => { if (!useProjectStore.getState().isDirty) return; event.preventDefault(); event.returnValue = '' }; window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload) }, [])
  const pathname = location.split('?')[0]
  return <div className={`app-shell theme-${theme}`}>{pathname.startsWith('/maintenance') ? <MaintenanceApp key={location} /> : pathname.startsWith('/editor') ? <EditorApp key={location} /> : <HomeApp />}</div>
}

import { useEffect } from 'react'
import { EditorApp } from './apps/editor/EditorApp'
import { HomeApp } from './apps/home/HomeApp'
import { MaintenanceApp } from './apps/maintenance/MaintenanceApp'
import { useMaintenanceStore } from './maintenance/store/maintenanceStore'
import { useAppLocation } from './shared/navigation'
import { useProjectStore } from './store/projectStore'
import { useSceneStore } from './store/sceneStore'

export default function App() {
  const location = useAppLocation(); const theme = useSceneStore((state) => state.view.theme)
  useEffect(() => useSceneStore.subscribe((state, previous) => { if (state.objects !== previous.objects || state.referenceLayout !== previous.referenceLayout || state.snap !== previous.snap || state.view !== previous.view) useProjectStore.getState().markDirty() }), [])
  useEffect(() => useMaintenanceStore.subscribe((state, previous) => { if (state.equipment !== previous.equipment || state.subassemblies !== previous.subassemblies || state.plans !== previous.plans || state.events !== previous.events) useProjectStore.getState().markDirty() }), [])
  useEffect(() => { const beforeUnload = (event: BeforeUnloadEvent) => { if (!useProjectStore.getState().isDirty) return; event.preventDefault(); event.returnValue = '' }; window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload) }, [])
  const pathname = location.split('?')[0]
  return <div className={`app-shell theme-${theme}`}>{pathname.startsWith('/maintenance') ? <MaintenanceApp key={location} /> : pathname.startsWith('/editor') ? <EditorApp key={location} /> : <HomeApp />}</div>
}

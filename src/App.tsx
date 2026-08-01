import { useEffect } from 'react'
import { ObjectInspector } from './components/Inspector/ObjectInspector'
import { PlantScene } from './components/Scene/PlantScene'
import { ObjectLibrary } from './components/Sidebar/ObjectLibrary'
import { Toolbar } from './components/Toolbar/Toolbar'
import { useSceneStore } from './store/sceneStore'
import { useProjectStore } from './store/projectStore'

function isTextEditingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || (target instanceof HTMLElement && target.isContentEditable)
  )
}

export default function App() {
  const theme = useSceneStore((state) => state.view.theme)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEditingTarget(event.target)) return
      const key = event.key.toLowerCase()
      const command = event.ctrlKey || event.metaKey
      const state = useSceneStore.getState()
      if (command && key === 'z') {
        const handled = event.shiftKey ? state.redo() : state.undo()
        if (handled) event.preventDefault()
        return
      }
      if (command && key === 'y') {
        if (state.redo()) event.preventDefault()
        return
      }
      if (command && key === 'c') {
        if (state.copySelection() > 0) event.preventDefault()
        return
      }
      if (command && key === 'v') {
        if (state.pasteClipboard() > 0) event.preventDefault()
        return
      }
      if ((key === 'q' || key === 'e') && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (state.selectedObjectIds.length !== 1) return
        event.preventDefault()
        const degrees = event.shiftKey ? 45 : 90
        state.rotateSelectedByDegrees(key === 'q' ? -degrees : degrees)
        return
      }
      if (event.key !== 'Delete' && event.key !== 'Supr') return
      const selected = useSceneStore.getState().selectedObjectIds
      if (selected.length === 0) return
      const selectedObjects = useSceneStore.getState().objects.filter((object) => selected.includes(object.id))
      const lockedCount = selectedObjects.filter((object) => object.locked).length
      const message = lockedCount > 0
        ? 'Hay objetos bloqueados en la seleccion. ¿Deseas eliminarlos igualmente?'
        : selected.length > 1
          ? `¿Deseas eliminar los ${selected.length} objetos seleccionados?`
          : '¿Deseas eliminar el objeto seleccionado?'
      if (window.confirm(message)) {
        event.preventDefault()
        useSceneStore.getState().deleteObjects(selected)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => useSceneStore.subscribe((state, previous) => {
    if (
      state.objects !== previous.objects
      || state.referenceLayout !== previous.referenceLayout
      || state.snap !== previous.snap
      || state.view !== previous.view
    ) useProjectStore.getState().markDirty()
  }), [])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!useProjectStore.getState().isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [])

  return <div className={`app-shell theme-${theme}`}><Toolbar /><main className="workspace"><ObjectLibrary /><PlantScene /><ObjectInspector /></main></div>
}

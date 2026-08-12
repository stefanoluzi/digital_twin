import { useEffect } from 'react'
import { ObjectInspector } from '../../components/Inspector/ObjectInspector'
import { PlantScene } from '../../components/Scene/PlantScene'
import { ObjectLibrary } from '../../components/Sidebar/ObjectLibrary'
import { Toolbar } from '../../components/Toolbar/Toolbar'
import { useSceneStore } from '../../store/sceneStore'
import { AppNavigation } from '../../shared/AppNavigation'

function isTextEditingTarget(target: EventTarget | null) { return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable) }

export function EditorApp() {
  useEffect(() => {
    const queryAsset = new URLSearchParams(window.location.search).get('asset')
    if (queryAsset && useSceneStore.getState().objects.some((item) => item.id === queryAsset)) useSceneStore.getState().focusObject(queryAsset)
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEditingTarget(event.target)) return
      const key = event.key.toLowerCase(); const command = event.ctrlKey || event.metaKey; const state = useSceneStore.getState()
      if (command && key === 'z') { const handled = event.shiftKey ? state.redo() : state.undo(); if (handled) event.preventDefault(); return }
      if (command && key === 'y') { if (state.redo()) event.preventDefault(); return }
      if (command && key === 'c') { if (state.copySelection() > 0) event.preventDefault(); return }
      if (command && key === 'v') { if (state.pasteClipboard() > 0) event.preventDefault(); return }
      if ((key === 'q' || key === 'e') && !event.ctrlKey && !event.metaKey && !event.altKey) { if (state.selectedObjectIds.length !== 1) return; event.preventDefault(); state.rotateSelectedByDegrees(key === 'q' ? -(event.shiftKey ? 45 : 90) : event.shiftKey ? 45 : 90); return }
      if (event.key !== 'Delete' && event.key !== 'Supr') return
      const selected = state.selectedObjectIds; if (!selected.length) return
      const lockedCount = state.objects.filter((object) => selected.includes(object.id) && object.locked).length
      if (window.confirm(lockedCount ? 'Hay objetos bloqueados. ¿Deseas eliminarlos igualmente?' : selected.length > 1 ? `¿Deseas eliminar los ${selected.length} objetos seleccionados?` : '¿Deseas eliminar el objeto seleccionado?')) { event.preventDefault(); state.deleteObjects(selected) }
    }
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  return <div className="module-shell editor-module"><AppNavigation active="EDITOR" /><Toolbar /><main className="workspace"><ObjectLibrary /><PlantScene mode="EDITOR" /><ObjectInspector /></main></div>
}

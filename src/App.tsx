import { useEffect } from 'react'
import { ObjectInspector } from './components/Inspector/ObjectInspector'
import { PlantScene } from './components/Scene/PlantScene'
import { ObjectLibrary } from './components/Sidebar/ObjectLibrary'
import { Toolbar } from './components/Toolbar/Toolbar'
import { useSceneStore } from './store/sceneStore'

export default function App() {
  const theme = useSceneStore((state) => state.view.theme)
  const selectedObjectIds = useSceneStore((state) => state.selectedObjectIds)
  const objects = useSceneStore((state) => state.objects)
  const deleteObjects = useSceneStore((state) => state.deleteObjects)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Supr') return
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName.toLowerCase()
      if (target?.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select') return
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
  }, [selectedObjectIds, objects, deleteObjects])

  return <div className={`app-shell theme-${theme}`}><Toolbar /><main className="workspace"><ObjectLibrary /><PlantScene /><ObjectInspector /></main></div>
}

import { useMemo } from 'react'
import { AREA_FILTER_ALL, PLANT_AREAS, areaLabel, type AreaFilter, type PlantAreaCode } from '../../config/areas'
import { useSceneStore } from '../../store/sceneStore'
import { useVisualizationStore } from '../../visualization/visualizationStore'
import { MenuSection, ToolbarMenu } from './ToolbarMenu'

export function AreaNavigationMenu({ open, onToggle }: { open: boolean; onToggle: (id: string) => void }) {
  const objects = useSceneStore((state) => state.objects)
  const visibilityFilter = useSceneStore((state) => state.view.areaFilter)
  const updateView = useSceneStore((state) => state.updateView)
  const focusedAreaCode = useVisualizationStore((state) => state.focusedAreaCode)
  const focusMode = useVisualizationStore((state) => state.focusMode)
  const showAreaLabels = useVisualizationStore((state) => state.showAreaLabels)
  const focusArea = useVisualizationStore((state) => state.focusArea)
  const clearFocusedArea = useVisualizationStore((state) => state.clearFocusedArea)
  const setFocusMode = useVisualizationStore((state) => state.setFocusMode)
  const setShowAreaLabels = useVisualizationStore((state) => state.setShowAreaLabels)
  const counts = useMemo(() => {
    const result = new Map<PlantAreaCode, number>()
    objects.forEach((asset) => result.set(asset.areaCode, (result.get(asset.areaCode) ?? 0) + 1))
    return result
  }, [objects])

  return (
    <ToolbarMenu id="areas" label="Áreas" title="Navegar y enfocar áreas de la planta" open={open} active={Boolean(focusedAreaCode)} onToggle={onToggle}>
      <MenuSection title="Focus Area">
        <label className="toolbar-menu-field"><span>Área</span><select aria-label="Enfocar área" value={focusedAreaCode ?? AREA_FILTER_ALL} onChange={(event) => {
          const value = event.target.value as AreaFilter
          if (value === AREA_FILTER_ALL) clearFocusedArea()
          else focusArea(value as PlantAreaCode)
        }}>
          <option value={AREA_FILTER_ALL}>Todas las áreas</option>
          {PLANT_AREAS.map((area) => <option key={area.code} value={area.code}>{areaLabel(area.code)} ({counts.get(area.code) ?? 0})</option>)}
        </select></label>
        <label className="toolbar-menu-field"><span>Focus Mode</span><select aria-label="Modo de enfoque" value={focusMode} onChange={(event) => setFocusMode(event.target.value as 'DIM' | 'HIDE')}>
          <option value="DIM">Atenuar contexto</option><option value="HIDE">Ocultar contexto</option>
        </select></label>
        <label className="toolbar-menu-check"><input type="checkbox" checked={showAreaLabels} onChange={(event) => setShowAreaLabels(event.target.checked)} /> Labels de áreas</label>
      </MenuSection>
      <MenuSection title="Visibilidad">
        <label className="toolbar-menu-field"><span>Filtro</span><select aria-label="Filtrar visibilidad por área" value={visibilityFilter} onChange={(event) => updateView({ areaFilter: event.target.value as AreaFilter })}>
          <option value={AREA_FILTER_ALL}>Toda la planta</option>
          {PLANT_AREAS.map((area) => <option key={area.code} value={area.code}>{areaLabel(area.code)}</option>)}
        </select></label>
      </MenuSection>
    </ToolbarMenu>
  )
}

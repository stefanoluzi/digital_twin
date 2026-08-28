import type { ColorMode, LabelMode } from '../../types/plant'
import { useVisualizationStore } from '../../visualization/visualizationStore'
import type { VisualPreset } from '../../visualization/visualTheme'
import { MenuSection, ToolbarMenu } from './ToolbarMenu'

type View = ReturnType<typeof import('../../store/sceneStore').useSceneStore.getState>['view']
type UpdateView = ReturnType<typeof import('../../store/sceneStore').useSceneStore.getState>['updateView']

export function VisualizationMenu({ open, view, onToggle, onUpdate }: { open: boolean; view: View; onToggle: (id: string) => void; onUpdate: UpdateView }) {
  const visualPreset = useVisualizationStore((state) => state.visualPreset)
  const showDigitalTwinGrid = useVisualizationStore((state) => state.showDigitalTwinGrid)
  const setVisualPreset = useVisualizationStore((state) => state.setVisualPreset)
  const setShowDigitalTwinGrid = useVisualizationStore((state) => state.setShowDigitalTwinGrid)
  return (
    <ToolbarMenu id="visualization" label="Visualización" title="Preset, labels, colores y controles visuales" open={open} active={visualPreset === 'DIGITAL_TWIN' || view.showLabels || view.showResizeHandles || view.colorMode !== 'manual'} onToggle={onToggle}>
      <MenuSection title="Escena">
        <label className="toolbar-menu-field"><span>Visual</span><select aria-label="Preset visual" value={visualPreset} onChange={(event) => setVisualPreset(event.target.value as VisualPreset)}>
          <option value="DIGITAL_TWIN">Digital Twin</option><option value="EDITOR">Editor</option>
        </select></label>
        <label className="toolbar-menu-check"><input type="checkbox" checked={showDigitalTwinGrid} disabled={visualPreset !== 'DIGITAL_TWIN'} onChange={(event) => setShowDigitalTwinGrid(event.target.checked)} /> Mostrar grid</label>
        <label className="toolbar-menu-field"><span>Labels</span><select value={view.showLabels ? view.labelMode : 'hidden'} onChange={(event) => event.target.value === 'hidden' ? onUpdate({ showLabels: false }) : onUpdate({ showLabels: true, labelMode: event.target.value as LabelMode })}>
          <option value="hidden">Ocultos</option><option value="id">ID</option><option value="name">Nombre</option><option value="area">Área</option>
        </select></label>
        <label className="toolbar-menu-field"><span>Color</span><select value={view.colorMode} onChange={(event) => onUpdate({ colorMode: event.target.value as ColorMode })}>
          <option value="manual">Manual</option><option value="area">Área</option><option value="criticality">Criticidad</option>
        </select></label>
        <label className="toolbar-menu-check"><input type="checkbox" checked={view.showResizeHandles} onChange={(event) => onUpdate({ showResizeHandles: event.target.checked })} /> Resize handles</label>
      </MenuSection>
    </ToolbarMenu>
  )
}

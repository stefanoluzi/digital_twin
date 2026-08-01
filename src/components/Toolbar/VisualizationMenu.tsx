import type { ColorMode, LabelMode } from '../../types/plant'
import { MenuSection, ToolbarMenu } from './ToolbarMenu'

type View = ReturnType<typeof import('../../store/sceneStore').useSceneStore.getState>['view']
type UpdateView = ReturnType<typeof import('../../store/sceneStore').useSceneStore.getState>['updateView']

export function VisualizationMenu({ open, view, onToggle, onUpdate }: { open: boolean; view: View; onToggle: (id: string) => void; onUpdate: UpdateView }) {
  return (
    <ToolbarMenu id="visualization" label="Visualización" title="Labels, colores y controles visuales" open={open} active={view.showLabels || view.showResizeHandles || view.colorMode !== 'manual'} onToggle={onToggle}>
      <MenuSection title="Escena">
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

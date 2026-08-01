import type { PlantFrontDirection } from '../../config/cameraPresets'
import { MenuSection, ToolbarMenu } from './ToolbarMenu'

type View = ReturnType<typeof import('../../store/sceneStore').useSceneStore.getState>['view']

export function ViewMenu({ open, view, onToggle, onClose, onTheme, onRestore, onFrontChange }: {
  open: boolean
  view: View
  onToggle: (id: string) => void
  onClose: () => void
  onTheme: () => void
  onRestore: () => void
  onFrontChange: (direction: PlantFrontDirection) => void
}) {
  return (
    <ToolbarMenu id="view" label="Vista" title="Preferencias de vista" open={open} onToggle={onToggle} align="right">
      <MenuSection title="Apariencia">
        <button role="menuitem" onClick={onTheme}>{view.theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}</button>
        <button role="menuitem" onClick={() => { onClose(); onRestore() }}>Restaurar vista guardada</button>
      </MenuSection>
      <MenuSection title="Orientación de planta">
        <label className="toolbar-menu-field"><span>Frente de planta</span><select value={view.plantFrontDirection} onChange={(event) => onFrontChange(event.currentTarget.value as PlantFrontDirection)}>
          <option value="POSITIVE_X">+X</option><option value="NEGATIVE_X">-X</option><option value="POSITIVE_Z">+Z</option><option value="NEGATIVE_Z">-Z</option>
        </select></label>
      </MenuSection>
    </ToolbarMenu>
  )
}

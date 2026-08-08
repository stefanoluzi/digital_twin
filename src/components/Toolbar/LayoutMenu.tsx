import { MenuSection, ToolbarMenu } from './ToolbarMenu'
import { LEVEL_0, LEVEL_1 } from '../../config/plantLevels'

type Scene = ReturnType<typeof import('../../store/sceneStore').useSceneStore.getState>

export function LayoutMenu({ open, layout, editLayout, calibrationActive, cropActive, onToggle, onClose, onUpdateLayout, onEditLayout, onCenter, onFit, onCalibrate, onCrop, onResetCrop }: {
  open: boolean
  layout: Scene['referenceLayout']
  editLayout: boolean
  calibrationActive: boolean
  cropActive: boolean
  onToggle: (id: string) => void
  onClose: () => void
  onUpdateLayout: Scene['updateLayout']
  onEditLayout: (active: boolean) => void
  onCenter: () => void
  onFit: () => void
  onCalibrate: () => void
  onCrop: () => void
  onResetCrop: () => void
}) {
  const specialMode = editLayout || calibrationActive || cropActive
  return (
    <ToolbarMenu id="layout" label={specialMode ? 'Layout •' : 'Layout'} title={layout ? 'Herramientas del layout de referencia' : 'Importá un layout desde Archivo'} open={open} active={specialMode} disabled={!layout} onToggle={onToggle}>
      {layout && <>
        <MenuSection title={layout.fileName}>
          <label className="toolbar-menu-check"><input type="checkbox" checked={layout.visible} onChange={(event) => onUpdateLayout({ visible: event.target.checked })} /> Mostrar Layout</label>
          <label className="toolbar-menu-check"><input type="checkbox" checked={layout.locked} onChange={(event) => onUpdateLayout({ locked: event.target.checked })} /> Bloquear Layout</label>
          <label className="toolbar-menu-check"><input type="checkbox" checked={editLayout} onChange={(event) => onEditLayout(event.target.checked)} /> Editar Layout</label>
          <label className="toolbar-menu-range"><span>Opacidad <output>{Math.round(layout.opacity * 100)}%</output></span><input type="range" min="0" max="1" step="0.05" value={layout.opacity} onChange={(event) => onUpdateLayout({ opacity: Number(event.target.value) })} /></label>
        </MenuSection>
        <MenuSection title="Configuracion">
          <label className="toolbar-menu-field"><span>Nivel del Layout</span><select value={layout.levelCode === LEVEL_0 ? LEVEL_0 : LEVEL_1} onChange={(event) => onUpdateLayout({ levelCode: event.target.value === LEVEL_0 ? LEVEL_0 : LEVEL_1 })}>
            <option value={LEVEL_0}>Nivel 0</option><option value={LEVEL_1}>Nivel 1</option>
          </select></label>
        </MenuSection>
        <MenuSection title="Encuadre">
          <button role="menuitem" onClick={() => { onClose(); onCenter() }}>Centrar en origen</button>
          <button role="menuitem" onClick={() => { onClose(); onFit() }}>Fit Layout</button>
        </MenuSection>
        <MenuSection title="Herramientas">
          <button role="menuitem" className={calibrationActive ? 'active' : undefined} onClick={() => { onClose(); onCalibrate() }}>{layout.calibration.calibrated ? 'Recalibrar escala' : 'Calibrar escala'}</button>
          <button role="menuitem" className={cropActive ? 'active' : undefined} onClick={() => { onClose(); onCrop() }}>Recortar Layout</button>
          {layout.crop.enabled && <button role="menuitem" onClick={() => { onClose(); onResetCrop() }}>Restablecer Crop</button>}
        </MenuSection>
      </>}
    </ToolbarMenu>
  )
}

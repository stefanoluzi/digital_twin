import { MenuSection, ToolbarMenu } from './ToolbarMenu'

const parseNumber = (input: HTMLInputElement, fallback: number) => {
  const value = input.valueAsNumber
  if (Number.isFinite(value)) return value
  const parsed = Number(input.value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

export function SnapMenu({ open, snap, onToggle, onUpdate }: {
  open: boolean
  snap: ReturnType<typeof import('../../store/sceneStore').useSceneStore.getState>['snap']
  onToggle: (id: string) => void
  onUpdate: ReturnType<typeof import('../../store/sceneStore').useSceneStore.getState>['updateSnap']
}) {
  return (
    <ToolbarMenu id="snap" label="Snap" title="Configurar ajustes de traslación y rotación" open={open} active={snap.enabled || snap.rotationSnapEnabled} onToggle={onToggle}>
      <MenuSection title="Traslación">
        <label className="toolbar-menu-check"><input type="checkbox" checked={snap.enabled} onChange={(event) => onUpdate({ enabled: event.target.checked })} /> Snap de grilla</label>
        <label className="toolbar-menu-field"><span>Tamaño de grilla</span><input type="number" min="0.1" step="0.1" value={snap.gridSize} onChange={(event) => onUpdate({ gridSize: Math.max(0.1, parseNumber(event.currentTarget, snap.gridSize || 0.5)) })} /></label>
      </MenuSection>
      <MenuSection title="Rotación">
        <label className="toolbar-menu-check"><input type="checkbox" checked={snap.rotationSnapEnabled} onChange={(event) => onUpdate({ rotationSnapEnabled: event.target.checked })} /> Rotation Snap</label>
        <label className="toolbar-menu-field"><span>Ángulo</span><select aria-label="Incremento de Rotation Snap" value={snap.rotationSnapEnabled ? String(snap.rotationSnapAngle) : 'free'} onChange={(event) => event.target.value === 'free' ? onUpdate({ rotationSnapEnabled: false }) : onUpdate({ rotationSnapEnabled: true, rotationSnapAngle: Number(event.target.value) })}>
          {[90, 45, 30, 15, 5].map((angle) => <option key={angle} value={angle}>{angle}°</option>)}
          <option value="free">Libre</option>
        </select></label>
      </MenuSection>
    </ToolbarMenu>
  )
}

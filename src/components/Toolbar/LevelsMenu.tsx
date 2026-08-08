import { useEffect, useState } from 'react'
import {
  ALL_LEVELS,
  LEVEL_0,
  LEVEL_1,
  MULTI_LEVEL,
  getLevelElevation,
  type InsertionLevelCode,
  type VisibleLevelFilter,
} from '../../config/plantLevels'
import { MenuSection, ToolbarMenu } from './ToolbarMenu'

function ElevationInput({ level, value, onCommit }: { level: InsertionLevelCode; value: number; onCommit: (level: InsertionLevelCode, value: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = () => {
    const next = Number(draft.replace(',', '.'))
    if (Number.isFinite(next)) onCommit(level, next)
    else setDraft(String(value))
  }
  return <input aria-label={`Elevacion ${level}`} type="text" inputMode="decimal" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(String(value)); event.currentTarget.blur() } }} />
}

export function LevelsMenu({ open, store, onToggle }: {
  open: boolean
  store: ReturnType<typeof import('../../store/sceneStore').useSceneStore.getState>
  onToggle: (id: string) => void
}) {
  return (
    <ToolbarMenu id="levels" label="Niveles" title="Configurar pisos, insercion y visibilidad" open={open} active={store.visibleLevelFilter !== ALL_LEVELS} onToggle={onToggle}>
      <MenuSection title="Visibilidad">
        <label className="toolbar-menu-field"><span>Mostrar</span><select value={store.visibleLevelFilter} onChange={(event) => store.setVisibleLevelFilter(event.target.value as VisibleLevelFilter)}>
          <option value={ALL_LEVELS}>Todos</option><option value={LEVEL_0}>Nivel 0 + Multi</option><option value={LEVEL_1}>Nivel 1 + Multi</option><option value={MULTI_LEVEL}>Solo Multi-nivel</option>
        </select></label>
        <button onClick={() => store.requestCameraView('fit_level')}>Fit Nivel</button>
      </MenuSection>
      <MenuSection title="Insercion">
        <label className="toolbar-menu-field"><span>Nivel activo</span><select value={store.activeLevel} onChange={(event) => store.setActiveLevel(event.target.value as InsertionLevelCode)}>
          <option value={LEVEL_0}>Nivel 0</option><option value={LEVEL_1}>Nivel 1</option>
        </select></label>
      </MenuSection>
      <MenuSection title="Elevaciones">
        <label className="toolbar-menu-field"><span>Nivel 0 (m)</span><ElevationInput level={LEVEL_0} value={getLevelElevation(store.plantLevels, LEVEL_0)} onCommit={store.updateLevelElevation} /></label>
        <label className="toolbar-menu-field"><span>Nivel 1 (m)</span><ElevationInput level={LEVEL_1} value={getLevelElevation(store.plantLevels, LEVEL_1)} onCommit={store.updateLevelElevation} /></label>
        <small className="toolbar-menu-note">Cambiar una elevacion no mueve objetos automaticamente.</small>
      </MenuSection>
      <MenuSection title="Grillas">
        <label className="toolbar-menu-check"><input type="checkbox" checked={store.showLevel0Grid} onChange={(event) => store.setGridVisible(LEVEL_0, event.target.checked)} /> Grilla Nivel 0</label>
        <label className="toolbar-menu-check"><input type="checkbox" checked={store.showLevel1Grid} onChange={(event) => store.setGridVisible(LEVEL_1, event.target.checked)} /> Grilla Nivel 1</label>
      </MenuSection>
    </ToolbarMenu>
  )
}

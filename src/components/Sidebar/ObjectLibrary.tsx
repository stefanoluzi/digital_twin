import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { useSceneStore } from '../../store/sceneStore'
import type { AssetType, IndustrialAsset } from '../../types/plant'
import { createIndustrialObject } from '../../utils/objectFactory'

const entries: Array<{ type: AssetType; label: string; icon: string }> = [
  { type: 'gearbox', label: 'Caja reductora', icon: 'G' },
  { type: 'motor', label: 'Motor', icon: 'M' },
  { type: 'roller', label: 'Rodillo', icon: 'R' },
  { type: 'roller_table', label: 'Mesa de rodillos', icon: 'RT' },
  { type: 'pump', label: 'Bomba', icon: 'P' },
  { type: 'tank', label: 'Tanque', icon: 'T' },
  { type: 'conveyor', label: 'Transportador', icon: 'C' },
  { type: 'generic_box', label: 'Caja generica', icon: 'B' },
]

function matches(asset: IndustrialAsset, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return false
  return [
    asset.id,
    asset.name,
    asset.type,
    asset.area,
    asset.system,
    ...(Array.isArray(asset.tags) ? asset.tags : []),
  ].some((value) => String(value ?? '').toLowerCase().includes(q))
}

export function ObjectLibrary() {
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const objects = useSceneStore((state) => state.objects)
  const add = useSceneStore((state) => state.addObject)
  const focus = useSceneStore((state) => state.focusObject)
  const select = useSceneStore((state) => state.selectObject)
  const remove = useSceneStore((state) => state.deleteObject)
  const results = useMemo(() => query.trim() ? objects.filter((asset) => matches(asset, query)).slice(0, 12) : [], [objects, query])

  useEffect(() => {
    const close = () => setMenu(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
    }
  }, [])

  const openMenu = (asset: IndustrialAsset, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    select(asset.id)
    setMenu({ id: asset.id, x: event.clientX, y: event.clientY })
  }

  const menuAction = (action: () => void) => {
    action()
    setMenu(null)
  }

  return (
    <aside className="panel library">
      <div className="panel-title"><span>Biblioteca</span><small>{objects.length} activos</small></div>

      <div className="search-box">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar ID, nombre, area, sistema, tag..." />
        {query && <button onClick={() => setQuery('')}>x</button>}
      </div>
      {query && (
        <div className="search-results">
          {results.length === 0 && <p>Sin resultados</p>}
          {results.map((asset) => (
            <button key={asset.id} onClick={() => focus(asset.id)} onContextMenu={(event) => openMenu(asset, event)}>
              <strong>{asset.id}</strong>
              <span>{asset.name || 'Sin nombre'}</span>
              <small>{asset.area || 'Sin area'} - {asset.system || 'Sin sistema'}</small>
            </button>
          ))}
        </div>
      )}
      {menu && (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()}>
          <button onClick={() => menuAction(() => select(menu.id))}>Editar</button>
          <button onClick={() => menuAction(() => focus(menu.id))}>Centrar camara</button>
          <button className="danger" onClick={() => menuAction(() => remove(menu.id))}>Eliminar</button>
        </div>
      )}

      <p className="panel-copy">Agregar activo al centro</p>
      <div className="asset-library">
        {entries.map((entry) => (
          <button key={entry.type} className="library-button" onClick={() => add(createIndustrialObject(entry.type, objects))}>
            <span className="library-icon">{entry.icon}</span><span>{entry.label}</span><span className="add-mark">+</span>
          </button>
        ))}
      </div>
      <div className="library-footer"><span className="status-dot" /> Escena local - Sin backend</div>
    </aside>
  )
}

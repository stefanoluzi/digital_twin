import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { AREA_FILTER_ALL, AREA_BY_CODE, PLANT_AREAS, areaLabel } from '../../config/areas'
import { useSceneStore } from '../../store/sceneStore'
import type { AssetType, IndustrialAsset } from '../../types/plant'
import { createIndustrialObject } from '../../utils/objectFactory'

const primitiveEntries: Array<{ type: AssetType; label: string; icon: string }> = [
  { type: 'box', label: 'Box', icon: 'B' },
  { type: 'long_box', label: 'Long Box', icon: 'LB' },
  { type: 'cylinder', label: 'Cylinder', icon: 'CY' },
  { type: 'pipe', label: 'Pipe', icon: 'P' },
  { type: 'beam', label: 'Beam', icon: 'I' },
  { type: 'plate', label: 'Plate', icon: 'PL' },
]

const mechanicalEntries: Array<{ type: AssetType; label: string; icon: string }> = [
  { type: 'electric_motor_horizontal', label: 'Motor Electrico Horizontal', icon: 'MH' },
  { type: 'electric_motor_vertical', label: 'Motor Electrico Vertical', icon: 'MV' },
  { type: 'gearbox_horizontal', label: 'Caja Reductora Horizontal', icon: 'GH' },
  { type: 'gearbox_vertical', label: 'Caja Reductora Vertical', icon: 'GV' },
  { type: 'motor_gearbox_parallel', label: 'Motor + Reductor paralelo', icon: 'MR' },
  { type: 'coupling', label: 'Acople', icon: 'AC' },
  { type: 'cardan_shaft', label: 'Cardan', icon: 'CD' },
  { type: 'transmission_shaft', label: 'Eje de Transmision', icon: 'EJ' },
  { type: 'centrifugal_pump_horizontal', label: 'Bomba Centrifuga Horizontal', icon: 'BH' },
  { type: 'vertical_pump', label: 'Bomba Vertical', icon: 'BV' },
  { type: 'industrial_fan', label: 'Ventilador Industrial', icon: 'VI' },
]

const processEntries: Array<{ type: AssetType; label: string; icon: string }> = [
  { type: 'roller_table_flat', label: 'Roller Table (Flat)', icon: 'RF' },
  { type: 'roller_table_biconical', label: 'Roller Table (Biconical)', icon: 'RB' },
  { type: 'bancal', label: 'Bancal', icon: 'BN' },
  { type: 'centering_stars', label: 'Estrellas centradoras', icon: 'EC' },
  { type: 'chain_bed', label: 'Chain Bed', icon: 'CB' },
  { type: 'rolling_stand', label: 'Rolling Stand', icon: 'RS' },
  { type: 'steader_3_roll', label: 'Steader 3 Rodillos', icon: 'S3' },
  { type: 'piercer_drive', label: 'Piercer Drive', icon: 'PD' },
  { type: 'piercer_machine', label: 'Piercer Machine', icon: 'PM' },
]

const transportEntries: Array<{ type: AssetType; label: string; icon: string }> = [
  { type: 'rail_bed_multi', label: 'Bancal de Rieles', icon: 'BR' },
]

const hydraulicEntries: Array<{ type: AssetType; label: string; icon: string }> = [
  { type: 'hydraulic_power_unit', label: 'Central Hidraulica', icon: 'CH' },
]

const transferEntries: Array<{ type: AssetType; label: string; icon: string }> = [
  { type: 'transfer_star', label: 'Estrella', icon: 'ES' },
  { type: 'transfer_v', label: 'Transferidor V', icon: 'TV' },
  { type: 'transfer_claw', label: 'Transferidor Uña', icon: 'TU' },
]

const infrastructureEntries: Array<{ type: AssetType; label: string; icon: string }> = [
  { type: 'platform', label: 'Plataforma', icon: 'PF' },
  { type: 'stairs', label: 'Escalera', icon: 'ES' },
  { type: 'handrail', label: 'Baranda', icon: 'BR' },
  { type: 'column', label: 'Columna', icon: 'CL' },
  { type: 'electrical_panel', label: 'Tablero electrico', icon: 'TE' },
  { type: 'cabinet', label: 'Gabinete', icon: 'GB' },
  { type: 'tank_vertical', label: 'Tanque vertical', icon: 'TV' },
  { type: 'tank_horizontal', label: 'Tanque horizontal', icon: 'TH' },
  { type: 'pipe_rack_simple', label: 'Pipe Rack simple', icon: 'PR' },
]

function matches(asset: IndustrialAsset, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return false
  const area = AREA_BY_CODE[asset.areaCode]
  return [
    asset.id,
    asset.name,
    asset.type,
    asset.area,
    asset.areaCode,
    area?.name,
    asset.system,
    ...(Array.isArray(asset.tags) ? asset.tags : []),
  ].some((value) => String(value ?? '').toLowerCase().includes(q))
}

export function ObjectLibrary() {
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const objects = useSceneStore((state) => state.objects)
  const areaFilter = useSceneStore((state) => state.view.areaFilter)
  const add = useSceneStore((state) => state.addObject)
  const focus = useSceneStore((state) => state.focusObject)
  const select = useSceneStore((state) => state.selectObject)
  const remove = useSceneStore((state) => state.deleteObject)
  const results = useMemo(() => query.trim() ? objects.filter((asset) => matches(asset, query)).slice(0, 12) : [], [objects, query])
  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>([[AREA_FILTER_ALL, objects.length]])
    PLANT_AREAS.forEach((area) => counts.set(area.code, 0))
    objects.forEach((asset) => counts.set(asset.areaCode, (counts.get(asset.areaCode) ?? 0) + 1))
    return counts
  }, [objects])

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
              <small>{areaLabel(asset.areaCode)} - {asset.system || 'Sin sistema'}</small>
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

      <div className="library-scroll">
        <p className="panel-copy">Conteo por area</p>
        <div className="area-counts">
          <div className={areaFilter === AREA_FILTER_ALL ? 'active' : ''}><span>Todas</span><strong>{areaCounts.get(AREA_FILTER_ALL) ?? 0}</strong></div>
          {PLANT_AREAS.map((area) => (
            <div key={area.code} className={areaFilter === area.code ? 'active' : ''}>
              <span>{area.code === 'UNASSIGNED' ? 'Sin asignar' : area.code}</span>
              <strong>{areaCounts.get(area.code) ?? 0}</strong>
            </div>
          ))}
        </div>
        <LibrarySection title="Primitive Geometry" entries={primitiveEntries} objects={objects} onAdd={add} />
        <p className="panel-copy">Industrial Assets</p>
        <LibrarySection title="Mechanical" entries={mechanicalEntries} objects={objects} onAdd={add} />
        <LibrarySection title="Process" entries={processEntries} objects={objects} onAdd={add} />
        <LibrarySection title="Transporte" entries={transportEntries} objects={objects} onAdd={add} />
        <LibrarySection title="Hidraulica" entries={hydraulicEntries} objects={objects} onAdd={add} />
        <LibrarySection title="Transferidores" entries={transferEntries} objects={objects} onAdd={add} />
        <LibrarySection title="Infrastructure" entries={infrastructureEntries} objects={objects} onAdd={add} />
        <div className="library-footer"><span className="status-dot" /> Escena local - Sin backend</div>
      </div>
    </aside>
  )
}

function LibrarySection({
  title,
  entries,
  objects,
  onAdd,
}: {
  title: string
  entries: Array<{ type: AssetType; label: string; icon: string }>
  objects: IndustrialAsset[]
  onAdd: (asset: IndustrialAsset) => void
}) {
  return (
    <>
      <p className="panel-copy">{title}</p>
      <div className="asset-library">
        {entries.map((entry) => (
          <button key={entry.type} className="library-button" onClick={() => onAdd(createIndustrialObject(entry.type, objects))}>
            <span className="library-icon">{entry.icon}</span><span>{entry.label}</span><span className="add-mark">+</span>
          </button>
        ))}
      </div>
    </>
  )
}

import type { ReactNode } from 'react'
import { useSceneStore } from '../../store/sceneStore'
import { applyParamUpdate } from '../../utils/assetParams'
import { assetTypes, type Criticality, type IndustrialAsset, type IndustrialParamKey, type PlantSystem } from '../../types/plant'

type NumberGroup = 'position' | 'rotation'
type SizeKey = keyof IndustrialAsset['size']
type DataKey = keyof IndustrialAsset['dataSources']

const labels: Record<string, string> = {
  box: 'Box',
  long_box: 'Long Box',
  cylinder: 'Cylinder',
  pipe: 'Pipe',
  beam: 'Beam',
  plate: 'Plate',
  roller_table_flat: 'Roller Table (Flat)',
  roller_table_biconical: 'Roller Table (Biconical)',
  bancal: 'Bancal',
  rail_bed_multi: 'Bancal de Rieles',
  centering_stars: 'Estrellas Centradoras',
  chain_bed: 'Chain Bed',
  rolling_stand: 'Rolling Stand',
  steader_3_roll: 'Steader 3 Rodillos',
  piercer_drive: 'Piercer Drive',
  electric_motor_horizontal: 'Motor Electrico Horizontal',
  electric_motor_vertical: 'Motor Electrico Vertical',
  gearbox_horizontal: 'Caja Reductora Horizontal',
  gearbox_vertical: 'Caja Reductora Vertical',
  motor_gearbox_parallel: 'Motor + Reductor Ejes Paralelos',
  hydraulic_power_unit: 'Central Hidraulica',
  transfer_star: 'Transferidor Estrella',
  transfer_v: 'Transferidor V',
  transfer_claw: 'Transferidor Uña',
  coupling: 'Acople',
  cardan_shaft: 'Cardan',
  transmission_shaft: 'Eje de Transmision',
  centrifugal_pump_horizontal: 'Bomba Centrifuga Horizontal',
  vertical_pump: 'Bomba Vertical',
  industrial_fan: 'Ventilador Industrial',
  platform: 'Plataforma',
  stairs: 'Escalera',
  handrail: 'Baranda',
  column: 'Columna',
  electrical_panel: 'Tablero Electrico',
  cabinet: 'Gabinete',
  tank_vertical: 'Tanque Vertical',
  tank_horizontal: 'Tanque Horizontal',
  pipe_rack_simple: 'Pipe Rack Simple',
  gearbox: 'Caja reductora',
  motor: 'Motor',
  roller: 'Rodillo',
  roller_table: 'Mesa de rodillos',
  pump: 'Bomba',
  tank: 'Tanque',
  conveyor: 'Transportador',
  generic_box: 'Caja generica',
}

const systemOptions: Array<{ value: PlantSystem; label: string }> = [
  { value: '', label: 'Sin sistema' },
  { value: 'mecanico', label: 'Mecanico' },
  { value: 'hidraulico', label: 'Hidraulico' },
  { value: 'lubricacion', label: 'Lubricacion' },
  { value: 'electrico', label: 'Electrico' },
  { value: 'instrumentacion', label: 'Instrumentacion' },
]

const industrialParamFields: Partial<Record<IndustrialAsset['type'], Array<{ key: IndustrialParamKey; label: string; step?: number; min?: number; max?: number; kind?: 'number' | 'boolean' | 'color' }>>> = {
  roller_table_flat: [
    { key: 'length', label: 'Longitud', step: 0.5, min: 1 },
    { key: 'rollerSpacing', label: 'Separacion entre rodillos', step: 0.1, min: 0.2 },
    { key: 'rollerDiameter', label: 'Diametro de rodillos', step: 0.05, min: 0.1 },
    { key: 'rollerCount', label: 'Cantidad de rodillos', step: 1, min: 2 },
  ],
  roller_table_biconical: [
    { key: 'length', label: 'Longitud', step: 0.5, min: 1 },
    { key: 'rollerSpacing', label: 'Separacion entre rodillos', step: 0.1, min: 0.2 },
    { key: 'rollerDiameter', label: 'Diametro de rodillos', step: 0.05, min: 0.1 },
    { key: 'rollerCount', label: 'Cantidad de rodillos', step: 1, min: 2 },
  ],
  bancal: [
    { key: 'length', label: 'Longitud', step: 0.5, min: 1 },
    { key: 'width', label: 'Ancho', step: 0.2, min: 0.5 },
    { key: 'height', label: 'Altura', step: 0.1, min: 0.2 },
  ],
  rail_bed_multi: [
    { key: 'length', label: 'Longitud', step: 0.5, min: 1 },
    { key: 'width', label: 'Ancho', step: 0.2, min: 0.5 },
    { key: 'railCount', label: 'Cantidad de rieles', step: 1, min: 1 },
    { key: 'railHeight', label: 'Altura de riel', step: 0.05, min: 0.05 },
    { key: 'railWidth', label: 'Ancho de riel', step: 0.02, min: 0.04 },
    { key: 'supportSpacing', label: 'Separacion de travesanos', step: 0.1, min: 0.2 },
    { key: 'showCrossSupports', label: 'Mostrar travesanos', kind: 'boolean' },
  ],
  centering_stars: [
    { key: 'length', label: 'Longitud del eje', step: 0.5, min: 1 },
    { key: 'starCount', label: 'Cantidad de estrellas', step: 1, min: 1 },
    { key: 'width', label: 'Diametro de estrella', step: 0.1, min: 0.4 },
  ],
  chain_bed: [
    { key: 'chainCount', label: 'Cantidad de cadenas', step: 1, min: 1, max: 10 },
    { key: 'length', label: 'Longitud', step: 0.5, min: 1 },
    { key: 'width', label: 'Ancho', step: 0.2, min: 0.5 },
    { key: 'chainWidth', label: 'Ancho de cadena', step: 0.02, min: 0.08 },
    { key: 'chainHeight', label: 'Alto de cadena', step: 0.02, min: 0.04 },
    { key: 'supportSpacing', label: 'Separacion soportes', step: 0.1, min: 0.25 },
    { key: 'showSupports', label: 'Mostrar soportes', kind: 'boolean' },
  ],
  rolling_stand: [
    { key: 'width', label: 'Ancho', step: 0.2, min: 1 },
    { key: 'height', label: 'Altura', step: 0.2, min: 1 },
  ],
  steader_3_roll: [
    { key: 'length', label: 'Largo', step: 0.5, min: 1 },
    { key: 'width', label: 'Ancho', step: 0.2, min: 0.8 },
    { key: 'height', label: 'Altura', step: 0.2, min: 0.8 },
    { key: 'rollerDiameter', label: 'Diametro de rodillos', step: 0.05, min: 0.1 },
    { key: 'rollerLength', label: 'Largo de rodillos', step: 0.1, min: 0.3 },
    { key: 'rollerColor', label: 'Color de rodillos', kind: 'color' },
    { key: 'frameColor', label: 'Color de bastidor', kind: 'color' },
    { key: 'showTubePlaceholder', label: 'Mostrar tubo guia', kind: 'boolean' },
    { key: 'showHydraulics', label: 'Mostrar hidraulica', kind: 'boolean' },
  ],
  piercer_drive: [
    { key: 'length', label: 'Largo', step: 0.5, min: 1 },
    { key: 'width', label: 'Ancho', step: 0.2, min: 0.5 },
    { key: 'height', label: 'Altura', step: 0.2, min: 0.5 },
  ],
  hydraulic_power_unit: [
    { key: 'length', label: 'Largo', step: 0.5, min: 1 },
    { key: 'width', label: 'Ancho', step: 0.2, min: 0.8 },
    { key: 'height', label: 'Altura', step: 0.2, min: 0.8 },
    { key: 'pumpCount', label: 'Cantidad de bombas', step: 1, min: 1, max: 2 },
    { key: 'accumulatorCount', label: 'Cantidad de acumuladores', step: 1, min: 0, max: 4 },
    { key: 'filterCount', label: 'Cantidad de filtros', step: 1, min: 0, max: 4 },
    { key: 'valveSections', label: 'Secciones de valvulas', step: 1, min: 1, max: 8 },
  ],
  transfer_star: [
    { key: 'count', label: 'Cantidad de unidades', step: 1, min: 1, max: 24 },
    { key: 'spacing', label: 'Separacion', step: 0.1, min: 0.2 },
    { key: 'shaftDiameter', label: 'Diametro eje', step: 0.02, min: 0.06 },
    { key: 'shaftLength', label: 'Largo eje', step: 0.1, min: 0.4 },
    { key: 'supportHeight', label: 'Altura soportes', step: 0.05, min: 0.12 },
    { key: 'pivotAngle', label: 'Angulo pivote futuro', step: 0.05, min: 0 },
    { key: 'armCount', label: 'Cantidad de brazos', step: 1, min: 4, max: 8 },
    { key: 'transferDiameter', label: 'Diametro', step: 0.1, min: 0.4 },
    { key: 'height', label: 'Altura / espesor', step: 0.05, min: 0.1 },
  ],
  transfer_v: [
    { key: 'count', label: 'Cantidad de unidades', step: 1, min: 1, max: 24 },
    { key: 'spacing', label: 'Separacion', step: 0.1, min: 0.2 },
    { key: 'shaftDiameter', label: 'Diametro eje', step: 0.02, min: 0.06 },
    { key: 'shaftLength', label: 'Largo eje', step: 0.1, min: 0.4 },
    { key: 'supportHeight', label: 'Altura soportes', step: 0.05, min: 0.12 },
    { key: 'pivotAngle', label: 'Angulo pivote futuro', step: 0.05, min: 0 },
    { key: 'columnHeight', label: 'Altura columna', step: 0.1, min: 0.4 },
    { key: 'vWidth', label: 'Ancho V', step: 0.1, min: 0.3 },
    { key: 'vOpening', label: 'Apertura V', step: 0.05, min: 0.15 },
  ],
  transfer_claw: [
    { key: 'count', label: 'Cantidad de unidades', step: 1, min: 1, max: 24 },
    { key: 'spacing', label: 'Separacion', step: 0.1, min: 0.2 },
    { key: 'shaftDiameter', label: 'Diametro eje', step: 0.02, min: 0.06 },
    { key: 'shaftLength', label: 'Largo eje', step: 0.1, min: 0.4 },
    { key: 'supportHeight', label: 'Altura soportes', step: 0.05, min: 0.12 },
    { key: 'pivotAngle', label: 'Angulo pivote futuro', step: 0.05, min: 0 },
    { key: 'height', label: 'Altura', step: 0.1, min: 0.6 },
    { key: 'clawLength', label: 'Longitud brazo', step: 0.1, min: 0.4 },
    { key: 'clawOpening', label: 'Apertura de uña', step: 0.05, min: 0.15 },
  ],
}

const numberFromInput = (input: HTMLInputElement, fallback: number) => {
  const value = input.valueAsNumber
  if (Number.isFinite(value)) return value
  const parsed = Number(input.value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}
const radiansToDegrees = (radians: number) => Math.round((radians * 180 / Math.PI) * 100) / 100
const degreesToRadians = (degrees: number) => degrees * Math.PI / 180

export function ObjectInspector() {
  const selectedId = useSceneStore((state) => state.selectedObjectId)
  const selectedIds = useSceneStore((state) => state.selectedObjectIds)
  const objects = useSceneStore((state) => state.objects)
  const asset = useSceneStore((state) => state.objects.find((object) => object.id === selectedId))
  const update = useSceneStore((state) => state.updateObject)
  const focus = useSceneStore((state) => state.focusObject)
  const deleteObjects = useSceneStore((state) => state.deleteObjects)
  const clearSelection = useSceneStore((state) => state.clearSelection)
  const selectedAssets = selectedIds.map((id) => objects.find((object) => object.id === id)).filter(Boolean) as IndustrialAsset[]

  if (selectedAssets.length > 1) {
    const lockedCount = selectedAssets.filter((object) => object.locked).length
    const removeSelection = () => {
      const message = lockedCount > 0
        ? 'Hay objetos bloqueados en la seleccion. ¿Deseas eliminarlos igualmente?'
        : `¿Deseas eliminar los ${selectedAssets.length} objetos seleccionados?`
      if (window.confirm(message)) deleteObjects(selectedAssets.map((object) => object.id))
    }

    return (
      <aside className="panel inspector">
        <div className="panel-title"><span>Inspector</span><span>{selectedAssets.length} seleccionados</span></div>
        <div className="inspector-scroll">
          <Section title="Seleccion multiple">
            <div className="inspector-actions">
              <button className="danger" onClick={removeSelection}>Eliminar seleccion</button>
              <button onClick={clearSelection}>Limpiar seleccion</button>
            </div>
            <div className="field-label">Objetos</div>
            <div className="multi-selection-list">
              {selectedAssets.map((object) => (
                <button key={object.id} onClick={() => focus(object.id)}>
                  <strong>{object.id}</strong>
                  <span>{object.name || 'Sin nombre'}</span>
                  {object.locked && <small>Bloqueado</small>}
                </button>
              ))}
            </div>
            <p className="panel-copy">{lockedCount} bloqueados - {selectedAssets.length - lockedCount} editables</p>
          </Section>
        </div>
      </aside>
    )
  }

  if (!asset) {
    return (
      <aside className="panel inspector empty">
        <div className="panel-title">Inspector</div>
        <div className="empty-state">
          <span>--</span>
          <strong>Sin seleccion</strong>
          <p>Selecciona un activo en la escena para editar sus propiedades.</p>
        </div>
      </aside>
    )
  }

  const patch = (value: Partial<IndustrialAsset>) => update(asset.id, value)
  const vector = (group: NumberGroup, axis: 'x' | 'y' | 'z', value: number) => patch({ [group]: { ...asset[group], [axis]: value } })
  const size = (key: SizeKey, value: number) => {
    const nextSize = { ...asset.size, [key]: Math.max(0.05, value) }
    patch({ size: nextSize, position: { ...asset.position, y: nextSize.height / 2 } })
  }
  const dataSource = (key: DataKey, value: string) => patch({ dataSources: { ...asset.dataSources, [key]: value } })
  const paramFields = industrialParamFields[asset.type]
  const param = (key: IndustrialParamKey, value: number | string) => patch(applyParamUpdate(asset, key, value))

  return (
    <aside className="panel inspector">
      <div className="panel-title"><span>Inspector</span><span className={`criticality-badge level-${asset.criticality || 'none'}`}>Criticidad {asset.criticality || '-'}</span></div>
      <div className="inspector-scroll">
        <Section title="Identidad">
          <div className="inspector-actions">
            <button onClick={() => { void navigator.clipboard?.writeText(asset.id).catch(() => undefined) }}>Copiar ID</button>
            <button onClick={() => focus(asset.id)}>Centrar camara</button>
          </div>
          <Field label="ID"><input value={asset.id} onChange={(e) => patch({ id: e.target.value })} /></Field>
          <Field label="Nombre"><input value={asset.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
          <Field label="Tipo"><select value={asset.type} onChange={(e) => patch({ type: e.target.value as IndustrialAsset['type'] })}>{assetTypes.map((type) => <option key={type} value={type}>{labels[type]}</option>)}</select></Field>
          <label className="field-check"><input type="checkbox" checked={asset.locked} onChange={(e) => patch({ locked: e.target.checked })} /> Bloquear objeto</label>
          <Field label="Area"><input value={asset.area} onChange={(e) => patch({ area: e.target.value })} placeholder="Ej: Tren acabador" /></Field>
          <Field label="Sistema">
            <select value={asset.system} onChange={(e) => patch({ system: e.target.value as PlantSystem })}>
              {systemOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <div className="two-columns">
            <Field label="Color manual"><input className="color-input" type="color" value={asset.color} onChange={(e) => patch({ color: e.target.value })} /></Field>
            <Field label="Criticidad"><select value={asset.criticality} onChange={(e) => patch({ criticality: e.target.value as Criticality })}><option value="">-</option><option>A</option><option>B</option><option>C</option><option>D</option></select></Field>
          </div>
        </Section>

        {paramFields ? (
          <Section title="Parametros del asset">
            {paramFields.map((field) => (
              <Field key={field.key} label={field.label}>
                {field.kind === 'boolean' ? (
                  <input
                    disabled={asset.locked}
                    type="checkbox"
                    checked={Number(asset.params[field.key] ?? 0) > 0}
                    onChange={(e) => param(field.key, e.currentTarget.checked ? 1 : 0)}
                  />
                ) : field.kind === 'color' ? (
                  <input
                    className="color-input"
                    disabled={asset.locked}
                    type="color"
                    value={typeof asset.params[field.key] === 'string' ? asset.params[field.key] : '#707b86'}
                    onChange={(e) => param(field.key, e.currentTarget.value)}
                  />
                ) : (
                  <input
                    disabled={asset.locked}
                    type="number"
                    step={field.step ?? 0.1}
                    min={field.min ?? 0.05}
                    max={field.max}
                    value={Number(asset.params[field.key] ?? 0)}
                    onChange={(e) => param(field.key, numberFromInput(e.currentTarget, Number(asset.params[field.key] ?? 0)))}
                  />
                )}
              </Field>
            ))}
          </Section>
        ) : (
          <Section title="Geometria">
            <div className="field-label">Dimensiones</div>
            <div className="vector-grid">{(['width', 'height', 'depth'] as SizeKey[]).map((key, i) => <label key={key}><span>{['AN', 'AL', 'PR'][i]}</span><input disabled={asset.locked} type="number" step="0.1" min="0.05" value={asset.size[key]} onChange={(e) => size(key, numberFromInput(e.currentTarget, asset.size[key]))} /></label>)}</div>
          </Section>
        )}

        <Section title="Ubicacion">
          <VectorEditor label="Posicion (X ancho, Y altura, Z largo)" values={asset.position} disabled={asset.locked} onChange={(axis, value) => vector('position', axis, value)} />
          <RotationEditor values={asset.rotation} disabled={asset.locked} onChange={(axis, value) => vector('rotation', axis, degreesToRadians(value))} />
        </Section>

        <Section title="Datos externos">
          {([['plcTag', 'PLC tag'], ['sapEquipmentId', 'SAP equipment ID'], ['grafanaUrl', 'Grafana URL'], ['powerBiUrl', 'Power BI URL'], ['documentsUrl', 'Documentos URL'], ['photosUrl', 'Fotos URL'], ['failureHistory', 'Historial de fallas']] as Array<[DataKey, string]>).map(([key, label]) => <Field key={key} label={label}><input value={asset.dataSources[key]} onChange={(e) => dataSource(key, e.target.value)} placeholder="Sin conectar" /></Field>)}
        </Section>

        <Section title="Notas">
          <Field label="Tags (separados por coma)"><input value={asset.tags.join(', ')} onChange={(e) => patch({ tags: e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} /></Field>
          <Field label="Descripcion"><textarea rows={4} value={asset.description} onChange={(e) => patch({ description: e.target.value })} /></Field>
        </Section>
      </div>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="inspector-section"><h3>{title}</h3>{children}</section> }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
function VectorEditor({ label, values, step = 0.1, disabled = false, onChange }: { label: string; values: IndustrialAsset['position']; step?: number; disabled?: boolean; onChange: (axis: 'x' | 'y' | 'z', value: number) => void }) {
  return <div className="vector-editor"><div className="field-label">{label}</div><div className="vector-grid">{(['x', 'y', 'z'] as const).map((axis) => <label key={axis}><span>{axis.toUpperCase()}</span><input disabled={disabled} type="number" step={step} value={values[axis]} onChange={(e) => onChange(axis, numberFromInput(e.currentTarget, values[axis]))} /></label>)}</div></div>
}
function RotationEditor({ values, disabled = false, onChange }: { values: IndustrialAsset['rotation']; disabled?: boolean; onChange: (axis: 'x' | 'y' | 'z', value: number) => void }) {
  return (
    <div className="vector-editor">
      <div className="field-label">Rotacion (grados)</div>
      <div className="vector-grid">
        {(['x', 'y', 'z'] as const).map((axis) => {
          const degrees = radiansToDegrees(values[axis])
          return <label key={axis}><span>{axis.toUpperCase()}</span><input disabled={disabled} type="number" step="1" value={degrees} onChange={(e) => onChange(axis, numberFromInput(e.currentTarget, degrees))} /></label>
        })}
      </div>
    </div>
  )
}

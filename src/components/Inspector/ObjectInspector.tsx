import type { ReactNode } from 'react'
import * as THREE from 'three'
import { PLANT_AREAS, areaLabel, type PlantAreaCode } from '../../config/areas'
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
  piercer_machine: 'Piercer Machine',
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
  piercer_machine: [
    { key: 'length', label: 'Largo', step: 0.5, min: 1 },
    { key: 'width', label: 'Ancho', step: 0.2, min: 0.5 },
    { key: 'height', label: 'Altura', step: 0.2, min: 0.8 },
    { key: 'baseHeight', label: 'Altura base', step: 0.05, min: 0.1 },
    { key: 'openingWidth', label: 'Ancho abertura', step: 0.1, min: 0.5 },
    { key: 'openingHeight', label: 'Altura abertura', step: 0.1, min: 0.3 },
    { key: 'frameThickness', label: 'Espesor bastidor', step: 0.05, min: 0.12 },
    { key: 'rollDiameter', label: 'Diametro rodillos', step: 0.05, min: 0.1 },
    { key: 'rollAngle', label: 'Angulo rodillos', step: 1, min: 0 },
    { key: 'mandrelDiameter', label: 'Diametro mandril', step: 0.02, min: 0.05 },
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
const MIN_LAYOUT_SCALE = 0.01
const MAX_LAYOUT_SCALE = 1000
const DEBUG_CALIBRATION = false
const clampLayoutScale = (value: number) => Math.min(MAX_LAYOUT_SCALE, Math.max(MIN_LAYOUT_SCALE, value))

export function ObjectInspector() {
  const selectedId = useSceneStore((state) => state.selectedObjectId)
  const selectedIds = useSceneStore((state) => state.selectedObjectIds)
  const objects = useSceneStore((state) => state.objects)
  const asset = useSceneStore((state) => state.objects.find((object) => object.id === selectedId))
  const update = useSceneStore((state) => state.updateObject)
  const focus = useSceneStore((state) => state.focusObject)
  const deleteObjects = useSceneStore((state) => state.deleteObjects)
  const clearSelection = useSceneStore((state) => state.clearSelection)
  const referenceLayout = useSceneStore((state) => state.referenceLayout)
  const updateLayout = useSceneStore((state) => state.updateLayout)
  const centerLayout = useSceneStore((state) => state.centerLayout)
  const layoutCalibration = useSceneStore((state) => state.layoutCalibration)
  const startLayoutCalibration = useSceneStore((state) => state.startLayoutCalibration)
  const cancelLayoutCalibration = useSceneStore((state) => state.cancelLayoutCalibration)
  const clearLayoutCalibration = useSceneStore((state) => state.clearLayoutCalibration)
  const layoutCrop = useSceneStore((state) => state.layoutCrop)
  const startLayoutCrop = useSceneStore((state) => state.startLayoutCrop)
  const cancelLayoutCrop = useSceneStore((state) => state.cancelLayoutCrop)
  const applyLayoutCrop = useSceneStore((state) => state.applyLayoutCrop)
  const resetLayoutCrop = useSceneStore((state) => state.resetLayoutCrop)
  const selectedAssets = selectedIds.map((id) => objects.find((object) => object.id === id)).filter(Boolean) as IndustrialAsset[]
  const layoutPanel = referenceLayout ? (
    <ReferenceLayoutPanel
      layout={referenceLayout}
      layoutCalibration={layoutCalibration}
      updateLayout={updateLayout}
      centerLayout={centerLayout}
      startLayoutCalibration={startLayoutCalibration}
      cancelLayoutCalibration={cancelLayoutCalibration}
      clearLayoutCalibration={clearLayoutCalibration}
      layoutCrop={layoutCrop}
      objectCount={objects.length}
      startLayoutCrop={startLayoutCrop}
      cancelLayoutCrop={cancelLayoutCrop}
      applyLayoutCrop={applyLayoutCrop}
      resetLayoutCrop={resetLayoutCrop}
    />
  ) : null

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
                  <small>{areaLabel(object.areaCode)}</small>
                  {object.locked && <small>Bloqueado</small>}
                </button>
              ))}
            </div>
            <p className="panel-copy">{lockedCount} bloqueados - {selectedAssets.length - lockedCount} editables</p>
          </Section>
          {layoutPanel}
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
        {layoutPanel && <div className="inspector-scroll">{layoutPanel}</div>}
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
          <Field label="Area">
            <select value={asset.areaCode} onChange={(e) => patch({ areaCode: e.target.value as PlantAreaCode })}>
              {PLANT_AREAS.map((area) => <option key={area.code} value={area.code}>{areaLabel(area.code)}</option>)}
            </select>
          </Field>
          <Field label="Area libre / nota"><input value={asset.area} onChange={(e) => patch({ area: e.target.value })} placeholder="Ej: Tren acabador" /></Field>
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
        {layoutPanel}
      </div>
    </aside>
  )
}

function ReferenceLayoutPanel({
  layout,
  layoutCalibration,
  updateLayout,
  centerLayout,
  startLayoutCalibration,
  cancelLayoutCalibration,
  clearLayoutCalibration,
  layoutCrop,
  objectCount,
  startLayoutCrop,
  cancelLayoutCrop,
  applyLayoutCrop,
  resetLayoutCrop,
}: {
  layout: NonNullable<ReturnType<typeof useSceneStore.getState>['referenceLayout']>
  layoutCalibration: ReturnType<typeof useSceneStore.getState>['layoutCalibration']
  updateLayout: ReturnType<typeof useSceneStore.getState>['updateLayout']
  centerLayout: ReturnType<typeof useSceneStore.getState>['centerLayout']
  startLayoutCalibration: ReturnType<typeof useSceneStore.getState>['startLayoutCalibration']
  cancelLayoutCalibration: ReturnType<typeof useSceneStore.getState>['cancelLayoutCalibration']
  clearLayoutCalibration: ReturnType<typeof useSceneStore.getState>['clearLayoutCalibration']
  layoutCrop: ReturnType<typeof useSceneStore.getState>['layoutCrop']
  objectCount: number
  startLayoutCrop: ReturnType<typeof useSceneStore.getState>['startLayoutCrop']
  cancelLayoutCrop: ReturnType<typeof useSceneStore.getState>['cancelLayoutCrop']
  applyLayoutCrop: ReturnType<typeof useSceneStore.getState>['applyLayoutCrop']
  resetLayoutCrop: ReturnType<typeof useSceneStore.getState>['resetLayoutCrop']
}) {
  const setStretch = (axis: 'width' | 'height', value: number) => updateLayout(axis === 'width'
    ? { stretchWidth: clampLayoutScale(value) }
    : { stretchHeight: clampLayoutScale(value) })
  const setUniformScale = (value: number) => updateLayout({ uniformScale: clampLayoutScale(value) })
  const setLockAspectRatio = (locked: boolean) => {
    const nextUniform = locked ? clampLayoutScale(layout.uniformScale * layout.stretchWidth) : layout.uniformScale
    updateLayout(locked
      ? { lockAspectRatio: true, uniformScale: nextUniform, stretchWidth: 1, stretchHeight: 1 }
      : { lockAspectRatio: false })
  }
  const multiplyScale = (factor: number) => updateLayout({ uniformScale: clampLayoutScale(layout.uniformScale * factor) })
  const beginCalibration = () => {
    if (DEBUG_CALIBRATION) console.log('Calibration button clicked')
    startLayoutCalibration()
  }
  const setPosition = (axis: 'x' | 'y' | 'z', value: number) => updateLayout({ position: { ...layout.position, [axis]: value } })
  const setRotation = (axis: 'x' | 'y' | 'z', value: number) => updateLayout({ rotation: { ...layout.rotation, [axis]: degreesToRadians(value) } })
  const baseHeight = layout.baseWidth / Math.max(0.0001, layout.aspectRatio)
  const crop = layoutCrop.draft ?? layout.crop
  const cropU = crop.enabled || layoutCrop.active ? Math.max(0.01, crop.uMax - crop.uMin) : 1
  const cropV = crop.enabled || layoutCrop.active ? Math.max(0.01, crop.vMax - crop.vMin) : 1
  const finalWidth = layout.baseWidth * layout.uniformScale * (layout.lockAspectRatio ? 1 : layout.stretchWidth) * cropU
  const finalHeight = baseHeight * layout.uniformScale * (layout.lockAspectRatio ? 1 : layout.stretchHeight) * cropV
  const calibrationA = layoutCalibration.pointA ?? layout.calibration.pointA
  const calibrationB = layoutCalibration.pointB ?? layout.calibration.pointB
  const currentDistance = calibrationA && calibrationB
    ? Math.hypot((calibrationB.u - calibrationA.u) * finalWidth, (calibrationB.v - calibrationA.v) * finalHeight)
    : null
  const factor = currentDistance && layout.calibration.realDistance ? layout.calibration.realDistance / currentDistance : null
  const centerCropInOrigin = () => {
    if (objectCount > 0 && !window.confirm('El layout se movera, pero los equipos existentes permaneceran en su posicion. ¿Continuar?')) return
    const fullWidth = layout.baseWidth * layout.uniformScale * (layout.lockAspectRatio ? 1 : layout.stretchWidth)
    const fullHeight = baseHeight * layout.uniformScale * (layout.lockAspectRatio ? 1 : layout.stretchHeight)
    const cropCenterU = (crop.uMin + crop.uMax) / 2
    const cropCenterV = (crop.vMin + crop.vMax) / 2
    const local = new THREE.Vector3((cropCenterU - 0.5) * fullWidth, (cropCenterV - 0.5) * fullHeight, 0)
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + layout.rotation.x, layout.rotation.y, layout.rotation.z))
    const worldOffset = local.applyQuaternion(rotation)
    updateLayout({
      position: {
        x: layout.position.x - worldOffset.x,
        y: layout.position.y,
        z: layout.position.z - worldOffset.z,
      },
    })
  }

  return (
    <Section title="Reference Layout">
      {layout.missing && <p className="panel-copy">Layout de referencia no encontrado.</p>}
      <Field label="Archivo"><input disabled value={layout.layoutPath || layout.fileName} /></Field>
      <label className="field-check"><input type="checkbox" checked={layout.visible} onChange={(e) => updateLayout({ visible: e.target.checked })} /> Visible</label>
      <label className="field-check"><input type="checkbox" checked={layout.locked} onChange={(e) => updateLayout({ locked: e.target.checked })} /> Locked</label>
      <label className="field-check"><input type="checkbox" checked={layout.lockAspectRatio} onChange={(e) => setLockAspectRatio(e.target.checked)} /> Lock Aspect Ratio</label>
      <Field label="Opacity"><input type="range" min="0" max="1" step="0.05" value={layout.opacity} onChange={(e) => updateLayout({ opacity: Number(e.currentTarget.value) })} /></Field>
      <Field label="Escala uniforme"><input disabled={layout.locked} type="number" step="0.05" min="0.01" value={layout.uniformScale} onChange={(e) => setUniformScale(numberFromInput(e.currentTarget, layout.uniformScale))} /></Field>
      {!layout.lockAspectRatio && (
        <>
          <div className="field-label">Deformacion libre</div>
          <div className="vector-grid">
            <label><span>Ancho</span><input disabled={layout.locked} type="number" step="0.05" min="0.01" value={layout.stretchWidth} onChange={(e) => setStretch('width', numberFromInput(e.currentTarget, layout.stretchWidth))} /></label>
            <label><span>Alto</span><input disabled={layout.locked} type="number" step="0.05" min="0.01" value={layout.stretchHeight} onChange={(e) => setStretch('height', numberFromInput(e.currentTarget, layout.stretchHeight))} /></label>
          </div>
        </>
      )}
      <div className="inspector-actions">
        <button disabled={layout.locked} onClick={() => multiplyScale(1 / 1.1)}>-</button>
        <button disabled={layout.locked} onClick={() => multiplyScale(1.1)}>+</button>
        <button disabled={layout.locked} onClick={() => updateLayout({ uniformScale: 1, stretchWidth: 1, stretchHeight: 1 })}>Reset Scale</button>
      </div>
      <div className="inspector-actions">
        <button className={layoutCalibration.active ? 'active' : undefined} onClick={beginCalibration}>{layout.calibration.calibrated ? 'Recalibrar' : 'Calibrar escala'}</button>
        {layoutCalibration.active && <button onClick={cancelLayoutCalibration}>Cancelar</button>}
        {layout.calibration.calibrated && <button onClick={clearLayoutCalibration}>Borrar calibracion</button>}
      </div>
      {layoutCalibration.active && <p className="panel-copy">Modo calibracion: marca dos puntos sobre el layout.</p>}
      {currentDistance !== null && <p className="panel-copy">Distancia actual: {currentDistance.toFixed(2)} m</p>}
      {layout.calibration.realDistance ? <p className="panel-copy">Distancia objetivo: {layout.calibration.realDistance.toFixed(2)} m</p> : null}
      {factor ? <p className="panel-copy">Factor aplicado: {factor.toFixed(4)}</p> : null}
      <div className="inspector-actions">
        <button className={layoutCrop.active ? 'active' : undefined} onClick={startLayoutCrop}>Recortar layout</button>
        {layoutCrop.active && <button onClick={applyLayoutCrop}>Aplicar recorte</button>}
        {layoutCrop.active && <button onClick={cancelLayoutCrop}>Cancelar</button>}
        {layoutCrop.active && <button onClick={resetLayoutCrop}>Restablecer al layout completo</button>}
        {!layoutCrop.active && layout.crop.enabled && <button onClick={resetLayoutCrop}>Quitar recorte</button>}
        <button onClick={centerCropInOrigin}>Centrar recorte en origen</button>
      </div>
      {(layout.crop.enabled || layoutCrop.active) && (
        <p className="panel-copy">
          Ancho seleccionado: {finalWidth.toFixed(2)} m - Alto seleccionado: {finalHeight.toFixed(2)} m - Region: {(cropU * 100).toFixed(1)}% x {(cropV * 100).toFixed(1)}%
        </p>
      )}
      <VectorEditor label="Position" values={layout.position} step={0.1} disabled={layout.locked} onChange={setPosition} />
      <RotationEditor values={layout.rotation} disabled={layout.locked} onChange={setRotation} />
      <button disabled={layout.locked} onClick={centerLayout}>Reset</button>
    </Section>
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

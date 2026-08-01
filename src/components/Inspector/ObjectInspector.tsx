import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { PLANT_AREAS, areaLabel, type PlantAreaCode } from '../../config/areas'
import { useSceneStore } from '../../store/sceneStore'
import { applyParamUpdate } from '../../utils/assetParams'
import { assetTypes, type Criticality, type IndustrialAsset, type IndustrialParamKey, type PlantSystem } from '../../types/plant'
import { UNIFORM_SCALE_FACTOR } from '../../utils/uniformScale'
import { ValidatedNumberInput } from './ValidatedNumberInput'
import { MIN_HOLLOW_CYLINDER_WALL_THICKNESS } from '../Scene/primitives/HollowCylinder'

type NumberGroup = 'position' | 'rotation'
type SizeKey = keyof IndustrialAsset['size']
type DataKey = keyof IndustrialAsset['dataSources']

const labels: Record<string, string> = {
  box: 'Box',
  long_box: 'Long Box',
  cylinder: 'Cylinder',
  hollow_cylinder: 'Cilindro Hueco',
  pipe: 'Pipe',
  beam: 'Beam',
  plate: 'Plate',
  roller_table_flat: 'Roller Table (Flat)',
  roller_table_biconical: 'Roller Table (Biconical)',
  bancal: 'Bancal',
  lance_carrier_cart: 'Carro Porta Lanza',
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
  rectangular_pool: 'Pileta rectangular',
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

type IndustrialParamField = { key: IndustrialParamKey; label: string; step?: number; min?: number; max?: number; kind?: 'number' | 'boolean' | 'color' | 'supportType' | 'drainSide'; group?: 'supports' }

const industrialParamFields: Partial<Record<IndustrialAsset['type'], IndustrialParamField[]>> = {
  hollow_cylinder: [
    { key: 'outerDiameter', label: 'Diametro exterior (m)', step: 0.05, min: 0.02 },
    { key: 'innerDiameter', label: 'Diametro interior (m)', step: 0.05, min: 0 },
    { key: 'length', label: 'Longitud (m)', step: 0.1, min: 0.01 },
    { key: 'radialSegments', label: 'Segmentos radiales', step: 1, min: 8, max: 128 },
  ],
  roller_table_flat: [
    { key: 'length', label: 'Longitud', step: 0.5, min: 1 },
    { key: 'rollerSpacing', label: 'Separacion entre rodillos', step: 0.1, min: 0.2 },
    { key: 'rollerDiameter', label: 'Diametro de rodillos', step: 0.05, min: 0.1 },
    { key: 'rollerWidth', label: 'Ancho del rodillo (m)', step: 0.1, min: 0.1, max: 20 },
    { key: 'rollerCount', label: 'Cantidad de rodillos', step: 1, min: 2 },
    { key: 'showBearingHousings', label: 'Mostrar cajeras', kind: 'boolean', group: 'supports' },
    { key: 'housingWidth', label: 'Ancho cajera', step: 0.05, min: 0.12, group: 'supports' },
    { key: 'housingLength', label: 'Largo cajera', step: 0.05, min: 0.12, group: 'supports' },
    { key: 'housingHeight', label: 'Alto cajera', step: 0.05, min: 0.15, group: 'supports' },
    { key: 'housingBaseThickness', label: 'Espesor base', step: 0.01, min: 0.025, group: 'supports' },
    { key: 'shaftDiameter', label: 'Diametro eje', step: 0.01, min: 0.04, group: 'supports' },
    { key: 'shaftExtension', label: 'Extension eje', step: 0.01, min: 0.04, group: 'supports' },
    { key: 'housingCapHeight', label: 'Alto tapa', step: 0.01, min: 0.025, group: 'supports' },
    { key: 'housingColor', label: 'Color cajera', kind: 'color', group: 'supports' },
  ],
  roller_table_biconical: [
    { key: 'length', label: 'Longitud', step: 0.5, min: 1 },
    { key: 'rollerSpacing', label: 'Separacion entre rodillos', step: 0.1, min: 0.2 },
    { key: 'rollerDiameter', label: 'Diametro de rodillos', step: 0.05, min: 0.1 },
    { key: 'rollerWidth', label: 'Ancho del rodillo (m)', step: 0.1, min: 0.1, max: 20 },
    { key: 'rollerCount', label: 'Cantidad de rodillos', step: 1, min: 2 },
    { key: 'showBearingHousings', label: 'Mostrar cajeras', kind: 'boolean', group: 'supports' },
    { key: 'housingWidth', label: 'Ancho cajera', step: 0.05, min: 0.12, group: 'supports' },
    { key: 'housingLength', label: 'Largo cajera', step: 0.05, min: 0.12, group: 'supports' },
    { key: 'housingHeight', label: 'Alto cajera', step: 0.05, min: 0.15, group: 'supports' },
    { key: 'housingBaseThickness', label: 'Espesor base', step: 0.01, min: 0.025, group: 'supports' },
    { key: 'shaftDiameter', label: 'Diametro eje', step: 0.01, min: 0.04, group: 'supports' },
    { key: 'shaftExtension', label: 'Extension eje', step: 0.01, min: 0.04, group: 'supports' },
    { key: 'housingCapHeight', label: 'Alto tapa', step: 0.01, min: 0.025, group: 'supports' },
    { key: 'housingColor', label: 'Color cajera', kind: 'color', group: 'supports' },
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
  lance_carrier_cart: [
    { key: 'bodyLength', label: 'Largo del cuerpo', step: 0.1, min: 1 },
    { key: 'bodyDiameter', label: 'Diametro del cuerpo', step: 0.1, min: 0.5 },
    { key: 'bodyEndCapLength', label: 'Largo de tapas', step: 0.05, min: 0.05 },
    { key: 'frontNeckLength', label: 'Largo del cuello frontal', step: 0.05, min: 0.05 },
    { key: 'frontNeckDiameter', label: 'Diametro del cuello frontal', step: 0.05, min: 0.15 },
    { key: 'chassisLength', label: 'Largo del chasis', step: 0.1, min: 1 },
    { key: 'chassisWidth', label: 'Ancho del chasis', step: 0.1, min: 0.6 },
    { key: 'wheelRadius', label: 'Radio de ruedas', step: 0.05, min: 0.1 },
    { key: 'wheelWidth', label: 'Ancho de ruedas', step: 0.02, min: 0.05 },
    { key: 'wheelbase', label: 'Distancia entre ejes', step: 0.1, min: 0.5 },
    { key: 'trackWidth', label: 'Trocha', step: 0.1, min: 0.4 },
    { key: 'showLance', label: 'Mostrar lanza', kind: 'boolean' },
    { key: 'lanceLength', label: 'Largo de lanza', step: 0.1, min: 1 },
    { key: 'lanceDiameter', label: 'Diametro de lanza', step: 0.02, min: 0.05 },
    { key: 'lanceOffsetY', label: 'Offset vertical de lanza', step: 0.05, min: -1, max: 1 },
    { key: 'showTowBar', label: 'Mostrar enganche', kind: 'boolean' },
  ],
  rectangular_pool: [
    { key: 'length', label: 'Largo (m)', step: 0.1, min: 0.3 },
    { key: 'width', label: 'Ancho (m)', step: 0.1, min: 0.3 },
    { key: 'height', label: 'Alto (m)', step: 0.1, min: 0.2 },
    { key: 'wallThickness', label: 'Espesor de pared (m)', step: 0.01, min: 0.02 },
    { key: 'bottomThickness', label: 'Espesor de fondo (m)', step: 0.01, min: 0.02 },
    { key: 'showLiquid', label: 'Mostrar liquido', kind: 'boolean' },
    { key: 'liquidLevel', label: 'Nivel de liquido (0-1)', step: 0.05, min: 0, max: 1 },
    { key: 'liquidColor', label: 'Color del liquido', kind: 'color' },
    { key: 'liquidOpacity', label: 'Opacidad del liquido', step: 0.05, min: 0, max: 1 },
    { key: 'showTopRim', label: 'Mostrar borde superior', kind: 'boolean' },
    { key: 'rimWidth', label: 'Ancho del borde (m)', step: 0.01, min: 0.02 },
    { key: 'rimHeight', label: 'Alto del borde (m)', step: 0.01, min: 0.02 },
    { key: 'showExternalRibs', label: 'Mostrar refuerzos', kind: 'boolean' },
    { key: 'ribCountLongSides', label: 'Refuerzos por lado', step: 1, min: 1, max: 24 },
    { key: 'ribThickness', label: 'Espesor de refuerzo (m)', step: 0.01, min: 0.02 },
    { key: 'supportType', label: 'Tipo de soporte', kind: 'supportType' },
    { key: 'supportHeight', label: 'Altura de soporte (m)', step: 0.05, min: 0.05 },
    { key: 'showDrain', label: 'Mostrar drenaje', kind: 'boolean' },
    { key: 'drainDiameter', label: 'Diametro de drenaje (m)', step: 0.02, min: 0.05 },
    { key: 'drainSide', label: 'Lado del drenaje', kind: 'drainSide' },
    { key: 'bodyColor', label: 'Color del cuerpo', kind: 'color' },
    { key: 'interiorColor', label: 'Color interior', kind: 'color' },
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

const integerParamKeys = new Set<IndustrialParamKey>([
  'rollerCount',
  'radialSegments',
  'railCount',
  'starCount',
  'chainCount',
  'pumpCount',
  'accumulatorCount',
  'filterCount',
  'valveSections',
  'count',
  'armCount',
  'ribCountLongSides',
])
const radiansToDegrees = (radians: number) => Math.round((radians * 180 / Math.PI) * 100) / 100
const degreesToRadians = (degrees: number) => degrees * Math.PI / 180
const MIN_LAYOUT_SCALE = 0.01
const MAX_LAYOUT_SCALE = 1000
const DEBUG_CALIBRATION = false
const clampLayoutScale = (value: number) => Math.min(MAX_LAYOUT_SCALE, Math.max(MIN_LAYOUT_SCALE, value))
const ID_PATTERN = /^[A-Z0-9_-]+$/

function validateIdDraft(value: string, currentId: string, objects: IndustrialAsset[]) {
  const normalized = value.trim().toUpperCase()
  if (!normalized) return 'El ID no puede quedar vacio.'
  if (!ID_PATTERN.test(normalized)) return 'Usa solo letras, numeros, guion y guion bajo.'
  if (objects.some((object) => object.id === normalized && object.id !== currentId)) return 'Ya existe otro objeto con este ID.'
  return ''
}

export function ObjectInspector() {
  const selectedId = useSceneStore((state) => state.selectedObjectId)
  const selectedIds = useSceneStore((state) => state.selectedObjectIds)
  const objects = useSceneStore((state) => state.objects)
  const asset = useSceneStore((state) => state.objects.find((object) => object.id === selectedId))
  const update = useSceneStore((state) => state.updateObject)
  const renameObjectId = useSceneStore((state) => state.renameObjectId)
  const activeRotationAxis = useSceneStore((state) => state.activeRotationAxis)
  const setActiveRotationAxis = useSceneStore((state) => state.setActiveRotationAxis)
  const rotateSelectedByDegrees = useSceneStore((state) => state.rotateSelectedByDegrees)
  const scaleObjectUniformly = useSceneStore((state) => state.scaleObjectUniformly)
  const setObjectUniformScale = useSceneStore((state) => state.setObjectUniformScale)
  const scaleSelectedObjectsIndividually = useSceneStore((state) => state.scaleSelectedObjectsIndividually)
  const resetSelectedObjectsUniformScale = useSceneStore((state) => state.resetSelectedObjectsUniformScale)
  const focus = useSceneStore((state) => state.focusObject)
  const deleteObjects = useSceneStore((state) => state.deleteObjects)
  const clearSelection = useSceneStore((state) => state.clearSelection)
  const setPrimarySelection = useSceneStore((state) => state.setPrimarySelection)
  const alignSelected = useSceneStore((state) => state.alignSelected)
  const setSelectedLocked = useSceneStore((state) => state.setSelectedLocked)
  const primarySelectedObjectId = useSceneStore((state) => state.primarySelectedObjectId)
  const setEditMode = useSceneStore((state) => state.setEditMode)
  const selectOnly = useSceneStore((state) => state.selectOnly)
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
  const [draftId, setDraftId] = useState(selectedId ?? '')
  const [idError, setIdError] = useState('')
  const cancelIdCommitRef = useRef(false)

  useEffect(() => {
    setDraftId(selectedId ?? '')
    setIdError('')
    cancelIdCommitRef.current = false
  }, [selectedId])

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
    const editableAssets = selectedAssets.filter((object) => !object.locked)
    const commonScale = selectedAssets.every((object) => Math.abs(object.uniformScale - selectedAssets[0].uniformScale) < 0.000001)
      ? selectedAssets[0].uniformScale
      : null
    const selectedAssetIds = selectedAssets.map((object) => object.id)
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
            {lockedCount > 0 && <p className="group-transform-warning">La seleccion contiene objetos bloqueados. Desbloquealos o quitalos para transformar el grupo.</p>}
            <div className="inspector-actions alignment-quick-actions">
              <button disabled={lockedCount > 0} onClick={() => setEditMode('move')}>Mover grupo</button>
              <button disabled={lockedCount > 0} onClick={() => setEditMode('rotate')}>Rotar grupo</button>
              <button disabled={lockedCount > 0} onClick={() => setEditMode('scale')}>Escalar grupo</button>
            </div>
            <div className="inspector-actions">
              <button className="danger" onClick={removeSelection}>Eliminar seleccion</button>
              <button onClick={() => primarySelectedObjectId ? selectOnly(primarySelectedObjectId) : clearSelection()}>Desagrupar seleccion</button>
            </div>
            <div className="inspector-actions alignment-quick-actions">
              <button onClick={() => alignSelected('x', 'center', primarySelectedObjectId ?? undefined)}>Mismo X</button>
              <button onClick={() => alignSelected('y', 'min', primarySelectedObjectId ?? undefined)}>Base Y</button>
              <button onClick={() => alignSelected('z', 'center', primarySelectedObjectId ?? undefined)}>Mismo Z</button>
            </div>
            <div className="inspector-actions">
              <button onClick={() => setSelectedLocked(true)}>Bloquear todos</button>
              <button onClick={() => setSelectedLocked(false)}>Desbloquear todos</button>
            </div>
            <div className="field-label">Objetos</div>
            <div className="multi-selection-list">
              {selectedAssets.map((object) => (
                <button key={object.id} className={object.id === primarySelectedObjectId ? 'primary' : ''} onClick={() => setPrimarySelection(object.id)}>
                  <strong>{object.id}</strong>
                  <span>{object.name || 'Sin nombre'}</span>
                  <small>{areaLabel(object.areaCode)}</small>
                  {object.id === primarySelectedObjectId && <small>Primario</small>}
                  {object.locked && <small>Bloqueado</small>}
                </button>
              ))}
            </div>
            <p className="panel-copy">{lockedCount} bloqueados - {selectedAssets.length - lockedCount} editables</p>
          </Section>
          <Section title="Escala proporcional individual">
            <div className="uniform-scale-control">
              <button
                aria-label="Reducir escala proporcional individual"
                disabled={editableAssets.length === 0}
                onClick={() => scaleSelectedObjectsIndividually(selectedAssetIds, 1 / UNIFORM_SCALE_FACTOR)}
              >−</button>
              <strong>{commonScale === null ? 'Mixto' : `${commonScale.toFixed(2)}x`}</strong>
              <button
                aria-label="Aumentar escala proporcional individual"
                disabled={editableAssets.length === 0}
                onClick={() => scaleSelectedObjectsIndividually(selectedAssetIds, UNIFORM_SCALE_FACTOR)}
              >+</button>
            </div>
            <button
              className="uniform-scale-reset"
              disabled={editableAssets.length === 0 || editableAssets.every((object) => object.uniformScale === 1)}
              onClick={() => resetSelectedObjectsUniformScale(selectedAssetIds)}
            >
              Reset escala de seleccionados
            </button>
            <p className="panel-copy">Aplicar a {editableAssets.length} {editableAssets.length === 1 ? 'objeto editable' : 'objetos editables'} sin modificar sus posiciones.</p>
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
  const commitId = () => {
    const error = validateIdDraft(draftId, asset.id, objects)
    if (error) {
      setIdError(error)
      return false
    }
    const normalizedId = draftId.trim().toUpperCase()
    if (!renameObjectId(asset.id, normalizedId)) {
      setIdError('No se pudo aplicar el nuevo ID.')
      return false
    }
    setDraftId(normalizedId)
    setIdError('')
    return true
  }
  const cancelIdEdit = (input: HTMLInputElement) => {
    cancelIdCommitRef.current = true
    setDraftId(asset.id)
    setIdError('')
    input.blur()
  }
  const vector = (group: NumberGroup, axis: 'x' | 'y' | 'z', value: number) => patch({ [group]: { ...asset[group], [axis]: value } })
  const size = (key: SizeKey, value: number) => {
    const nextSize = { ...asset.size, [key]: Math.max(0.05, value) }
    const baseElevation = asset.position.y - asset.size.height * asset.uniformScale / 2
    patch({ size: nextSize, position: { ...asset.position, y: baseElevation + nextSize.height * asset.uniformScale / 2 } })
  }
  const dataSource = (key: DataKey, value: string) => patch({ dataSources: { ...asset.dataSources, [key]: value } })
  const paramFields = industrialParamFields[asset.type]
  const param = (key: IndustrialParamKey, value: number | string) => patch(applyParamUpdate(asset, key, value))
  const mainParamFields = paramFields?.filter((field) => field.group !== 'supports') ?? []
  const supportParamFields = paramFields?.filter((field) => field.group === 'supports') ?? []
  const validateParamValue = (key: IndustrialParamKey, value: number) => {
    if (asset.type !== 'hollow_cylinder') return ''
    const outerDiameter = key === 'outerDiameter' ? value : Number(asset.params.outerDiameter ?? 1)
    const innerDiameter = key === 'innerDiameter' ? value : Number(asset.params.innerDiameter ?? 0.5)
    if (innerDiameter >= outerDiameter) return 'El diámetro interior debe ser menor que el diámetro exterior.'
    if ((outerDiameter - innerDiameter) / 2 < MIN_HOLLOW_CYLINDER_WALL_THICKNESS) return `El espesor de pared mínimo es ${MIN_HOLLOW_CYLINDER_WALL_THICKNESS} m.`
    return ''
  }
  const renderParamField = (field: IndustrialParamField) => (
    <Field key={field.key} label={field.label}>
      {field.kind === 'boolean' ? (
        <input
          disabled={asset.locked}
          type="checkbox"
          checked={Number(asset.params[field.key] ?? 0) > 0}
          onChange={(event) => param(field.key, event.currentTarget.checked ? 1 : 0)}
        />
      ) : field.kind === 'color' ? (
        <input
          className="color-input"
          disabled={asset.locked}
          type="color"
          value={typeof asset.params[field.key] === 'string' ? asset.params[field.key] : '#707b86'}
          onChange={(event) => param(field.key, event.currentTarget.value)}
        />
      ) : field.kind === 'supportType' ? (
        <select disabled={asset.locked} value={String(asset.params[field.key] ?? 'floor')} onChange={(event) => param(field.key, event.currentTarget.value)}>
          <option value="floor">Apoyada en piso</option><option value="legs">Cuatro patas</option><option value="skid">Dos largueros</option>
        </select>
      ) : field.kind === 'drainSide' ? (
        <select disabled={asset.locked} value={String(asset.params[field.key] ?? 'right')} onChange={(event) => param(field.key, event.currentTarget.value)}>
          <option value="left">Izquierda</option><option value="right">Derecha</option><option value="front">Frente</option><option value="rear">Trasera</option>
        </select>
      ) : (
        <ValidatedNumberInput
          disabled={asset.locked}
          step={field.step ?? 0.1}
          min={field.min ?? 0.05}
          max={field.max}
          value={Number(asset.params[field.key] ?? 0)}
          integer={integerParamKeys.has(field.key)}
          resetKey={asset.id}
          ariaLabel={field.label}
          validate={(value) => validateParamValue(field.key, value)}
          onCommit={(value) => param(field.key, value)}
        />
      )}
    </Field>
  )

  return (
    <aside className="panel inspector">
      <div className="panel-title"><span>Inspector</span><span className={`criticality-badge level-${asset.criticality || 'none'}`}>Criticidad {asset.criticality || '-'}</span></div>
      <div className="inspector-scroll">
        <Section title="Identidad">
          <div className="inspector-actions">
            <button onClick={() => { void navigator.clipboard?.writeText(asset.id).catch(() => undefined) }}>Copiar ID</button>
            <button onClick={() => focus(asset.id)}>Centrar camara</button>
          </div>
          <Field label="ID">
            <input
              value={draftId}
              className={idError ? 'input-error' : undefined}
              aria-invalid={Boolean(idError)}
              aria-describedby={idError ? 'object-id-error' : undefined}
              onChange={(event) => {
                const value = event.currentTarget.value
                setDraftId(value)
                setIdError(validateIdDraft(value, asset.id, objects))
              }}
              onBlur={() => {
                if (cancelIdCommitRef.current) {
                  cancelIdCommitRef.current = false
                  return
                }
                commitId()
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  if (commitId()) event.currentTarget.blur()
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  event.stopPropagation()
                  cancelIdEdit(event.currentTarget)
                }
              }}
            />
            {idError && <span id="object-id-error" className="field-error">{idError}</span>}
          </Field>
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
            {mainParamFields.map(renderParamField)}
            {supportParamFields.length > 0 && (
              <details className="inspector-subsection" open>
                <summary>Soportes de rodillo</summary>
                <div className="inspector-subsection__content">{supportParamFields.map(renderParamField)}</div>
              </details>
            )}
            {asset.type === 'hollow_cylinder' && (
              <p className="calculated-param">Espesor de pared: {((Number(asset.params.outerDiameter ?? 1) - Number(asset.params.innerDiameter ?? 0.5)) / 2).toFixed(3)} m</p>
            )}
            {(asset.type === 'roller_table_biconical' || asset.type === 'roller_table_flat')
              && Number(asset.params.rollerWidth ?? 1.2) > asset.size.depth * 1.5
              && <p className="field-error">El ancho del rodillo supera 1.5 veces el ancho general del bancal.</p>}
            {asset.type === 'rectangular_pool'
              && Number(asset.params.wallThickness ?? 0.15) >= Math.min(Number(asset.params.length ?? 6), Number(asset.params.width ?? 3)) / 2 - 0.011
              && <p className="field-error">El espesor de pared fue limitado para conservar una cavidad interior valida.</p>}
            {asset.type === 'rectangular_pool'
              && Number(asset.params.bottomThickness ?? 0.2) >= Number(asset.params.height ?? 1.5) - 0.011
              && <p className="field-error">El espesor de fondo fue limitado para conservar altura interior.</p>}
          </Section>
        ) : (
          <Section title="Geometria">
            <div className="field-label">Dimensiones</div>
            <div className="vector-grid">{(['width', 'height', 'depth'] as SizeKey[]).map((key, i) => <label key={key}><span>{['AN', 'AL', 'PR'][i]}</span><ValidatedNumberInput disabled={asset.locked} step={0.1} min={0.05} unit="m" value={asset.size[key]} resetKey={asset.id} ariaLabel={['Ancho', 'Alto', 'Profundidad'][i]} onCommit={(value) => size(key, value)} /></label>)}</div>
          </Section>
        )}

        <Section title="Escala proporcional">
          <div className="uniform-scale-control">
            <button aria-label="Reducir escala proporcional" disabled={asset.locked} onClick={() => scaleObjectUniformly(asset.id, 1 / UNIFORM_SCALE_FACTOR)}>−</button>
            <strong>{asset.uniformScale.toFixed(2)}x</strong>
            <button aria-label="Aumentar escala proporcional" disabled={asset.locked} onClick={() => scaleObjectUniformly(asset.id, UNIFORM_SCALE_FACTOR)}>+</button>
          </div>
          <button className="uniform-scale-reset" disabled={asset.locked || asset.uniformScale === 1} onClick={() => setObjectUniformScale(asset.id, 1)}>Reset 1.00x</button>
          <p className="panel-copy">Render: {(asset.size.width * asset.uniformScale).toFixed(2)} × {(asset.size.height * asset.uniformScale).toFixed(2)} × {(asset.size.depth * asset.uniformScale).toFixed(2)}</p>
        </Section>

        <Section title="Ubicacion">
          <VectorEditor label="Posicion (X ancho, Y altura, Z largo)" values={asset.position} disabled={asset.locked} resetKey={asset.id} onChange={(axis, value) => vector('position', axis, value)} />
          <RotationEditor values={asset.rotation} disabled={asset.locked} resetKey={asset.id} onChange={(axis, value) => vector('rotation', axis, degreesToRadians(value))} />
          <div className="field-label">Eje de rotacion rapida</div>
          <div className="inspector-actions rotation-axis-actions">
            {(['x', 'y', 'z'] as const).map((axis) => <button key={axis} className={activeRotationAxis === axis ? 'active' : ''} onClick={() => setActiveRotationAxis(axis)}>{axis.toUpperCase()}</button>)}
          </div>
          <div className="inspector-actions">
            <button disabled={asset.locked} onClick={() => rotateSelectedByDegrees(-90)}>↺ -90°</button>
            <button disabled={asset.locked} onClick={() => rotateSelectedByDegrees(90)}>↻ +90°</button>
          </div>
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
      <Field label="Opacity"><ValidatedNumberInput disabled={layout.locked} min={0} max={1} step={0.05} value={layout.opacity} resetKey={layout.layoutPath} ariaLabel="Opacity" onCommit={(value) => updateLayout({ opacity: value })} /></Field>
      <Field label="Escala uniforme"><ValidatedNumberInput disabled={layout.locked} step={0.05} min={0.01} value={layout.uniformScale} resetKey={layout.layoutPath} ariaLabel="Escala uniforme" onCommit={setUniformScale} /></Field>
      {!layout.lockAspectRatio && (
        <>
          <div className="field-label">Deformacion libre</div>
          <div className="vector-grid">
            <label><span>Ancho</span><ValidatedNumberInput disabled={layout.locked} step={0.05} min={0.01} value={layout.stretchWidth} resetKey={layout.layoutPath} ariaLabel="Deformacion ancho" onCommit={(value) => setStretch('width', value)} /></label>
            <label><span>Alto</span><ValidatedNumberInput disabled={layout.locked} step={0.05} min={0.01} value={layout.stretchHeight} resetKey={layout.layoutPath} ariaLabel="Deformacion alto" onCommit={(value) => setStretch('height', value)} /></label>
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
      <VectorEditor label="Position" values={layout.position} step={0.1} disabled={layout.locked} resetKey={layout.layoutPath} onChange={setPosition} />
      <RotationEditor values={layout.rotation} disabled={layout.locked} resetKey={layout.layoutPath} onChange={setRotation} />
      <button disabled={layout.locked} onClick={centerLayout}>Reset</button>
    </Section>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="inspector-section"><h3>{title}</h3>{children}</section> }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
function VectorEditor({ label, values, step = 0.1, disabled = false, resetKey, onChange }: { label: string; values: IndustrialAsset['position']; step?: number; disabled?: boolean; resetKey?: string | number; onChange: (axis: 'x' | 'y' | 'z', value: number) => void }) {
  return <div className="vector-editor"><div className="field-label">{label}</div><div className="vector-grid">{(['x', 'y', 'z'] as const).map((axis) => <label key={axis}><span>{axis.toUpperCase()}</span><ValidatedNumberInput disabled={disabled} step={step} value={values[axis]} resetKey={resetKey} ariaLabel={`${label} ${axis.toUpperCase()}`} onCommit={(value) => onChange(axis, value)} /></label>)}</div></div>
}
function RotationEditor({ values, disabled = false, resetKey, onChange }: { values: IndustrialAsset['rotation']; disabled?: boolean; resetKey?: string | number; onChange: (axis: 'x' | 'y' | 'z', value: number) => void }) {
  return (
    <div className="vector-editor">
      <div className="field-label">Rotacion (grados)</div>
      <div className="vector-grid">
        {(['x', 'y', 'z'] as const).map((axis) => {
          const degrees = radiansToDegrees(values[axis])
          return <label key={axis}><span>{axis.toUpperCase()}</span><ValidatedNumberInput disabled={disabled} step={1} value={degrees} resetKey={resetKey} ariaLabel={`Rotacion ${axis.toUpperCase()}`} onCommit={(value) => onChange(axis, value)} /></label>
        })}
      </div>
    </div>
  )
}

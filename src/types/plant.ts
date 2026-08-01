import type { AreaFilter, PlantAreaCode } from '../config/areas'
import type { CameraPresetId, PlantFrontDirection } from '../config/cameraPresets'

export const assetTypes = [
  'box',
  'long_box',
  'cylinder',
  'hollow_cylinder',
  'pipe',
  'beam',
  'plate',
  'roller_table_flat',
  'roller_table_biconical',
  'bancal',
  'rail_bed_multi',
  'lance_carrier_cart',
  'centering_stars',
  'chain_bed',
  'rolling_stand',
  'steader_3_roll',
  'piercer_drive',
  'piercer_machine',
  'electric_motor_horizontal',
  'electric_motor_vertical',
  'gearbox_horizontal',
  'gearbox_vertical',
  'motor_gearbox_parallel',
  'hydraulic_power_unit',
  'transfer_star',
  'transfer_v',
  'transfer_claw',
  'coupling',
  'cardan_shaft',
  'transmission_shaft',
  'centrifugal_pump_horizontal',
  'vertical_pump',
  'industrial_fan',
  'platform',
  'stairs',
  'handrail',
  'column',
  'electrical_panel',
  'cabinet',
  'tank_vertical',
  'tank_horizontal',
  'rectangular_pool',
  'pipe_rack_simple',
  'gearbox',
  'motor',
  'roller',
  'roller_table',
  'pump',
  'tank',
  'conveyor',
  'generic_box',
] as const

export type AssetType = (typeof assetTypes)[number]
export type IndustrialParamKey = 'length' | 'outerDiameter' | 'innerDiameter' | 'radialSegments' | 'rollerSpacing' | 'rollerDiameter' | 'rollerWidth' | 'rollerCount' | 'rollerLength' | 'rollerColor' | 'frameColor' | 'showTubePlaceholder' | 'showHydraulics' | 'showBearingHousings' | 'housingWidth' | 'housingLength' | 'housingHeight' | 'housingBaseThickness' | 'housingCapHeight' | 'housingColor' | 'shaftExtension' | 'railCount' | 'railHeight' | 'railWidth' | 'supportSpacing' | 'showCrossSupports' | 'pumpCount' | 'accumulatorCount' | 'filterCount' | 'valveSections' | 'starCount' | 'chainCount' | 'chainWidth' | 'chainHeight' | 'showSupports' | 'count' | 'spacing' | 'shaftDiameter' | 'shaftLength' | 'supportHeight' | 'supportWidth' | 'pivotAngle' | 'armCount' | 'transferDiameter' | 'columnHeight' | 'vWidth' | 'vOpening' | 'clawLength' | 'clawOpening' | 'baseHeight' | 'openingWidth' | 'openingHeight' | 'frameThickness' | 'rollDiameter' | 'rollAngle' | 'mandrelDiameter' | 'bodyLength' | 'bodyDiameter' | 'bodyEndCapLength' | 'frontNeckLength' | 'frontNeckDiameter' | 'chassisLength' | 'chassisWidth' | 'wheelRadius' | 'wheelWidth' | 'wheelbase' | 'trackWidth' | 'showLance' | 'lanceLength' | 'lanceDiameter' | 'lanceOffsetY' | 'showTowBar' | 'lanceHeight' | 'chassisHeight' | 'wallThickness' | 'bottomThickness' | 'showLiquid' | 'liquidLevel' | 'liquidColor' | 'liquidOpacity' | 'showTopRim' | 'rimWidth' | 'rimHeight' | 'showExternalRibs' | 'ribCountLongSides' | 'ribThickness' | 'supportType' | 'showDrain' | 'drainDiameter' | 'drainSide' | 'bodyColor' | 'interiorColor' | 'width' | 'height' | 'depth'
export type IndustrialParamValue = number | string
export type Criticality = 'A' | 'B' | 'C' | 'D' | ''
export type PlantSystem = '' | 'mecanico' | 'hidraulico' | 'lubricacion' | 'electrico' | 'instrumentacion'
export type EditMode = 'move' | 'rotate' | 'scale'
export type LabelMode = 'id' | 'name' | 'area'
export type ColorMode = 'manual' | 'criticality' | 'area'
export type ThemeMode = 'dark' | 'light'
export type CameraViewMode = 'fit_all' | 'fit_selection' | 'fit_layout' | 'front' | 'back' | 'left' | 'right' | 'isometric' | 'isometric_back' | 'top'

export interface Vector3Data { x: number; y: number; z: number }
export interface AssetSize { width: number; height: number; depth: number }

export interface DataSources {
  plcTag: string
  sapEquipmentId: string
  grafanaUrl: string
  powerBiUrl: string
  documentsUrl: string
  photosUrl: string
  failureHistory: string
}

export interface IndustrialAsset {
  id: string
  name: string
  type: AssetType
  area: string
  areaCode: PlantAreaCode
  system: PlantSystem
  position: Vector3Data
  rotation: Vector3Data
  size: AssetSize
  uniformScale: number
  params: Partial<Record<IndustrialParamKey, IndustrialParamValue>>
  color: string
  criticality: Criticality
  locked: boolean
  tags: string[]
  description: string
  dataSources: DataSources
}

export interface ReferenceLayoutPoint {
  u: number
  v: number
}

export interface ReferenceLayoutCalibration {
  pointA?: ReferenceLayoutPoint
  pointB?: ReferenceLayoutPoint
  realDistance?: number
  calibrated: boolean
}

export interface ReferenceLayoutCrop {
  enabled: boolean
  uMin: number
  vMin: number
  uMax: number
  vMax: number
}

export interface ReferenceLayout {
  textureDataUrl?: string
  sourceDataUrl?: string
  sourceType?: 'image' | 'pdf'
  layoutPath: string
  fileName: string
  mimeType: string
  widthPx: number
  heightPx: number
  naturalWidth: number
  naturalHeight: number
  aspectRatio: number
  baseWidth: number
  baseHeight: number
  uniformScale: number
  stretchWidth: number
  stretchHeight: number
  position: Vector3Data
  rotation: Vector3Data
  opacity: number
  visible: boolean
  locked: boolean
  lockAspectRatio: boolean
  calibration: ReferenceLayoutCalibration
  crop: ReferenceLayoutCrop
  missing: boolean
}

export interface SnapSettings {
  enabled: boolean
  gridSize: number
  rotationSnapEnabled: boolean
  rotationSnapAngle: number
  scaleStep: number
}

export type RotationAxis = 'x' | 'y' | 'z'
export type AlignmentAxis = 'x' | 'y' | 'z'
export type AlignmentMode = 'min' | 'center' | 'max'

export interface ViewSettings {
  showLabels: boolean
  showResizeHandles: boolean
  labelMode: LabelMode
  colorMode: ColorMode
  areaFilter: AreaFilter
  editLayout: boolean
  theme: ThemeMode
  plantFrontDirection: PlantFrontDirection
  activeCameraPreset: CameraPresetId
}

export interface PlantSceneDocument {
  version: 2
  objects: IndustrialAsset[]
  referenceLayout: ReferenceLayout | null
  layout?: ReferenceLayout | null
  snap: SnapSettings
  view: ViewSettings
}

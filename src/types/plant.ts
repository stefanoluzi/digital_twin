export const assetTypes = [
  'gearbox', 'motor', 'roller', 'roller_table', 'pump', 'tank', 'conveyor', 'generic_box',
] as const

export type AssetType = (typeof assetTypes)[number]
export type Criticality = 'A' | 'B' | 'C' | 'D' | ''
export type PlantSystem = '' | 'mecanico' | 'hidraulico' | 'lubricacion' | 'electrico' | 'instrumentacion'
export type EditMode = 'move' | 'rotate' | 'scale'
export type LabelMode = 'id' | 'name'
export type ColorMode = 'manual' | 'criticality'

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
  system: PlantSystem
  position: Vector3Data
  rotation: Vector3Data
  size: AssetSize
  color: string
  criticality: Criticality
  tags: string[]
  description: string
  dataSources: DataSources
}

export interface LayoutImage {
  dataUrl: string
  fileName: string
  mimeType: string
  widthPx: number
  heightPx: number
  scale: number
  opacity: number
  visible: boolean
}

export interface SnapSettings {
  enabled: boolean
  gridSize: number
  rotationDegrees: number
  scaleStep: number
}

export interface ViewSettings {
  showLabels: boolean
  labelMode: LabelMode
  colorMode: ColorMode
}

export interface PlantSceneDocument {
  version: 2
  objects: IndustrialAsset[]
  layout: LayoutImage | null
  snap: SnapSettings
  view: ViewSettings
}

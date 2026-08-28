import type { IndustrialAsset, ReferenceLayout, SnapSettings, Vector3Data, ViewSettings } from './plant'
import type { InsertionLevelCode, PlantLevelDefinition, VisibleLevelFilter } from '../config/plantLevels'
import type { MaintenanceData } from '../maintenance/domain/maintenanceTypes'

export const PROJECT_FORMAT = 'LACO3D_PROJECT' as const
export const PROJECT_SCHEMA_VERSION = 4 as const

export interface ProjectMetadata {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface ProjectCameraState {
  type: 'orthographic' | 'perspective'
  position: Vector3Data
  target: Vector3Data
  zoom?: number
  fov?: number
}

export interface ProjectReferenceLayout extends Omit<ReferenceLayout, 'textureDataUrl' | 'layoutPath' | 'missing' | 'sourceDataUrl' | 'sourceType'> {
  sourceType: 'image' | 'pdf'
  sourceDataUrl: string
  previewImageDataUrl?: string
}

export interface DigitalTwinProject {
  format: typeof PROJECT_FORMAT
  schemaVersion: typeof PROJECT_SCHEMA_VERSION
  appVersion: string
  project: ProjectMetadata
  scene: {
    objects: IndustrialAsset[]
    referenceLayout: ProjectReferenceLayout | null
    viewSettings: ViewSettings
    snapSettings: SnapSettings
    plantLevels?: PlantLevelDefinition[]
    activeLevel?: InsertionLevelCode
    visibleLevelFilter?: VisibleLevelFilter
    showLevel0Grid?: boolean
    showLevel1Grid?: boolean
    camera: ProjectCameraState
  }
  maintenance: MaintenanceData
}

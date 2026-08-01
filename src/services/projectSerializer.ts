import type { PlantSceneDocument, ReferenceLayout } from '../types/plant'
import {
  PROJECT_FORMAT,
  PROJECT_SCHEMA_VERSION,
  type DigitalTwinProject,
  type ProjectCameraState,
  type ProjectMetadata,
  type ProjectReferenceLayout,
} from '../types/project'
import { validateProjectFile } from './projectValidator'

const APP_VERSION = '0.1.0'

function serializeReferenceLayout(layout: ReferenceLayout | null): ProjectReferenceLayout | null {
  if (!layout) return null
  const sourceType = layout.sourceType ?? (layout.mimeType === 'application/pdf' ? 'pdf' : 'image')
  const sourceDataUrl = layout.sourceDataUrl ?? layout.textureDataUrl ?? ''
  if (!sourceDataUrl) throw new Error('El Reference Layout no contiene datos embebidos y no puede guardarse como sesion portable.')
  const { textureDataUrl, layoutPath: _layoutPath, missing: _missing, sourceDataUrl: _sourceDataUrl, sourceType: _sourceType, ...settings } = layout
  return {
    ...settings,
    sourceType,
    sourceDataUrl,
    previewImageDataUrl: sourceType === 'pdf' ? textureDataUrl : undefined,
  }
}

function restoreReferenceLayout(layout: ProjectReferenceLayout | null): ReferenceLayout | null {
  if (!layout) return null
  const textureDataUrl = layout.sourceType === 'pdf' ? layout.previewImageDataUrl : layout.sourceDataUrl
  if (!textureDataUrl) throw new Error('La sesion no contiene una representacion visual valida del Reference Layout.')
  return {
    ...layout,
    sourceType: layout.sourceType,
    sourceDataUrl: layout.sourceDataUrl,
    textureDataUrl,
    layoutPath: layout.fileName,
    missing: false,
  }
}

export function createProjectFile(
  scene: Pick<PlantSceneDocument, 'objects' | 'referenceLayout' | 'snap' | 'view'>,
  metadata: ProjectMetadata,
  camera: ProjectCameraState,
): DigitalTwinProject {
  return {
    format: PROJECT_FORMAT,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    project: { ...metadata, updatedAt: new Date().toISOString() },
    scene: {
      objects: structuredClone(scene.objects),
      referenceLayout: serializeReferenceLayout(scene.referenceLayout),
      viewSettings: structuredClone(scene.view),
      snapSettings: structuredClone(scene.snap),
      camera: structuredClone(camera),
    },
  }
}

export function normalizeProjectFile(data: unknown): DigitalTwinProject {
  validateProjectFile(data)
  const now = new Date().toISOString()
  const raw = data as DigitalTwinProject
  return {
    ...raw,
    project: {
      id: typeof raw.project.id === 'string' && raw.project.id ? raw.project.id : createProjectId(),
      name: typeof raw.project.name === 'string' && raw.project.name ? raw.project.name : 'Proyecto LACO3D',
      description: typeof raw.project.description === 'string' ? raw.project.description : '',
      createdAt: typeof raw.project.createdAt === 'string' ? raw.project.createdAt : now,
      updatedAt: typeof raw.project.updatedAt === 'string' ? raw.project.updatedAt : now,
    },
    scene: {
      objects: raw.scene.objects,
      referenceLayout: raw.scene.referenceLayout ?? null,
      viewSettings: raw.scene.viewSettings ?? {} as DigitalTwinProject['scene']['viewSettings'],
      snapSettings: raw.scene.snapSettings ?? {} as DigitalTwinProject['scene']['snapSettings'],
      camera: normalizeCamera(raw.scene.camera),
    },
  }
}

export function projectToSceneDocument(project: DigitalTwinProject): PlantSceneDocument {
  return {
    version: 2,
    objects: project.scene.objects,
    referenceLayout: restoreReferenceLayout(project.scene.referenceLayout),
    snap: project.scene.snapSettings,
    view: project.scene.viewSettings,
  }
}

export function createProjectId() {
  return globalThis.crypto?.randomUUID?.() ?? `project-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createDefaultMetadata(name = 'Proyecto LACO3D'): ProjectMetadata {
  const now = new Date().toISOString()
  return { id: createProjectId(), name, description: '', createdAt: now, updatedAt: now }
}

export function defaultCameraState(): ProjectCameraState {
  return {
    type: 'orthographic',
    position: { x: 14, y: 12, z: 14 },
    target: { x: 0, y: 0, z: 0 },
    zoom: 48,
  }
}

function normalizeCamera(camera?: Partial<ProjectCameraState>): ProjectCameraState {
  const fallback = defaultCameraState()
  const finite = (value: unknown, defaultValue: number) => typeof value === 'number' && Number.isFinite(value) ? value : defaultValue
  return {
    type: camera?.type === 'perspective' ? 'perspective' : 'orthographic',
    position: {
      x: finite(camera?.position?.x, fallback.position.x),
      y: finite(camera?.position?.y, fallback.position.y),
      z: finite(camera?.position?.z, fallback.position.z),
    },
    target: {
      x: finite(camera?.target?.x, fallback.target.x),
      y: finite(camera?.target?.y, fallback.target.y),
      z: finite(camera?.target?.z, fallback.target.z),
    },
    zoom: Math.max(0.001, finite(camera?.zoom, fallback.zoom ?? 1)),
    fov: Math.max(1, finite(camera?.fov, 45)),
  }
}

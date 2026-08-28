import { create } from 'zustand'
import { createDefaultMetadata, defaultCameraState } from '../services/projectSerializer'
import type { ProjectCameraState, ProjectMetadata } from '../types/project'

interface ProjectState {
  hasActiveProject: boolean
  metadata: ProjectMetadata
  fileName: string | null
  isDirty: boolean
  isHydrating: boolean
  camera: ProjectCameraState
  cameraRestoreRequest: { camera: ProjectCameraState; nonce: number } | null
  markDirty: () => void
  markSaved: (fileName: string, metadata?: ProjectMetadata) => void
  beginHydration: () => void
  endHydration: () => void
  replaceProject: (metadata: ProjectMetadata, camera: ProjectCameraState, fileName: string | null) => void
  createNewProject: () => void
  updateMetadata: (update: Partial<ProjectMetadata>) => void
  setCamera: (camera: ProjectCameraState, dirty?: boolean) => void
  requestCameraRestore: (camera?: ProjectCameraState) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  hasActiveProject: false,
  metadata: createDefaultMetadata(),
  fileName: null,
  isDirty: false,
  isHydrating: false,
  camera: defaultCameraState(),
  cameraRestoreRequest: null,
  markDirty: () => set((state) => state.isHydrating ? state : { hasActiveProject: true, isDirty: true }),
  markSaved: (fileName, metadata) => set({ hasActiveProject: true, fileName, metadata: metadata ?? get().metadata, isDirty: false }),
  beginHydration: () => set({ isHydrating: true }),
  endHydration: () => set({ isHydrating: false }),
  replaceProject: (metadata, camera, fileName) => set({ hasActiveProject: true, metadata, camera, fileName, isDirty: false, cameraRestoreRequest: { camera, nonce: Date.now() } }),
  createNewProject: () => {
    const camera = defaultCameraState()
    set({ hasActiveProject: true, metadata: createDefaultMetadata(), camera, fileName: null, isDirty: false, cameraRestoreRequest: { camera, nonce: Date.now() } })
  },
  updateMetadata: (update) => set((state) => ({ hasActiveProject: true, metadata: { ...state.metadata, ...update }, isDirty: state.isHydrating ? state.isDirty : true })),
  setCamera: (camera, dirty = false) => set((state) => ({ camera, isDirty: dirty && state.hasActiveProject && !state.isHydrating ? true : state.isDirty })),
  requestCameraRestore: (camera) => {
    const next = camera ?? get().camera
    set({ cameraRestoreRequest: { camera: next, nonce: Date.now() } })
  },
}))

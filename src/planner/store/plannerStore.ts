import { create } from 'zustand'
import { createDefaultPlannerData, normalizePlannerData } from '../data/plannerNormalizer'
import type { ParadaEvent, PlannerModuleData, ProjectInfo, Task } from '../types'

export type PlannerStorageStatus = 'IDLE' | 'LOADING' | 'SAVING' | 'SAVED' | 'ERROR'

interface PlannerStore extends PlannerModuleData {
  storageStatus: PlannerStorageStatus
  storageError: string
  hydrate: (data: PlannerModuleData) => void
  replaceData: (data: PlannerModuleData) => void
  setProjectInfo: (value: ProjectInfo) => void
  setTasks: (value: Task[]) => void
  setParadas: (value: ParadaEvent[]) => void
  setStorageState: (status: PlannerStorageStatus, error?: string) => void
}

export const usePlannerStore = create<PlannerStore>((set) => ({
  ...createDefaultPlannerData(),
  storageStatus: 'IDLE',
  storageError: '',
  hydrate: (data) => set({ ...normalizePlannerData(data) }),
  replaceData: (data) => set({ ...normalizePlannerData(data) }),
  setProjectInfo: (projectInfo) => set({ projectInfo: structuredClone(projectInfo) }),
  setTasks: (tasks) => set({ tasks: structuredClone(tasks) }),
  setParadas: (paradas) => set({ paradas: structuredClone(paradas) }),
  setStorageState: (storageStatus, storageError = '') => set({ storageStatus, storageError }),
}))

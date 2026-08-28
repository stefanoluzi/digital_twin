import { create } from 'zustand'
import type { VisualPreset } from './visualTheme'
import type { PlantAreaCode } from '../config/areas'
import type { ScenePresentationLevel } from './presentationLOD'

const PRESET_KEY = 'industrial-twin-visual-preset'
const GRID_KEY = 'industrial-twin-digital-twin-grid'

function readPreset(): VisualPreset {
  if (typeof window === 'undefined') return 'DIGITAL_TWIN'
  return window.localStorage.getItem(PRESET_KEY) === 'EDITOR' ? 'EDITOR' : 'DIGITAL_TWIN'
}

function readGridPreference() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(GRID_KEY) === 'true'
}

interface VisualizationState {
  visualPreset: VisualPreset
  showDigitalTwinGrid: boolean
  focusedAreaCode: PlantAreaCode | null
  focusMode: 'DIM' | 'HIDE'
  showAreaLabels: boolean
  presentationLevel: ScenePresentationLevel
  overviewRequestNonce: number
  focusAreaRequest: { areaCode: PlantAreaCode; nonce: number } | null
  setVisualPreset: (visualPreset: VisualPreset) => void
  setShowDigitalTwinGrid: (showDigitalTwinGrid: boolean) => void
  requestOverview: () => void
  focusArea: (areaCode: PlantAreaCode) => void
  clearFocusedArea: () => void
  setFocusMode: (focusMode: 'DIM' | 'HIDE') => void
  setShowAreaLabels: (showAreaLabels: boolean) => void
  setPresentationLevel: (presentationLevel: ScenePresentationLevel) => void
}

export const useVisualizationStore = create<VisualizationState>((set) => ({
  visualPreset: readPreset(),
  showDigitalTwinGrid: readGridPreference(),
  focusedAreaCode: null,
  focusMode: 'DIM',
  showAreaLabels: true,
  presentationLevel: 'DETAIL',
  overviewRequestNonce: 0,
  focusAreaRequest: null,
  setVisualPreset: (visualPreset) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(PRESET_KEY, visualPreset)
    set({ visualPreset })
  },
  setShowDigitalTwinGrid: (showDigitalTwinGrid) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(GRID_KEY, String(showDigitalTwinGrid))
    set({ showDigitalTwinGrid })
  },
  requestOverview: () => set({ focusedAreaCode: null, overviewRequestNonce: Date.now(), focusAreaRequest: null }),
  focusArea: (areaCode) => set({ focusedAreaCode: areaCode, focusAreaRequest: { areaCode, nonce: Date.now() } }),
  clearFocusedArea: () => set({ focusedAreaCode: null, focusAreaRequest: null }),
  setFocusMode: (focusMode) => set({ focusMode }),
  setShowAreaLabels: (showAreaLabels) => set({ showAreaLabels }),
  setPresentationLevel: (presentationLevel) => set((state) => state.presentationLevel === presentationLevel ? state : { presentationLevel }),
}))

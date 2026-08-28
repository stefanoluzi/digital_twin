export type VisualPreset = 'EDITOR' | 'DIGITAL_TWIN'

export interface VisualTheme {
  background: string
  ground: string
  gridCenter: string
  grid: string
  lighting: {
    ambientIntensity: number
    hemisphere: { sky: string; ground: string; intensity: number }
    key: { color: string; position: [number, number, number]; intensity: number }
    fill: { color: string; position: [number, number, number]; intensity: number }
  }
  shadows: {
    enabled: boolean
    mapSize: number
    cameraExtent: number
    near: number
    far: number
    bias: number
    normalBias: number
    maxCastersPerAsset: number
  }
  renderer: { toneMapping: 'NONE' | 'ACES'; exposure: number }
}

export const EDITOR_VISUAL_THEME: VisualTheme = {
  background: '#1b2228',
  ground: '#202932',
  gridCenter: '#6d7b86',
  grid: '#3c4852',
  lighting: {
    ambientIntensity: 2.1,
    hemisphere: { sky: '#d8edf8', ground: '#303942', intensity: 1.1 },
    key: { color: '#ffffff', position: [12, 18, 10], intensity: 1.25 },
    fill: { color: '#ffffff', position: [-12, 8, -10], intensity: 0 },
  },
  shadows: {
    enabled: false,
    mapSize: 1024,
    cameraExtent: 250,
    near: 0.1,
    far: 700,
    bias: -0.0002,
    normalBias: 0.025,
    maxCastersPerAsset: 0,
  },
  renderer: { toneMapping: 'NONE', exposure: 1 },
}

export const DIGITAL_TWIN_THEME: VisualTheme = {
  background: '#edf1f3',
  ground: '#dfe4e7',
  gridCenter: '#aab4ba',
  grid: '#cbd2d6',
  lighting: {
    ambientIntensity: 0.34,
    hemisphere: { sky: '#f7f9fa', ground: '#89949a', intensity: 1.35 },
    key: { color: '#fffaf2', position: [90, 160, 115], intensity: 2.35 },
    fill: { color: '#dcebf2', position: [-90, 70, -105], intensity: 0.42 },
  },
  shadows: {
    enabled: true,
    mapSize: 2048,
    cameraExtent: 320,
    near: 0.1,
    far: 750,
    bias: -0.00018,
    normalBias: 0.025,
    maxCastersPerAsset: 10,
  },
  renderer: { toneMapping: 'ACES', exposure: 1.08 },
}

export function getVisualTheme(preset: VisualPreset, editorTheme: 'dark' | 'light' = 'dark'): VisualTheme {
  if (preset === 'DIGITAL_TWIN') return DIGITAL_TWIN_THEME
  if (editorTheme === 'light') {
    return {
      ...EDITOR_VISUAL_THEME,
      background: '#eef2f5',
      ground: '#e2e8ee',
      gridCenter: '#7b8794',
      grid: '#c1cad3',
    }
  }
  return EDITOR_VISUAL_THEME
}

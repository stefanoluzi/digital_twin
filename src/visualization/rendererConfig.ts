import * as THREE from 'three'
import type { VisualTheme } from './visualTheme'

export function configureRenderer(renderer: THREE.WebGLRenderer, theme: VisualTheme) {
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = theme.renderer.toneMapping === 'ACES'
    ? THREE.ACESFilmicToneMapping
    : THREE.NoToneMapping
  renderer.toneMappingExposure = theme.renderer.exposure
  renderer.shadowMap.enabled = theme.shadows.enabled
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
}

import type { IndustrialAsset } from '../types/plant'

export const MIN_UNIFORM_SCALE = 0.01
export const MAX_UNIFORM_SCALE = 100
export const UNIFORM_SCALE_FACTOR = 1.1

export function clampUniformScale(value: unknown, fallback = 1) {
  const finite = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(MAX_UNIFORM_SCALE, Math.max(MIN_UNIFORM_SCALE, finite))
}

export function applyUniformScale(asset: IndustrialAsset, requestedScale: number): IndustrialAsset {
  const previousScale = clampUniformScale(asset.uniformScale)
  const uniformScale = clampUniformScale(requestedScale, previousScale)
  const baseElevation = asset.position.y - asset.size.height * previousScale / 2

  return {
    ...asset,
    uniformScale,
    position: {
      ...asset.position,
      y: baseElevation + asset.size.height * uniformScale / 2,
    },
  }
}

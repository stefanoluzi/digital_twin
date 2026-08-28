import type { PlantAreaCode } from '../config/areas'
import { getIndustrialAssetWorldTransform } from '../services/sceneWorldTransformService'
import type { IndustrialAsset } from '../types/plant'

export type ScenePresentationLevel = 'OVERVIEW' | 'AREA' | 'DETAIL'
export type LabelLOD = 'HIDDEN' | 'IMPORTANT' | 'NEARBY' | 'ALL'
export type LabelPriority = 'HIGH' | 'NORMAL' | 'LOW'

export const PRESENTATION_LOD_CONFIG = {
  overviewMaxOrthographicZoom: 7,
  areaMaxOrthographicZoom: 62,
  overviewMaxPerspectiveRatio: 8,
  areaMaxPerspectiveRatio: 3,
  digitalTwinLayoutOpacityFactor: 0.35,
  digitalTwinIsometricElevation: 0.58,
  focusDimOpacity: 0.34,
  overviewFitMargin: 1.24,
  areaFitMargin: 1.28,
} as const

export function getScenePresentationLevel({
  orthographicZoom,
  cameraDistance,
  visibleSpan,
}: {
  orthographicZoom?: number
  cameraDistance?: number
  visibleSpan?: number
}): ScenePresentationLevel {
  if (Number.isFinite(orthographicZoom)) {
    if ((orthographicZoom as number) <= PRESENTATION_LOD_CONFIG.overviewMaxOrthographicZoom) return 'OVERVIEW'
    if ((orthographicZoom as number) <= PRESENTATION_LOD_CONFIG.areaMaxOrthographicZoom) return 'AREA'
    return 'DETAIL'
  }
  const ratio = (cameraDistance ?? 0) / Math.max(visibleSpan ?? 1, 0.001)
  if (ratio >= PRESENTATION_LOD_CONFIG.overviewMaxPerspectiveRatio) return 'OVERVIEW'
  if (ratio >= PRESENTATION_LOD_CONFIG.areaMaxPerspectiveRatio) return 'AREA'
  return 'DETAIL'
}

export function getLabelLOD(level: ScenePresentationLevel): LabelLOD {
  if (level === 'OVERVIEW') return 'IMPORTANT'
  if (level === 'AREA') return 'NEARBY'
  return 'ALL'
}

const REPETITIVE_ASSET_TYPES = new Set<IndustrialAsset['type']>([
  'roller_table_flat',
  'roller_table_biconical',
  'roller_table',
  'roller',
  'chain_bed',
  'transfer_star',
  'transfer_v',
  'transfer_claw',
  'bancal',
  'rail_bed_multi',
  'handrail',
  'column',
])

export function getAssetLabelPriority(asset: IndustrialAsset): LabelPriority {
  const explicit = (asset as IndustrialAsset & { labelPriority?: LabelPriority }).labelPriority
  if (explicit) return explicit
  if (REPETITIVE_ASSET_TYPES.has(asset.type) || /_COPY(?:_\d+)?$/i.test(asset.id)) return 'LOW'
  return 'NORMAL'
}

export function shouldShowLabel({
  asset,
  labelLOD,
  labelsEnabled,
  selected = false,
  hovered = false,
  maintenanceStatus,
  focusedAreaCode,
}: {
  asset: IndustrialAsset
  labelLOD: LabelLOD
  labelsEnabled: boolean
  selected?: boolean
  hovered?: boolean
  maintenanceStatus?: string
  focusedAreaCode?: PlantAreaCode | null
}) {
  if (selected || hovered) return true
  if (!labelsEnabled || labelLOD === 'HIDDEN') return false
  if (focusedAreaCode && asset.areaCode !== focusedAreaCode) return false
  const maintenanceAlert = maintenanceStatus === 'OVERDUE' || maintenanceStatus === 'DUE_SOON'
  const priority = getAssetLabelPriority(asset)
  if (labelLOD === 'IMPORTANT') return maintenanceAlert || priority === 'HIGH'
  if (labelLOD === 'NEARBY') return maintenanceAlert || priority !== 'LOW'
  return true
}

export interface AreaBounds {
  min: { x: number; y: number; z: number }
  max: { x: number; y: number; z: number }
  center: { x: number; y: number; z: number }
  size: { x: number; y: number; z: number }
  count: number
}

export function getAreaBoundingBox(assets: IndustrialAsset[], areaCode?: PlantAreaCode): AreaBounds | null {
  const targets = areaCode ? assets.filter((asset) => asset.areaCode === areaCode) : assets
  if (!targets.length) return null
  const min = { x: Infinity, y: Infinity, z: Infinity }
  const max = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (const asset of targets) {
    const transform = getIndustrialAssetWorldTransform(asset)
    const half = {
      x: asset.size.width * transform.scale.x / 2,
      y: asset.size.height * transform.scale.y / 2,
      z: asset.size.depth * transform.scale.z / 2,
    }
    min.x = Math.min(min.x, transform.position.x - half.x)
    min.y = Math.min(min.y, transform.position.y - half.y)
    min.z = Math.min(min.z, transform.position.z - half.z)
    max.x = Math.max(max.x, transform.position.x + half.x)
    max.y = Math.max(max.y, transform.position.y + half.y)
    max.z = Math.max(max.z, transform.position.z + half.z)
  }
  return {
    min,
    max,
    center: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 },
    size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z },
    count: targets.length,
  }
}

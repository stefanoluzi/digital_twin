import type { AssetSize, AssetType, IndustrialAsset, IndustrialParamKey, IndustrialParamValue } from '../types/plant'
import { definitions } from './objectFactory'

const positive = (value: unknown, fallback: number, min = 0.05) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback
const booleanNumber = (value: unknown, fallback: number) => {
  if (value === true) return 1
  if (value === false) return 0
  return typeof value === 'number' && Number.isFinite(value) ? (value > 0 ? 1 : 0) : fallback
}
const colorString = (value: unknown, fallback: IndustrialParamValue) =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
const count = (value: unknown, fallback: number, min: number, max: number) => {
  const next = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.max(min, Math.min(max, next))
}
const commonShaftWidth = (params: Partial<Record<IndustrialParamKey, IndustrialParamValue>>, fallbackEndMargin: number) => {
  const itemCount = positive(params.count, 1, 1)
  const spacing = positive(params.spacing, 1.8, 0.2)
  const endMargin = positive(params.shaftLength, fallbackEndMargin, 0.4)
  return Math.max(endMargin, (itemCount - 1) * spacing + endMargin)
}

export function defaultParamsForType(type: AssetType): Partial<Record<IndustrialParamKey, IndustrialParamValue>> {
  return { ...(definitions[type]?.params ?? {}) }
}

export function normalizeParamsForType(type: AssetType, params?: Partial<Record<IndustrialParamKey, IndustrialParamValue>>) {
  const defaults = defaultParamsForType(type)
  const normalized: Partial<Record<IndustrialParamKey, IndustrialParamValue>> = {}

  ;(Object.keys(defaults) as IndustrialParamKey[]).forEach((key) => {
    if (key === 'rollerColor' || key === 'frameColor') normalized[key] = colorString(params?.[key], defaults[key] ?? '#707b86')
    else if (key === 'showCrossSupports' || key === 'showTubePlaceholder' || key === 'showHydraulics' || key === 'showSupports') normalized[key] = booleanNumber(params?.[key], Number(defaults[key] ?? 1))
    else if (key === 'pumpCount') normalized[key] = count(params?.[key], Number(defaults[key] ?? 1), 1, 2)
    else if (key === 'accumulatorCount' || key === 'filterCount') normalized[key] = count(params?.[key], Number(defaults[key] ?? 0), 0, 4)
    else if (key === 'valveSections') normalized[key] = count(params?.[key], Number(defaults[key] ?? 5), 1, 8)
    else if (key === 'chainCount') normalized[key] = count(params?.[key], Number(defaults[key] ?? 2), 1, 10)
    else if (key === 'count') normalized[key] = count(params?.[key], Number(defaults[key] ?? 1), 1, 24)
    else if (key === 'armCount') normalized[key] = count(params?.[key], Number(defaults[key] ?? 4), 4, 8)
    else normalized[key] = positive(params?.[key], Number(defaults[key] ?? 1))
  })

  return normalized
}

export function sizeFromParams(type: AssetType, params: Partial<Record<IndustrialParamKey, IndustrialParamValue>>, fallback: AssetSize): AssetSize {
  switch (type) {
    case 'roller_table_flat':
    case 'roller_table_biconical':
      return {
        width: positive(params.length, fallback.width),
        height: fallback.height,
        depth: Math.max(2.2, fallback.depth),
      }
    case 'bancal':
    case 'centering_stars':
      return {
        width: positive(params.length, fallback.width),
        height: type === 'centering_stars' ? positive(params.width, fallback.height) : positive(params.height, fallback.height),
        depth: positive(params.width, fallback.depth),
      }
    case 'rail_bed_multi':
      return {
        width: positive(params.length, fallback.width),
        height: Math.max(0.35, positive(params.railHeight, 0.18, 0.05) + 0.32),
        depth: positive(params.width, fallback.depth),
      }
    case 'chain_bed': {
      const rows = positive(params.chainCount, 2, 1)
      return {
        width: positive(params.length, fallback.width),
        height: fallback.height,
        depth: Math.max(1.2, positive(params.width, fallback.depth), rows * 0.28 + 0.9),
      }
    }
    case 'rolling_stand':
      return {
        width: positive(params.width, fallback.width),
        height: positive(params.height, fallback.height),
        depth: fallback.depth,
      }
    case 'piercer_drive':
    case 'piercer_machine':
    case 'hydraulic_power_unit':
    case 'steader_3_roll':
      return {
        width: positive(params.length, fallback.width),
        height: positive(params.height, fallback.height),
        depth: positive(params.width, fallback.depth),
      }
    case 'transfer_star': {
      const diameter = positive(params.transferDiameter, fallback.height, 0.4)
      const supportHeight = positive(params.supportHeight, 0.28, 0.12)
      return {
        width: Math.max(1.2, commonShaftWidth(params, Math.max(1.1, positive(params.height, 0.34, 0.1) * 2.4))),
        height: diameter + supportHeight + 0.2,
        depth: diameter,
      }
    }
    case 'transfer_v': {
      const columnHeight = positive(params.columnHeight, fallback.height, 0.4)
      const vWidth = positive(params.vWidth, fallback.depth, 0.3)
      return {
        width: Math.max(1.2, commonShaftWidth(params, Math.max(0.9, vWidth * 0.9))),
        height: columnHeight + positive(params.supportHeight, 0.28, 0.12) + 0.35,
        depth: vWidth + 0.45,
      }
    }
    case 'transfer_claw': {
      const clawLength = positive(params.clawLength, fallback.depth, 0.4)
      const opening = positive(params.clawOpening, 0.65, 0.15)
      const hookReach = clawLength * (1 + Math.min(1.1, opening) * 0.22)
      return {
        width: Math.max(1.4, commonShaftWidth(params, Math.max(0.9, clawLength * 0.75))),
        height: positive(params.height, fallback.height, 0.6) + positive(params.supportHeight, 0.28, 0.12),
        depth: Math.max(1.2, hookReach + clawLength * 0.35),
      }
    }
    default:
      return fallback
  }
}

export function applyParamUpdate(asset: IndustrialAsset, key: IndustrialParamKey, value: IndustrialParamValue): Partial<IndustrialAsset> {
  const params = normalizeParamsForType(asset.type, { ...asset.params, [key]: value })
  const size = sizeFromParams(asset.type, params, asset.size)
  return { params, size, position: { ...asset.position, y: size.height / 2 } }
}

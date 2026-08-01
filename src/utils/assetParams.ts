import type { AssetSize, AssetType, IndustrialAsset, IndustrialParamKey, IndustrialParamValue } from '../types/plant'
import { definitions } from './objectFactory'

const positive = (value: unknown, fallback: number, min = 0.05) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback
const finite = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
const booleanNumber = (value: unknown, fallback: number) => {
  if (value === true) return 1
  if (value === false) return 0
  return typeof value === 'number' && Number.isFinite(value) ? (value > 0 ? 1 : 0) : fallback
}
const colorString = (value: unknown, fallback: IndustrialParamValue) =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
const clampNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const next = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, next))
}
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
    if (key === 'rollerColor' || key === 'frameColor' || key === 'housingColor' || key === 'liquidColor' || key === 'bodyColor' || key === 'interiorColor') normalized[key] = colorString(params?.[key], defaults[key] ?? '#707b86')
    else if (key === 'supportType') normalized[key] = ['floor', 'legs', 'skid'].includes(String(params?.[key])) ? String(params?.[key]) : String(defaults[key] ?? 'floor')
    else if (key === 'drainSide') normalized[key] = ['left', 'right', 'front', 'rear'].includes(String(params?.[key])) ? String(params?.[key]) : String(defaults[key] ?? 'right')
    else if (key === 'showCrossSupports' || key === 'showTubePlaceholder' || key === 'showHydraulics' || key === 'showBearingHousings' || key === 'showSupports' || key === 'showLance' || key === 'showTowBar' || key === 'showLiquid' || key === 'showTopRim' || key === 'showExternalRibs' || key === 'showDrain') normalized[key] = booleanNumber(params?.[key], Number(defaults[key] ?? 1))
    else if (key === 'liquidLevel' || key === 'liquidOpacity') normalized[key] = clampNumber(params?.[key], Number(defaults[key] ?? 0.5), 0, 1)
    else if (key === 'innerDiameter') normalized[key] = Math.max(0, finite(params?.[key], Number(defaults[key] ?? 0.5)))
    else if (key === 'lanceOffsetY') normalized[key] = finite(params?.[key], Number(defaults[key] ?? 0))
    else if (key === 'pumpCount') normalized[key] = count(params?.[key], Number(defaults[key] ?? 1), 1, 2)
    else if (key === 'accumulatorCount' || key === 'filterCount') normalized[key] = count(params?.[key], Number(defaults[key] ?? 0), 0, 4)
    else if (key === 'valveSections') normalized[key] = count(params?.[key], Number(defaults[key] ?? 5), 1, 8)
    else if (key === 'chainCount') normalized[key] = count(params?.[key], Number(defaults[key] ?? 2), 1, 10)
    else if (key === 'count') normalized[key] = count(params?.[key], Number(defaults[key] ?? 1), 1, 24)
    else if (key === 'armCount') normalized[key] = count(params?.[key], Number(defaults[key] ?? 4), 4, 8)
    else if (key === 'ribCountLongSides') normalized[key] = count(params?.[key], Number(defaults[key] ?? 5), 1, 24)
    else if (key === 'radialSegments') normalized[key] = count(params?.[key], Number(defaults[key] ?? 32), 8, 128)
    else normalized[key] = positive(params?.[key], Number(defaults[key] ?? 1))
  })

  if (type === 'hollow_cylinder') {
    const outerDiameter = positive(normalized.outerDiameter, 1, 0.02)
    normalized.outerDiameter = outerDiameter
    normalized.innerDiameter = clampNumber(normalized.innerDiameter, 0.5, 0, Math.max(0, outerDiameter - 0.02))
    normalized.length = positive(normalized.length, 1.5, 0.01)
  }

  if (type === 'rectangular_pool') {
    const length = positive(normalized.length, 6, 0.3)
    const width = positive(normalized.width, 3, 0.3)
    const height = positive(normalized.height, 1.5, 0.2)
    normalized.length = length
    normalized.width = width
    normalized.height = height
    normalized.wallThickness = clampNumber(normalized.wallThickness, 0.15, 0.02, Math.max(0.02, Math.min(length, width) / 2 - 0.01))
    normalized.bottomThickness = clampNumber(normalized.bottomThickness, 0.2, 0.02, Math.max(0.02, height - 0.01))
  }

  return normalized
}

export function sizeFromParams(type: AssetType, params: Partial<Record<IndustrialParamKey, IndustrialParamValue>>, fallback: AssetSize): AssetSize {
  switch (type) {
    case 'hollow_cylinder': {
      const outerDiameter = positive(params.outerDiameter, 1, 0.02)
      return { width: outerDiameter, height: positive(params.length, 1.5, 0.01), depth: outerDiameter }
    }
    case 'roller_table_flat':
    case 'roller_table_biconical':
      return {
        width: positive(params.length, fallback.width),
        height: fallback.height,
        depth: Math.max(2.2, fallback.depth),
      }
    case 'rectangular_pool': {
      const supportType = String(params.supportType ?? 'floor')
      const supportHeight = supportType === 'floor' ? 0 : positive(params.supportHeight, 0.35, 0.05)
      const rimHeight = Number(params.showTopRim ?? 1) > 0 ? positive(params.rimHeight, 0.08, 0.02) : 0
      const drainReach = Number(params.showDrain ?? 0) > 0
        ? Math.max(positive(params.drainDiameter, 0.18, 0.05), positive(params.wallThickness, 0.15, 0.02) * 2.2)
        : 0
      const drainSide = String(params.drainSide ?? 'right')
      const length = positive(params.length, fallback.width, 0.3)
      const width = positive(params.width, fallback.depth, 0.3)
      return {
        width: length + ((drainSide === 'front' || drainSide === 'rear') ? drainReach * 2 : 0),
        height: supportHeight + positive(params.height, 1.5, 0.2) + rimHeight,
        depth: width + ((drainSide === 'left' || drainSide === 'right') ? drainReach * 2 : 0),
      }
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
    case 'lance_carrier_cart': {
      const bodyLength = positive(params.bodyLength, 3.2, 1)
      const bodyDiameter = positive(params.bodyDiameter, 1.4, 0.5)
      const endCapLength = positive(params.bodyEndCapLength, 0.15, 0.05)
      const neckLength = positive(params.frontNeckLength, 0.35, 0.05)
      const neckDiameter = positive(params.frontNeckDiameter, 0.55, 0.15)
      const chassisLength = positive(params.chassisLength, 3.5, 1)
      const chassisWidth = positive(params.chassisWidth, 1.6, 0.6)
      const wheelRadius = positive(params.wheelRadius, 0.35, 0.1)
      const wheelWidth = positive(params.wheelWidth, 0.2, 0.05)
      const beamHeight = Math.max(0.14, bodyDiameter * 0.12)
      const chassisCenterY = wheelRadius * 1.02
      const chassisTop = chassisCenterY + beamHeight / 2
      const saddleHeight = Math.max(0.1, bodyDiameter * 0.08)
      const bodyCenterY = chassisTop + saddleHeight + bodyDiameter / 2
      const lanceDiameter = positive(params.lanceDiameter, 0.2, 0.05)
      const lanceCenterY = bodyCenterY + finite(params.lanceOffsetY, 0)
      const showLance = Number(params.showLance ?? 1) > 0
      const showTowBar = Number(params.showTowBar ?? 0) > 0
      const rear = Math.min(-bodyLength / 2 - endCapLength, -chassisLength / 2 - (showTowBar ? 0.9 : 0))
      const bodyFront = bodyLength / 2 + endCapLength + neckLength
      const front = Math.max(chassisLength / 2, bodyFront + (showLance ? 0.1 + positive(params.lanceLength, 5, 1) : 0))
      return {
        width: front - rear,
        height: Math.max(wheelRadius * 2, bodyCenterY + bodyDiameter / 2, bodyCenterY + neckDiameter / 2, showLance ? lanceCenterY + lanceDiameter / 2 : 0),
        depth: Math.max(chassisWidth, bodyDiameter, positive(params.trackWidth, 1.45, 0.4) + wheelWidth),
      }
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
  const baseElevation = asset.position.y - asset.size.height * asset.uniformScale / 2
  return { params, size, position: { ...asset.position, y: baseElevation + size.height * asset.uniformScale / 2 } }
}

import type { AssetSize, AssetType, IndustrialAsset, IndustrialParamKey, IndustrialParamValue, LevelPlacementParamKey } from '../types/plant'
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
type ParamKey = IndustrialParamKey | LevelPlacementParamKey

const commonShaftWidth = (params: Partial<Record<ParamKey, IndustrialParamValue>>, fallbackEndMargin: number) => {
  const itemCount = positive(params.count, 1, 1)
  const spacing = positive(params.spacing, 1.8, 0.2)
  const endMargin = positive(params.shaftLength, fallbackEndMargin, 0.4)
  return Math.max(endMargin, (itemCount - 1) * spacing + endMargin)
}

export function defaultParamsForType(type: AssetType): Partial<Record<ParamKey, IndustrialParamValue>> {
  return { ...(definitions[type]?.params ?? {}) }
}

export function normalizeParamsForType(type: AssetType, params?: Partial<Record<ParamKey, IndustrialParamValue>>) {
  const defaults = defaultParamsForType(type)
  const normalized: Partial<Record<ParamKey, IndustrialParamValue>> = {}

  ;(Object.keys(defaults) as ParamKey[]).forEach((key) => {
    if (key === 'placementMode') normalized[key] = params?.[key] === 'inclinedBetweenLevels' ? 'inclinedBetweenLevels' : 'horizontal'
    else if (key === 'startLevel' || key === 'endLevel') normalized[key] = params?.[key] === 'LEVEL_0' ? 'LEVEL_0' : 'LEVEL_1'
    else if (key === 'supportToGround') normalized[key] = booleanNumber(params?.[key], Number(defaults[key] ?? 0))
    else if (key === 'startElevationOffset' || key === 'endElevationOffset' || key === 'inclinationAngle') normalized[key] = finite(params?.[key], Number(defaults[key] ?? 0))
    else if (key === 'rollerColor' || key === 'frameColor' || key === 'housingColor' || key === 'liquidColor' || key === 'bodyColor' || key === 'interiorColor' || key === 'screwColor') normalized[key] = colorString(params?.[key], defaults[key] ?? '#707b86')
    else if (key === 'supportType') normalized[key] = ['floor', 'legs', 'skid'].includes(String(params?.[key])) ? String(params?.[key]) : String(defaults[key] ?? 'floor')
    else if (key === 'drainSide') normalized[key] = ['left', 'right', 'front', 'rear'].includes(String(params?.[key])) ? String(params?.[key]) : String(defaults[key] ?? 'right')
    else if (key === 'showCrossSupports' || key === 'showTubePlaceholder' || key === 'showHydraulics' || key === 'showBearingHousings' || key === 'showSupports' || key === 'showLance' || key === 'showTowBar' || key === 'showLiquid' || key === 'showTopRim' || key === 'showExternalRibs' || key === 'showDrain' || key === 'showBladeTeeth' || key === 'showBladeGuard' || key === 'showBelts' || key === 'showBeltGuard' || key === 'showBillet' || key === 'showBilletSupports' || key === 'showClamps' || key === 'bladeRunning' || key === 'showDriveUnits' || key === 'showReferenceTubes' || key === 'showWalkways' || key === 'showReferenceTube' || key === 'tubePresent' || key === 'machineRunning' || key === 'showReferenceBillet' || key === 'showHydraulicCylinders') normalized[key] = booleanNumber(params?.[key], Number(defaults[key] ?? 1))
    else if (key === 'liquidLevel' || key === 'liquidOpacity' || key === 'jawOpening') normalized[key] = clampNumber(params?.[key], Number(defaults[key] ?? 0.5), 0, 1)
    else if (key === 'innerDiameter') normalized[key] = Math.max(0, finite(params?.[key], Number(defaults[key] ?? 0.5)))
    else if (key === 'lanceOffsetY' || key === 'motorOffsetX' || key === 'motorOffsetY' || key === 'motorOffsetZ' || key === 'shaftFrontOffset' || key === 'screwRotation' || key === 'referenceTubeOffsetY' || key === 'rollHorizontalOffset' || key === 'rollVerticalOffset' || key === 'rollSkewAngle' || key === 'upperRollTiltAngle' || key === 'lowerRollTiltAngle' || key === 'upperRollRotation' || key === 'lowerRollRotation' || key === 'upperRollAngle' || key === 'lowerRollAngle' || key === 'jawAngleMax') normalized[key] = finite(params?.[key], Number(defaults[key] ?? 0))
    else if (key === 'headPosition') normalized[key] = clampNumber(params?.[key], Number(defaults[key] ?? 0), 0, 1)
    else if (key === 'tubeProgress') normalized[key] = clampNumber(params?.[key], Number(defaults[key] ?? 0.5), 0, 1)
    else if (key === 'verticalDriveType') normalized[key] = ['hydraulicCylinder', 'screw', 'hidden'].includes(String(params?.[key])) ? String(params?.[key]) : String(defaults[key] ?? 'hydraulicCylinder')
    else if (key === 'helixDirection') normalized[key] = ['right', 'left', 'alternating'].includes(String(params?.[key])) ? String(params?.[key]) : String(defaults[key] ?? 'right')
    else if (key === 'detailLevel') normalized[key] = ['low', 'medium'].includes(String(params?.[key])) ? String(params?.[key]) : String(defaults[key] ?? 'low')
    else if (key === 'driveMode') normalized[key] = ['individual', 'grouped', 'hidden'].includes(String(params?.[key])) ? String(params?.[key]) : String(defaults[key] ?? 'grouped')
    else if (key === 'pumpCount') normalized[key] = count(params?.[key], Number(defaults[key] ?? 1), 1, 2)
    else if (key === 'accumulatorCount' || key === 'filterCount') normalized[key] = count(params?.[key], Number(defaults[key] ?? 0), 0, 4)
    else if (key === 'valveSections') normalized[key] = count(params?.[key], Number(defaults[key] ?? 5), 1, 8)
    else if (key === 'chainCount') normalized[key] = count(params?.[key], Number(defaults[key] ?? 2), 1, 10)
    else if (key === 'count') normalized[key] = count(params?.[key], Number(defaults[key] ?? 1), 1, 24)
    else if (key === 'armCount') normalized[key] = count(params?.[key], Number(defaults[key] ?? 4), 4, 8)
    else if (key === 'ribCountLongSides') normalized[key] = count(params?.[key], Number(defaults[key] ?? 5), 1, 24)
    else if (key === 'bladeToothCount') normalized[key] = count(params?.[key], Number(defaults[key] ?? 36), 8, 64)
    else if (key === 'drivenPulleyGrooves') normalized[key] = count(params?.[key], Number(defaults[key] ?? 2), 0, 6)
    else if (key === 'screwCount') normalized[key] = count(params?.[key], Number(defaults[key] ?? 16), 2, 60)
    else if (key === 'referenceTubeCount') normalized[key] = count(params?.[key], Number(defaults[key] ?? 2), 1, 8)
    else if (key === 'driveGroupSize' || key === 'walkwayEveryNRows') normalized[key] = count(params?.[key], Number(defaults[key] ?? 4), 1, 20)
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

  if (type === 'linsinger_vertical_saw') {
    const totalHeight = positive(normalized.totalHeight, 5.5, 2.5)
    const headMinHeight = positive(normalized.headMinHeight, 1.8, 0.6)
    const headMaxHeight = Math.max(headMinHeight, Math.min(totalHeight, positive(normalized.headMaxHeight, 4.2, headMinHeight)))
    normalized.totalHeight = totalHeight
    normalized.headMinHeight = headMinHeight
    normalized.headMaxHeight = headMaxHeight
    normalized.verticalStroke = clampNumber(normalized.verticalStroke, 2.4, 0.1, Math.max(0.1, headMaxHeight - headMinHeight))
  }

  if (type === 'cooling_bed') {
    const shaftDiameter = positive(normalized.shaftDiameter, 0.16, 0.05)
    normalized.shaftDiameter = shaftDiameter
    normalized.helixOuterDiameter = Math.max(shaftDiameter * 1.3, positive(normalized.helixOuterDiameter, 0.42, 0.12))
    normalized.helixThickness = clampNumber(normalized.helixThickness, 0.05, 0.015, Number(normalized.helixOuterDiameter) * 0.28)
  }

  if (type === 'piercer_machine') {
    // Sessions created with the former asset used length=X, width=Z and height=Y.
    const legacyParams = params as Record<string, unknown> | undefined
    const migratedWidth = legacyParams?.depth === undefined && legacyParams?.length !== undefined
      ? positive(legacyParams.length, 5.5, 3)
      : positive(normalized.width, 5.5, 3)
    const migratedDepth = legacyParams?.depth === undefined && legacyParams?.length !== undefined
      ? positive(legacyParams.width, 3.5, 1.5)
      : positive(normalized.depth, 3.5, 1.5)
    const migratedHeight = legacyParams?.totalHeight === undefined && legacyParams?.height !== undefined
      ? positive(legacyParams.height, 4.2, 2.4)
      : positive(normalized.totalHeight, 4.2, 2.4)
    const baseHeight = clampNumber(normalized.baseHeight, 0.5, 0.2, migratedHeight * 0.3)
    const sidePlateThickness = clampNumber(normalized.sidePlateThickness, 0.45, 0.18, migratedWidth * 0.2)
    const centralGap = clampNumber(normalized.centralGap, 0.5, 0.18, migratedWidth * 0.35)
    const topModuleWidth = clampNumber(normalized.topModuleWidth, 2.4, 0.65, Math.max(0.65, (migratedWidth - centralGap) / 2))
    const topModuleHeight = clampNumber(normalized.topModuleHeight, 1, 0.35, migratedHeight * 0.32)
    const openingWidth = clampNumber(normalized.openingWidth, 2.2, 0.8, Math.max(0.8, migratedWidth - sidePlateThickness * 2.4))
    const openingHeight = clampNumber(normalized.openingHeight, 1.8, 0.6, Math.max(0.6, migratedHeight - baseHeight - topModuleHeight * 0.75))
    const rollDiameter = clampNumber(normalized.rollDiameter, 0.75, 0.2, openingHeight * 0.5)
    normalized.width = migratedWidth
    normalized.depth = migratedDepth
    normalized.totalHeight = migratedHeight
    normalized.baseHeight = baseHeight
    normalized.sidePlateThickness = sidePlateThickness
    normalized.centralGap = centralGap
    normalized.topModuleWidth = topModuleWidth
    normalized.topModuleHeight = topModuleHeight
    normalized.topModuleDepth = clampNumber(normalized.topModuleDepth, 3.2, 0.8, migratedDepth * 1.1)
    normalized.openingWidth = openingWidth
    normalized.openingHeight = openingHeight
    normalized.rollLength = clampNumber(normalized.rollLength, 2.4, 0.6, migratedDepth * 0.86)
    normalized.rollDiameter = rollDiameter
    normalized.rollEndDiameter = clampNumber(normalized.rollEndDiameter, 0.55, 0.15, rollDiameter)
    normalized.shaftDiameter = clampNumber(normalized.shaftDiameter, 0.25, 0.08, Number(normalized.rollEndDiameter) * 0.75)
    normalized.rollHorizontalOffset = clampNumber(normalized.rollHorizontalOffset, 0.45, 0, openingWidth * 0.32)
    normalized.rollVerticalOffset = clampNumber(normalized.rollVerticalOffset, 0.35, 0, openingHeight * 0.28)
    normalized.rollCenterDistance = clampNumber(normalized.rollCenterDistance, 1, rollDiameter * 0.85, openingHeight * 0.82)
    normalized.rollSkewAngle = clampNumber(normalized.rollSkewAngle, 10, -35, 35)
    normalized.upperRollTiltAngle = clampNumber(normalized.upperRollTiltAngle, 8, -35, 35)
    normalized.lowerRollTiltAngle = clampNumber(normalized.lowerRollTiltAngle, -8, -35, 35)
    normalized.referenceTubeDiameter = clampNumber(normalized.referenceTubeDiameter, 0.28, 0.08, Math.max(0.08, Number(normalized.rollCenterDistance) - rollDiameter * 0.45))
    normalized.referenceTubeLength = positive(normalized.referenceTubeLength, migratedDepth * 1.4, 0.8)
    normalized.referenceTubeOffsetY = clampNumber(normalized.referenceTubeOffsetY, 0, -openingHeight * 0.4, openingHeight * 0.4)
  }

  if (type === 'billet_tong') {
    const frameWidth = positive(normalized.frameWidth, 3.5, 1.2)
    const frameHeight = positive(normalized.frameHeight, 2, 0.8)
    const frameDepth = positive(normalized.frameDepth, 1.5, 0.6)
    const armLength = positive(normalized.armLength, 8, 1.5)
    const armWidth = clampNumber(normalized.armWidth, 0.5, 0.18, frameWidth * 0.55)
    const armHeight = clampNumber(normalized.armHeight, 0.4, 0.15, frameHeight * 0.48)
    const jawLength = clampNumber(normalized.jawLength, 1.5, 0.4, Math.max(0.4, armLength * 0.45))
    const jawWidth = clampNumber(normalized.jawWidth, 0.25, 0.1, frameWidth * 0.18)
    const jawThickness = clampNumber(normalized.jawThickness, 0.15, 0.06, jawWidth)
    normalized.frameWidth = frameWidth
    normalized.frameHeight = frameHeight
    normalized.frameDepth = frameDepth
    normalized.armLength = armLength
    normalized.armWidth = armWidth
    normalized.armHeight = armHeight
    normalized.jawLength = jawLength
    normalized.jawWidth = jawWidth
    normalized.jawThickness = jawThickness
    normalized.jawOpening = clampNumber(normalized.jawOpening, 0.3, 0, 1)
    normalized.jawAngleMax = clampNumber(normalized.jawAngleMax, 35, 0, 70)
    normalized.billetDiameter = clampNumber(normalized.billetDiameter, 0.25, 0.08, Math.max(0.08, frameWidth * 0.3))
    normalized.billetLength = positive(normalized.billetLength, 2, 0.5)
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
    case 'bundle_saw': {
      const length = positive(params.length, 3.5, 1)
      const width = positive(params.width, 2, 0.8)
      const chassisHeight = positive(params.chassisHeight, 0.45, 0.15)
      const wheelRadius = positive(params.wheelRadius, 0.35, 0.1)
      const wheelWidth = positive(params.wheelWidth, 0.2, 0.05)
      const trackWidth = Math.min(width * 1.15, positive(params.trackWidth, 1.7, 0.5))
      const shaftLength = positive(params.shaftLength, 2.8, width * 0.8)
      const shaftHeight = Math.max(wheelRadius * 2 + chassisHeight * 0.35, positive(params.shaftHeight, 1, 0.35))
      const shaftFrontOffset = finite(params.shaftFrontOffset, 1.2)
      const bladeDiameter = positive(params.bladeDiameter, 1.6, 0.4)
      const bladeThickness = positive(params.bladeThickness, 0.08, 0.02)
      const toothReach = Number(params.showBladeTeeth ?? 1) > 0 ? Math.max(0.045, bladeDiameter * 0.055) * 0.68 : 0
      const drivenPulleyDiameter = positive(params.drivenPulleyDiameter, 0.8, 0.25)
      const drivenPulleyWidth = positive(params.drivenPulleyWidth, 0.2, 0.05)
      const motorLength = positive(params.motorLength, 1.4, 0.5)
      const motorDiameter = positive(params.motorDiameter, 0.65, 0.25)
      const motorHeight = positive(params.motorHeight, 1.6, 0.8)
      const motorOffsetX = finite(params.motorOffsetX, -0.35)
      const motorOffsetZ = finite(params.motorOffsetZ, 0.2)
      const platformTop = wheelRadius * 1.02 + chassisHeight * 0.88 + Math.max(0.1, chassisHeight * 0.24)
      const motorCenterY = Math.max(platformTop + motorDiameter * 0.48, motorHeight - motorDiameter * 0.5)
      const bladeRadius = bladeDiameter / 2 + toothReach
      const drivenPulleyX = -shaftLength / 2 - drivenPulleyWidth
      const bladeX = shaftLength / 2 + bladeThickness
      const wheelReach = trackWidth / 2 + wheelWidth / 2
      const minX = Math.min(-width / 2, -wheelReach, drivenPulleyX, motorOffsetX - motorLength / 2)
      const maxX = Math.max(width / 2, wheelReach, bladeX, motorOffsetX + motorLength / 2)
      const minZ = Math.min(-length / 2, motorOffsetZ - motorDiameter / 2, shaftFrontOffset - Math.max(bladeRadius, drivenPulleyDiameter / 2))
      const maxZ = Math.max(length / 2, motorOffsetZ + motorDiameter / 2, shaftFrontOffset + Math.max(bladeRadius, drivenPulleyDiameter / 2))
      return {
        width: maxX - minX,
        height: Math.max(wheelRadius * 2, shaftHeight + bladeRadius, shaftHeight + drivenPulleyDiameter / 2, motorCenterY + motorDiameter * 0.48),
        depth: maxZ - minZ,
      }
    }
    case 'linsinger_vertical_saw': {
      const width = positive(params.width, 4, 1.8)
      const depth = positive(params.depth, 2.5, 1)
      const totalHeight = positive(params.totalHeight, 5.5, 2.5)
      const headWidth = positive(params.headWidth, 2.5, 0.8)
      const headDepth = positive(params.headDepth, 1.2, 0.5)
      const bladeDiameter = positive(params.bladeDiameter, 1.8, 0.4)
      const toothReach = Number(params.showBladeTeeth ?? 1) > 0 ? Math.max(0.045, bladeDiameter * 0.052) * 0.6 : 0
      const motorLength = positive(params.motorLength, 1.4, 0.5)
      const motorDiameter = positive(params.motorDiameter, 0.65, 0.25)
      const motorOffsetX = finite(params.motorOffsetX, 0.55)
      const motorOffsetZ = finite(params.motorOffsetZ, -0.55)
      const showBillet = Number(params.showBillet ?? 1) > 0
      const billetLength = showBillet ? positive(params.billetLength, 6, 1) : 0
      const billetDiameter = positive(params.billetDiameter, 0.65, 0.15)
      const billetHeight = positive(params.billetHeight, 1, billetDiameter / 2)
      const visualWidth = Math.max(width, headWidth, bladeDiameter + toothReach * 2, Math.abs(motorOffsetX) * 2 + motorDiameter)
      const visualDepth = Math.max(depth, billetLength, headDepth, Math.abs(motorOffsetZ) * 2 + motorLength)
      return {
        width: visualWidth,
        height: Math.max(totalHeight, billetHeight + billetDiameter / 2),
        depth: visualDepth,
      }
    }
    case 'cooling_bed': {
      const length = positive(params.length, 25, 4)
      const configuredWidth = positive(params.width, 16, 2)
      const frameHeight = positive(params.frameHeight, 1.2, 0.35)
      const screwCount = count(params.screwCount, 16, 2, 60)
      const screwSpacing = positive(params.screwSpacing, 1, 0.25)
      const screwLength = positive(params.screwLength, 24, 2)
      const shaftDiameter = positive(params.shaftDiameter, 0.16, 0.05)
      const helixOuterDiameter = Math.max(shaftDiameter * 1.3, positive(params.helixOuterDiameter, 0.42, 0.12))
      const housingWidth = positive(params.housingWidth, 0.35, 0.15)
      const supportBeamWidth = positive(params.supportBeamWidth, 0.3, 0.12)
      const motorScale = positive(params.motorScale, 0.7, 0.2)
      const driveEnabled = Number(params.showDriveUnits ?? 1) > 0 && String(params.driveMode ?? 'grouped') !== 'hidden'
      const showReferenceTubes = Number(params.showReferenceTubes ?? 0) > 0
      const tubeDiameter = positive(params.tubeDiameter, 0.3, 0.08)
      const tubeLength = positive(params.tubeLength, 12, 1)
      const referenceTubeCount = count(params.referenceTubeCount, 2, 1, 8)
      const tubeSpacing = positive(params.tubeSpacing, 2, 0.3)
      const rowSpan = (screwCount - 1) * screwSpacing
      const width = Math.max(configuredWidth, rowSpan + helixOuterDiameter + supportBeamWidth * 2, showReferenceTubes ? tubeLength : 0)
      const frameDepth = Math.max(length, screwLength + housingWidth * 2)
      const driveDepth = driveEnabled ? 2 * (screwLength / 2 + housingWidth + motorScale * 0.95) : 0
      const tubeDepth = showReferenceTubes ? (referenceTubeCount - 1) * tubeSpacing + tubeDiameter : 0
      const driveTop = driveEnabled ? frameHeight + motorScale * 0.35 : 0
      const tubeTop = showReferenceTubes ? frameHeight + helixOuterDiameter / 2 + tubeDiameter : 0
      return {
        width,
        height: Math.max(frameHeight + helixOuterDiameter / 2, driveTop, tubeTop),
        depth: Math.max(frameDepth, driveDepth, tubeDepth),
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
    case 'piercer_machine':
      return {
        width: positive(params.width, fallback.width, 3),
        height: positive(params.totalHeight, fallback.height, 2.4),
        depth: Math.max(
          positive(params.depth, fallback.depth, 1.5),
          Number(params.showReferenceTube ?? 1) > 0 ? positive(params.referenceTubeLength, fallback.depth, 0.8) : 0,
        ),
      }
    case 'billet_tong': {
      const frameWidth = positive(params.frameWidth, fallback.width, 1.2)
      const frameHeight = positive(params.frameHeight, 2, 0.8)
      const frameDepth = positive(params.frameDepth, 1.5, 0.6)
      const armLength = positive(params.armLength, 8, 1.5)
      const armWidth = positive(params.armWidth, 0.5, 0.18)
      const jawLength = positive(params.jawLength, 1.5, 0.4)
      const jawWidth = positive(params.jawWidth, 0.25, 0.1)
      const billetDiameter = positive(params.billetDiameter, 0.25, 0.08)
      const billetLength = Number(params.showReferenceBillet ?? 1) > 0 ? positive(params.billetLength, 2, 0.5) : jawLength
      const jawOpening = clampNumber(params.jawOpening, 0.3, 0, 1)
      const jawAngle = clampNumber(params.jawAngleMax, 35, 0, 70) * jawOpening * Math.PI / 180
      const jawDrop = Math.max(0.85, billetDiameter * 3.2, frameHeight * 0.48)
      const pivotSpacing = Math.max(billetDiameter / 2 + jawWidth * 0.9, armWidth * 0.7)
      const openJawWidth = 2 * (pivotSpacing + Math.sin(jawAngle) * jawDrop + jawWidth)
      return {
        width: Math.max(frameWidth, openJawWidth),
        height: frameHeight + jawDrop + frameHeight * 0.08,
        depth: frameDepth + armLength + Math.max(0, (billetLength - jawLength) / 2),
      }
    }
    case 'piercer_drive':
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

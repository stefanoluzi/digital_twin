import { useEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import type { IndustrialAsset, IndustrialParamValue } from '../../types/plant'

interface Props {
  asset: IndustrialAsset
  color: string
}

interface RollAssemblyProps {
  name: 'upperRollPivotGroup' | 'lowerRollPivotGroup'
  position: [number, number, number]
  skew: number
  tilt: number
  rotation: number
  angleState: number
  rollLength: number
  rollDiameter: number
  rollEndDiameter: number
  shaftDiameter: number
  openingWidth: number
  rollMaterial: THREE.Material
  shaftMaterial: THREE.Material
  housingMaterial: THREE.Material
  accentMaterial: THREE.Material
}

const numberParam = (value: IndustrialParamValue | undefined, fallback: number, min = 0.05) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback

const finiteParam = (value: IndustrialParamValue | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const colorParam = (value: IndustrialParamValue | undefined, fallback: string) =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback

const degrees = (value: number) => THREE.MathUtils.degToRad(value)

function BoxPart({ name, position, size, material, children }: {
  name: string
  position: [number, number, number]
  size: [number, number, number]
  material: THREE.Material
  children?: ReactNode
}) {
  return (
    <mesh name={name} position={position} material={material}>
      <boxGeometry args={size} />
      {children}
    </mesh>
  )
}

function AxialCylinder({ name, position, length, diameter, material, radialSegments = 20 }: {
  name: string
  position: [number, number, number]
  length: number
  diameter: number
  material: THREE.Material
  radialSegments?: number
}) {
  return (
    <mesh name={name} position={position} rotation={[Math.PI / 2, 0, 0]} material={material}>
      <cylinderGeometry args={[diameter / 2, diameter / 2, length, radialSegments]} />
    </mesh>
  )
}

function RollAssembly({
  name,
  position,
  skew,
  tilt,
  rotation,
  angleState,
  rollLength,
  rollDiameter,
  rollEndDiameter,
  shaftDiameter,
  openingWidth,
  rollMaterial,
  shaftMaterial,
  housingMaterial,
  accentMaterial,
}: RollAssemblyProps) {
  const centerLength = rollLength * 0.5
  const endLength = rollLength * 0.2
  const journalLength = rollLength * 0.16
  const centerEnd = centerLength / 2
  const endOffset = centerEnd + endLength / 2
  const journalOffset = rollLength / 2 + journalLength / 2
  const housingOffset = rollLength / 2 + journalLength * 0.7
  const housingWidth = Math.max(0.58, openingWidth * 0.3)
  const housingHeight = Math.max(0.62, rollDiameter * 1.18)
  const housingDepth = Math.max(0.28, journalLength * 0.9)

  return (
    <group name={name} position={position} rotation={[tilt, skew, 0]} userData={{ rollAngle: angleState }}>
      <group name="rollBody" rotation={[0, 0, rotation]}>
        <AxialCylinder name="workRollCenter" position={[0, 0, 0]} length={centerLength} diameter={rollDiameter} material={rollMaterial} radialSegments={28} />
        <AxialCylinder name="workRollFrontEnd" position={[0, 0, -endOffset]} length={endLength} diameter={rollEndDiameter} material={rollMaterial} radialSegments={24} />
        <AxialCylinder name="workRollRearEnd" position={[0, 0, endOffset]} length={endLength} diameter={rollEndDiameter} material={rollMaterial} radialSegments={24} />
      </group>
      <AxialCylinder name="frontJournal" position={[0, 0, -journalOffset]} length={journalLength} diameter={shaftDiameter} material={shaftMaterial} />
      <AxialCylinder name="rearJournal" position={[0, 0, journalOffset]} length={journalLength} diameter={shaftDiameter} material={shaftMaterial} />
      {([-1, 1] as const).map((side) => (
        <group key={side} name={side < 0 ? 'frontHousing' : 'rearHousing'} position={[0, 0, side * housingOffset]}>
          <BoxPart name="housingBody" position={[0, 0, 0]} size={[housingWidth, housingHeight, housingDepth]} material={housingMaterial} />
          <BoxPart name="housingCap" position={[0, housingHeight * 0.48, 0]} size={[housingWidth * 0.78, housingHeight * 0.18, housingDepth * 1.08]} material={accentMaterial} />
          <mesh name="bearingSeat" rotation={[Math.PI / 2, 0, 0]} material={shaftMaterial}>
            <cylinderGeometry args={[shaftDiameter * 0.86, shaftDiameter * 0.86, housingDepth * 1.08, 20]} />
          </mesh>
          <BoxPart
            name="frameConnector"
            position={[position[0] > 0 ? housingWidth * 0.78 : -housingWidth * 0.78, 0, 0]}
            size={[Math.max(0.35, openingWidth * 0.28), housingHeight * 0.3, housingDepth * 0.82]}
            material={housingMaterial}
          />
        </group>
      ))}
    </group>
  )
}

export function PiercerMachine({ asset, color }: Props) {
  const width = numberParam(asset.params.width, asset.size.width, 3)
  const depth = numberParam(asset.params.depth, asset.size.depth, 1.5)
  const totalHeight = numberParam(asset.params.totalHeight, asset.size.height, 2.4)
  const baseHeight = numberParam(asset.params.baseHeight, 0.5, 0.2)
  const openingWidth = numberParam(asset.params.openingWidth, 2.2, 0.8)
  const openingHeight = numberParam(asset.params.openingHeight, 1.8, 0.6)
  const sidePlateThickness = numberParam(asset.params.sidePlateThickness, 0.45, 0.18)
  const topModuleWidth = numberParam(asset.params.topModuleWidth, 2.4, 0.65)
  const topModuleHeight = numberParam(asset.params.topModuleHeight, 1, 0.35)
  const topModuleDepth = numberParam(asset.params.topModuleDepth, 3.2, 0.8)
  const centralGap = numberParam(asset.params.centralGap, 0.5, 0.18)
  const rollLength = numberParam(asset.params.rollLength, 2.4, 0.6)
  const rollDiameter = numberParam(asset.params.rollDiameter, 0.75, 0.2)
  const rollEndDiameter = numberParam(asset.params.rollEndDiameter, 0.55, 0.15)
  const shaftDiameter = numberParam(asset.params.shaftDiameter, 0.25, 0.08)
  const rollHorizontalOffset = numberParam(asset.params.rollHorizontalOffset, 0.45, 0)
  const rollVerticalOffset = numberParam(asset.params.rollVerticalOffset, 0.35, 0)
  const rollCenterDistance = numberParam(asset.params.rollCenterDistance, 1, 0.25)
  const rollSkewAngle = degrees(finiteParam(asset.params.rollSkewAngle, 10))
  const upperRollTiltAngle = degrees(finiteParam(asset.params.upperRollTiltAngle, 8))
  const lowerRollTiltAngle = degrees(finiteParam(asset.params.lowerRollTiltAngle, -8))
  const upperRollRotation = finiteParam(asset.params.upperRollRotation, 0)
  const lowerRollRotation = finiteParam(asset.params.lowerRollRotation, 0)
  const upperRollAngle = finiteParam(asset.params.upperRollAngle, 0)
  const lowerRollAngle = finiteParam(asset.params.lowerRollAngle, 0)
  const tubePresent = Number(asset.params.tubePresent ?? 1) > 0
  const machineRunning = Number(asset.params.machineRunning ?? 0) > 0
  const showReferenceTube = Number(asset.params.showReferenceTube ?? 1) > 0 && tubePresent
  const referenceTubeDiameter = numberParam(asset.params.referenceTubeDiameter, 0.28, 0.08)
  const referenceTubeLength = numberParam(asset.params.referenceTubeLength, depth * 1.4, 0.8)
  const referenceTubeOffsetY = finiteParam(asset.params.referenceTubeOffsetY, 0)
  const frameColor = colorParam(asset.params.frameColor, color || '#238f91')
  const rollerColor = colorParam(asset.params.rollerColor, '#c1cbd1')

  const bottomY = -totalHeight / 2
  const baseCenterY = bottomY + baseHeight / 2
  const baseTop = bottomY + baseHeight
  const openingCenterY = baseTop + openingHeight / 2 + totalHeight * 0.055
  const topCenterY = totalHeight / 2 - topModuleHeight / 2
  const sideFrameHeight = Math.max(0.75, topCenterY - topModuleHeight / 2 - baseTop + topModuleHeight * 0.25)
  const sideFrameCenterY = baseTop + sideFrameHeight / 2
  const sideX = openingWidth / 2 + sidePlateThickness / 2
  const moduleX = centralGap / 2 + topModuleWidth / 2
  const upperPosition: [number, number, number] = [-rollHorizontalOffset, openingCenterY + rollCenterDistance / 2 + rollVerticalOffset * 0.5, 0]
  const lowerPosition: [number, number, number] = [rollHorizontalOffset, openingCenterY - rollCenterDistance / 2 - rollVerticalOffset * 0.5, 0]

  const sideFrameGeometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-depth * 0.5, 0)
    shape.lineTo(depth * 0.5, 0)
    shape.lineTo(depth * 0.5, sideFrameHeight * 0.78)
    shape.lineTo(depth * 0.38, sideFrameHeight)
    shape.lineTo(-depth * 0.32, sideFrameHeight)
    shape.lineTo(-depth * 0.5, sideFrameHeight * 0.82)
    shape.closePath()
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: sidePlateThickness, bevelEnabled: false, steps: 1 })
    geometry.translate(0, -sideFrameHeight / 2, -sidePlateThickness / 2)
    geometry.rotateY(Math.PI / 2)
    return geometry
  }, [depth, sideFrameHeight, sidePlateThickness])

  const materials = useMemo(() => ({
    frame: new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.72, metalness: 0.12 }),
    frameDark: new THREE.MeshStandardMaterial({ color: '#285e63', roughness: 0.78, metalness: 0.1 }),
    base: new THREE.MeshStandardMaterial({ color: '#6f8588', roughness: 0.78, metalness: 0.1 }),
    roll: new THREE.MeshStandardMaterial({ color: rollerColor, roughness: 0.36, metalness: 0.52 }),
    shaft: new THREE.MeshStandardMaterial({ color: '#8f9da6', roughness: 0.42, metalness: 0.42 }),
    housing: new THREE.MeshStandardMaterial({ color: '#963a35', roughness: 0.62, metalness: 0.18 }),
    accent: new THREE.MeshStandardMaterial({ color: '#5f287d', roughness: 0.58, metalness: 0.15 }),
    tube: new THREE.MeshStandardMaterial({ color: '#d39a3a', roughness: 0.38, metalness: 0.35 }),
  }), [frameColor, rollerColor])

  useEffect(() => () => {
    sideFrameGeometry.dispose()
    Object.values(materials).forEach((material) => material.dispose())
  }, [materials, sideFrameGeometry])

  const longitudinalX = Math.max(openingWidth / 2 + sidePlateThickness, width * 0.34)
  const beamWidth = Math.max(0.32, width * 0.085)
  const beamHeight = baseHeight * 0.48
  const crossBeamDepth = Math.max(0.26, depth * 0.11)
  const adjustmentX = Math.min(width / 2 - 0.32, moduleX + topModuleWidth * 0.38)
  const adjustmentZ = topModuleDepth * 0.38

  return (
    <group name="PiercerMachineGroup" userData={{ machineRunning, tubePresent }}>
      <group name="baseFrameGroup">
        <BoxPart name="longitudinalBeamLeft" position={[-longitudinalX, baseCenterY, 0]} size={[beamWidth, beamHeight, depth * 1.08]} material={materials.base} />
        <BoxPart name="longitudinalBeamRight" position={[longitudinalX, baseCenterY, 0]} size={[beamWidth, beamHeight, depth * 1.08]} material={materials.base} />
        {[-0.43, 0, 0.43].map((offset, index) => (
          <BoxPart key={offset} name={`crossBeam${index + 1}`} position={[0, baseCenterY + beamHeight * 0.08, depth * offset]} size={[width * 0.92, beamHeight * 0.55, crossBeamDepth]} material={materials.base} />
        ))}
        {([-1, 1] as const).flatMap((xSide) => ([-1, 1] as const).map((zSide) => (
          <BoxPart key={`${xSide}-${zSide}`} name="basePlate" position={[xSide * width * 0.39, bottomY + baseHeight * 0.12, zSide * depth * 0.43]} size={[beamWidth * 1.65, baseHeight * 0.24, depth * 0.2]} material={materials.frameDark} />
        )))}
        {[-1, 1].map((side) => (
          <BoxPart key={side} name="lowerSupport" position={[side * (sideX + sidePlateThickness * 0.42), baseTop + baseHeight * 0.22, 0]} size={[sidePlateThickness * 1.55, baseHeight * 0.44, depth * 0.72]} material={materials.base} />
        ))}
      </group>

      <group name="sideFramesGroup">
        <mesh name="leftSideFrame" position={[-sideX, sideFrameCenterY, 0]} geometry={sideFrameGeometry} material={materials.base} />
        <mesh name="rightSideFrame" position={[sideX, sideFrameCenterY, 0]} geometry={sideFrameGeometry} material={materials.base} />
        {[-1, 1].map((side) => (
          <BoxPart key={side} name="sideFoot" position={[side * sideX, baseTop + baseHeight * 0.15, 0]} size={[sidePlateThickness * 1.65, baseHeight * 0.3, depth * 1.05]} material={materials.frameDark} />
        ))}
      </group>

      <group name="topModulesGroup">
        {([-1, 1] as const).map((side) => (
          <group key={side} name={side < 0 ? 'leftTopModule' : 'rightTopModule'} position={[side * moduleX, topCenterY, 0]}>
            <BoxPart name="moduleHousing" position={[0, 0, 0]} size={[topModuleWidth, topModuleHeight, topModuleDepth]} material={materials.frame} />
            <BoxPart name="topCover" position={[0, topModuleHeight * 0.54, 0]} size={[topModuleWidth * 0.92, topModuleHeight * 0.12, topModuleDepth * 0.92]} material={materials.frameDark} />
            <BoxPart name="inspectionCover" position={[0, topModuleHeight * 0.63, -topModuleDepth * 0.12]} size={[topModuleWidth * 0.28, topModuleHeight * 0.08, topModuleDepth * 0.24]} material={materials.base} />
            <BoxPart name="sideLug" position={[side * topModuleWidth * 0.52, -topModuleHeight * 0.18, 0]} size={[topModuleWidth * 0.12, topModuleHeight * 0.42, topModuleDepth * 0.36]} material={materials.frameDark} />
          </group>
        ))}
        {([-1, 1] as const).flatMap((xSide) => ([-1, 1] as const).map((zSide) => (
          <group key={`${xSide}-${zSide}`} name="adjustmentPost" position={[xSide * adjustmentX, totalHeight / 2 + topModuleHeight * 0.12, zSide * adjustmentZ]}>
            <BoxPart name="postBase" position={[0, -topModuleHeight * 0.15, 0]} size={[0.42, 0.2, 0.42]} material={materials.frameDark} />
            <mesh name="adjustmentScrew" material={materials.accent}>
              <cylinderGeometry args={[0.105, 0.105, 0.48, 16]} />
            </mesh>
            <mesh name="adjustmentNut" position={[0, 0.26, 0]} material={materials.accent}>
              <cylinderGeometry args={[0.18, 0.18, 0.16, 6]} />
            </mesh>
          </group>
        )))}
      </group>

      <group name="rollsGroup">
        <RollAssembly
          name="upperRollPivotGroup"
          position={upperPosition}
          skew={rollSkewAngle}
          tilt={upperRollTiltAngle}
          rotation={upperRollRotation}
          angleState={upperRollAngle}
          rollLength={rollLength}
          rollDiameter={rollDiameter}
          rollEndDiameter={rollEndDiameter}
          shaftDiameter={shaftDiameter}
          openingWidth={openingWidth}
          rollMaterial={materials.roll}
          shaftMaterial={materials.shaft}
          housingMaterial={materials.housing}
          accentMaterial={materials.accent}
        />
        <RollAssembly
          name="lowerRollPivotGroup"
          position={lowerPosition}
          skew={-rollSkewAngle}
          tilt={lowerRollTiltAngle}
          rotation={lowerRollRotation}
          angleState={lowerRollAngle}
          rollLength={rollLength}
          rollDiameter={rollDiameter}
          rollEndDiameter={rollEndDiameter}
          shaftDiameter={shaftDiameter}
          openingWidth={openingWidth}
          rollMaterial={materials.roll}
          shaftMaterial={materials.shaft}
          housingMaterial={materials.housing}
          accentMaterial={materials.accent}
        />
      </group>

      <group name="referenceTubeGroup" visible={showReferenceTube}>
        <AxialCylinder
          name="referenceTube"
          position={[0, openingCenterY + referenceTubeOffsetY, 0]}
          length={referenceTubeLength}
          diameter={referenceTubeDiameter}
          material={materials.tube}
          radialSegments={24}
        />
      </group>
    </group>
  )
}

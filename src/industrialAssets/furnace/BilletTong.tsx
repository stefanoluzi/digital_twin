import * as THREE from 'three'
import type { IndustrialAsset, IndustrialParamValue } from '../../types/plant'

interface Props {
  asset: IndustrialAsset
  color: string
}

const numberParam = (value: IndustrialParamValue | undefined, fallback: number, min = 0.05) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback

const clampParam = (value: IndustrialParamValue | undefined, fallback: number, min: number, max: number) => {
  const next = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, next))
}

function BoxPart({ name, position, size, color, roughness = 0.76, metalness = 0.1 }: {
  name: string
  position: [number, number, number]
  size: [number, number, number]
  color: string
  roughness?: number
  metalness?: number
}) {
  return (
    <mesh name={name} position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  )
}

function CylinderBetween({ name, start, end, radius, color, radialSegments = 16 }: {
  name: string
  start: [number, number, number]
  end: [number, number, number]
  radius: number
  color: string
  radialSegments?: number
}) {
  const startVector = new THREE.Vector3(...start)
  const endVector = new THREE.Vector3(...end)
  const direction = endVector.clone().sub(startVector)
  const length = direction.length()
  const midpoint = startVector.clone().add(endVector).multiplyScalar(0.5)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  )

  return (
    <mesh name={name} position={midpoint} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[radius, radius, length, radialSegments]} />
      <meshStandardMaterial color={color} roughness={0.48} metalness={0.3} />
    </mesh>
  )
}

function HydraulicCylinder({ side, start, end, radius }: {
  side: 'left' | 'right'
  start: [number, number, number]
  end: [number, number, number]
  radius: number
}) {
  const split: [number, number, number] = [
    start[0] + (end[0] - start[0]) * 0.44,
    start[1] + (end[1] - start[1]) * 0.44,
    start[2] + (end[2] - start[2]) * 0.44,
  ]

  return (
    <group name={`${side}HydraulicCylinder`}>
      <CylinderBetween name="cylinderBody" start={start} end={split} radius={radius} color="#255d75" radialSegments={18} />
      <CylinderBetween name="pistonRod" start={split} end={end} radius={radius * 0.48} color="#b9c5cb" radialSegments={16} />
      <mesh name="rearClevis" position={start} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 1.5, radius * 1.5, radius * 1.15, 16]} />
        <meshStandardMaterial color="#374b58" roughness={0.7} metalness={0.16} />
      </mesh>
      <mesh name="frontClevis" position={end} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, radius * 0.9, 16]} />
        <meshStandardMaterial color="#798991" roughness={0.56} metalness={0.25} />
      </mesh>
    </group>
  )
}

export function BilletTong({ asset, color }: Props) {
  const frameWidth = numberParam(asset.params.frameWidth, 3.5, 1.2)
  const frameHeight = numberParam(asset.params.frameHeight, 2, 0.8)
  const frameDepth = numberParam(asset.params.frameDepth, 1.5, 0.6)
  const armLength = numberParam(asset.params.armLength, 8, 1.5)
  const armWidth = numberParam(asset.params.armWidth, 0.5, 0.18)
  const armHeight = numberParam(asset.params.armHeight, 0.4, 0.15)
  const jawLength = numberParam(asset.params.jawLength, 1.5, 0.4)
  const jawWidth = numberParam(asset.params.jawWidth, 0.25, 0.1)
  const jawThickness = numberParam(asset.params.jawThickness, 0.15, 0.06)
  const jawOpening = clampParam(asset.params.jawOpening, 0.3, 0, 1)
  const jawAngleMax = clampParam(asset.params.jawAngleMax, 35, 0, 70)
  const billetDiameter = numberParam(asset.params.billetDiameter, 0.25, 0.08)
  const billetLength = numberParam(asset.params.billetLength, 2, 0.5)
  const showReferenceBillet = Number(asset.params.showReferenceBillet ?? 1) > 0
  const showHydraulicCylinders = Number(asset.params.showHydraulicCylinders ?? 1) > 0

  const jawDrop = Math.max(0.85, billetDiameter * 3.2, frameHeight * 0.48)
  const totalHeight = frameHeight + jawDrop
  const topY = totalHeight / 2
  const frameCenterY = topY - frameHeight / 2
  const frameBottomY = topY - frameHeight
  const armY = frameBottomY + armHeight * 0.72
  const jawPivotY = armY + armHeight * 0.18
  const billetY = jawPivotY - jawDrop + billetDiameter / 2 + jawThickness * 0.9

  const rawArmFront = -frameDepth / 2 - armLength
  const rawJawCenter = rawArmFront + jawLength / 2
  const billetExtra = Math.max(0, (billetLength - jawLength) / 2)
  const rawMinZ = rawArmFront - billetExtra
  const rawMaxZ = frameDepth / 2
  const centerOffsetZ = (rawMinZ + rawMaxZ) / 2
  const z = (raw: number) => raw - centerOffsetZ
  const frameZ = z(0)
  const armZ = z(-frameDepth / 2 - armLength / 2)
  const jawZ = z(rawJawCenter)
  const frameFrontZ = z(-frameDepth / 2)
  const armFrontZ = z(rawArmFront)
  const jawAngle = THREE.MathUtils.degToRad(jawAngleMax * jawOpening)
  const pivotSpacing = Math.max(billetDiameter / 2 + jawWidth * 0.9, armWidth * 0.7)
  const frameColor = color || '#596a78'
  const beamColor = '#435461'
  const armColor = '#667884'
  const jawColor = '#8b3e37'
  const upperBeamHeight = Math.max(0.18, frameHeight * 0.13)
  const columnSize = Math.max(0.2, frameWidth * 0.09)

  return (
    <group name="BilletTongGroup" userData={{ jawOpening }}>
      <group name="frameGroup">
        {([-1, 1] as const).map((side) => (
          <BoxPart
            key={`upper-${side}`}
            name={side < 0 ? 'upperBeamLeft' : 'upperBeamRight'}
            position={[side * frameWidth * 0.39, topY - upperBeamHeight / 2, frameZ]}
            size={[frameWidth * 0.13, upperBeamHeight, frameDepth]}
            color={frameColor}
          />
        ))}
        {([-1, 1] as const).map((side) => (
          <BoxPart
            key={`cross-${side}`}
            name={side < 0 ? 'rearCrossBeam' : 'frontCrossBeam'}
            position={[0, topY - upperBeamHeight / 2, frameZ + side * frameDepth * 0.39]}
            size={[frameWidth, upperBeamHeight, frameDepth * 0.16]}
            color={frameColor}
          />
        ))}
        {([-1, 1] as const).flatMap((xSide) => ([-1, 1] as const).map((zSide) => (
          <BoxPart
            key={`${xSide}-${zSide}`}
            name="sideColumn"
            position={[xSide * frameWidth * 0.39, frameCenterY, frameZ + zSide * frameDepth * 0.36]}
            size={[columnSize, frameHeight * 0.82, columnSize]}
            color={beamColor}
          />
        )))}
        <BoxPart name="lowerCrossMember" position={[0, frameBottomY + upperBeamHeight * 0.65, frameFrontZ]} size={[frameWidth * 0.86, upperBeamHeight, frameDepth * 0.2]} color={beamColor} />
        <BoxPart name="centralCylinderMount" position={[0, frameCenterY + frameHeight * 0.1, frameFrontZ]} size={[armWidth * 2.3, frameHeight * 0.35, frameDepth * 0.28]} color={frameColor} />
        {[-1, 1].map((side) => (
          <group key={side} name="suspensionLug" position={[side * frameWidth * 0.32, topY + upperBeamHeight * 0.2, frameZ]}>
            <BoxPart name="lugBase" position={[0, 0, 0]} size={[columnSize * 1.35, upperBeamHeight * 0.8, frameDepth * 0.28]} color={beamColor} />
            <mesh name="hangerPin" position={[0, upperBeamHeight * 0.55, 0]}>
              <cylinderGeometry args={[columnSize * 0.38, columnSize * 0.38, columnSize * 0.9, 16]} />
              <meshStandardMaterial color="#2f3d46" roughness={0.65} metalness={0.2} />
            </mesh>
          </group>
        ))}
      </group>

      <group name="armGroup">
        <BoxPart name="armStructureLeft" position={[-armWidth * 0.34, armY, armZ]} size={[armWidth * 0.3, armHeight, armLength]} color={armColor} />
        <BoxPart name="armStructureRight" position={[armWidth * 0.34, armY, armZ]} size={[armWidth * 0.3, armHeight, armLength]} color={armColor} />
        <BoxPart name="armTopTie" position={[0, armY + armHeight * 0.42, armZ]} size={[armWidth, armHeight * 0.16, armLength * 0.96]} color={beamColor} />
        <mesh name="centralShaft" position={[0, armY + armHeight * 0.12, z(-frameDepth * 0.22 - armLength * 0.52)]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[armHeight * 0.19, armHeight * 0.19, armLength + frameDepth * 0.72, 20]} />
          <meshStandardMaterial color="#a8b4bb" roughness={0.42} metalness={0.4} />
        </mesh>
        {[0.2, 0.5, 0.8].map((progress) => (
          <BoxPart key={progress} name="armCrossTie" position={[0, armY, frameFrontZ + (armFrontZ - frameFrontZ) * progress]} size={[armWidth * 1.28, armHeight * 1.15, armHeight * 0.28]} color={beamColor} />
        ))}
      </group>

      <group name="hydraulicGroup" visible={showHydraulicCylinders}>
        {([-1, 1] as const).map((side) => (
          <HydraulicCylinder
            key={side}
            side={side < 0 ? 'left' : 'right'}
            start={[side * armWidth * 0.82, frameCenterY + frameHeight * 0.18, frameFrontZ + frameDepth * 0.12]}
            end={[side * pivotSpacing, jawPivotY + jawDrop * 0.28, jawZ + jawLength * 0.36]}
            radius={Math.max(0.055, armHeight * 0.16)}
          />
        ))}
      </group>

      <group name="jawGroup" position={[0, jawPivotY, jawZ]}>
        {([-1, 1] as const).map((side) => (
          <group
            key={side}
            name={side < 0 ? 'leftJawPivot' : 'rightJawPivot'}
            position={[side * pivotSpacing, 0, 0]}
            rotation={[0, 0, side * jawAngle]}
          >
            <mesh name="jawPivotPin" rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[jawWidth * 0.72, jawWidth * 0.72, jawLength * 1.06, 18]} />
              <meshStandardMaterial color="#35444d" roughness={0.6} metalness={0.25} />
            </mesh>
            <BoxPart name={side < 0 ? 'leftJaw' : 'rightJaw'} position={[0, -jawDrop / 2, 0]} size={[jawWidth, jawDrop, jawLength]} color={jawColor} roughness={0.62} metalness={0.18} />
            <BoxPart name="contactShoe" position={[-side * jawWidth * 0.18, -jawDrop + jawThickness / 2, 0]} size={[jawWidth * 1.65, jawThickness, jawLength]} color="#3f4850" roughness={0.55} metalness={0.3} />
            <BoxPart name="jawReinforcement" position={[0, -jawDrop * 0.34, 0]} size={[jawWidth * 1.55, jawThickness * 1.15, jawLength * 0.82]} color="#663b37" />
          </group>
        ))}
        <mesh name="centralJawPivot" rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[jawWidth * 0.5, jawWidth * 0.5, jawLength * 1.18, 18]} />
          <meshStandardMaterial color="#303b42" roughness={0.62} metalness={0.28} />
        </mesh>
      </group>

      <group name="referenceBilletGroup" visible={showReferenceBillet}>
        <mesh name="referenceBillet" position={[0, billetY, jawZ]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[billetDiameter / 2, billetDiameter / 2, billetLength, 24]} />
          <meshStandardMaterial color="#d49335" roughness={0.4} metalness={0.34} />
        </mesh>
      </group>
    </group>
  )
}

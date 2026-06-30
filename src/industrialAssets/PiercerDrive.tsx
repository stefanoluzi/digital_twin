import * as THREE from 'three'
import type { IndustrialAsset } from '../types/plant'

interface Props {
  asset: IndustrialAsset
  color: string
}

function Shaft({
  start,
  end,
  radius,
  color,
  segments = 18,
}: {
  start: [number, number, number]
  end: [number, number, number]
  radius: number
  color: string
  segments?: number
}) {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const dz = end[2] - start[2]
  const length = Math.hypot(dx, dy, dz)
  const yaw = Math.atan2(dz, dx)
  const pitch = Math.atan2(dy, Math.hypot(dx, dz))

  return (
    <group position={[(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2]} rotation={[0, -yaw, pitch]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[radius, radius, length, segments]} />
        <meshStandardMaterial color={color} roughness={0.58} metalness={0.18} />
      </mesh>
    </group>
  )
}

function Joint({ position, radius, width, color }: { position: [number, number, number]; radius: number; width: number; color: string }) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[radius, radius, width, 18]} />
      <meshStandardMaterial color={color} roughness={0.62} metalness={0.16} />
    </mesh>
  )
}

function Flange({ position, radius, width, color }: { position: [number, number, number]; radius: number; width: number; color: string }) {
  return (
    <mesh position={position} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[radius, radius, width, 24]} />
      <meshStandardMaterial color={color} roughness={0.64} metalness={0.14} />
    </mesh>
  )
}

export function PiercerDrive({ asset, color }: Props) {
  const length = asset.size.width
  const width = asset.size.depth
  const height = asset.size.height

  const motorColor = color || '#287c8e'
  const gearboxColor = '#3f7f5a'
  const steelColor = '#9aa4ad'
  const baseColor = '#596a78'
  const darkSteel = '#66727d'
  const darkGearboxColor = '#476b56'
  const headColor = '#5f976f'

  const baseY = -height * 0.48
  const motorLength = length * 0.4
  const gearboxLength = length * 0.2
  const cardanLength = length * 0.4

  const motorCenterX = -length * 0.42
  const gearboxCenterX = 0
  const motorRightX = motorCenterX + motorLength / 2

  const motorHeight = height * 0.72
  const motorWidth = width * 0.72
  const motorCenterY = baseY + height * 0.08 + motorHeight / 2

  const reducerWidth = gearboxLength * 1.28
  const reducerHeight = height * 0.86
  const reducerDepth = width * 0.82
  const reducerBottomY = baseY + height * 0.16
  const reducerTopY = reducerBottomY + reducerHeight
  const reducerShape = new THREE.Shape()
  reducerShape.moveTo(-reducerDepth * 0.46, 0)
  reducerShape.lineTo(-reducerDepth * 0.46, reducerHeight * 0.62)
  reducerShape.lineTo(-reducerDepth * 0.34, reducerHeight * 0.86)
  reducerShape.lineTo(-reducerDepth * 0.2, reducerHeight)
  reducerShape.lineTo(reducerDepth * 0.24, reducerHeight)
  reducerShape.lineTo(reducerDepth * 0.39, reducerHeight * 0.84)
  reducerShape.lineTo(reducerDepth * 0.33, reducerHeight * 0.62)
  reducerShape.lineTo(reducerDepth * 0.5, reducerHeight * 0.36)
  reducerShape.lineTo(reducerDepth * 0.5, 0)
  reducerShape.lineTo(-reducerDepth * 0.46, 0)

  const inputY = baseY + height * 0.08 + motorHeight * 0.43
  const inputZ = 0
  const inputFlangeX = gearboxCenterX - reducerWidth * 0.5
  const outputFaceX = gearboxCenterX + reducerWidth * 0.5
  const outputOffsetZ = reducerDepth * 0.26
  const upperOutput = {
    x: outputFaceX,
    y: reducerBottomY + reducerHeight * 0.58,
    z: outputOffsetZ * 0.4,
  }
  // In frontal view, lower output must be visually to the RIGHT of upper output.
  // IMPORTANT: lower output is offset in Z relative to upper output. Do not align both shafts on the same vertical plane.
  const lowerOutput = {
    x: outputFaceX,
    y: reducerBottomY + reducerHeight * 0.22,
    z: -outputOffsetZ,
  }

  const upperStartX = upperOutput.x + length * 0.06
  const lowerStartX = lowerOutput.x + length * 0.06
  const cardanRun = cardanLength * 0.82
  const cardanDrop = height * 0.1
  const upperStart: [number, number, number] = [upperStartX, upperOutput.y, upperOutput.z]
  const upperEnd: [number, number, number] = [upperStartX + cardanRun, upperOutput.y - cardanDrop, upperOutput.z]
  const lowerStart: [number, number, number] = [lowerStartX, lowerOutput.y, lowerOutput.z]
  const lowerEnd: [number, number, number] = [lowerStartX + cardanRun, lowerOutput.y - cardanDrop, lowerOutput.z]

  return (
    <group>
      <mesh position={[length * 0.02, baseY, 0]}>
        <boxGeometry args={[length * 1.18, height * 0.08, width * 0.92]} />
        <meshStandardMaterial color={baseColor} roughness={0.84} metalness={0.04} />
      </mesh>

      <mesh position={[motorCenterX, motorCenterY, 0]}>
        <boxGeometry args={[motorLength * 0.88, motorHeight, motorWidth]} />
        <meshStandardMaterial color={motorColor} roughness={0.72} metalness={0.05} />
      </mesh>
      {[-1, 1].map((zSide) => (
        <mesh key={`motor-side-${zSide}`} position={[motorCenterX, motorCenterY, zSide * motorWidth * 0.52]}>
          <boxGeometry args={[motorLength * 0.76, motorHeight * 0.82, width * 0.05]} />
          <meshStandardMaterial color="#3d5868" roughness={0.78} metalness={0.04} />
        </mesh>
      ))}
      <mesh position={[motorCenterX - motorLength * 0.22, motorCenterY + motorHeight * 0.53, 0]}>
        <boxGeometry args={[motorLength * 0.26, height * 0.1, motorWidth * 0.42]} />
        <meshStandardMaterial color="#425866" roughness={0.74} metalness={0.04} />
      </mesh>
      {[-0.28, 0.28].map((z) => (
        <mesh key={`motor-foot-${z}`} position={[motorCenterX, baseY + height * 0.11, z * width]}>
          <boxGeometry args={[motorLength * 0.72, height * 0.13, width * 0.12]} />
          <meshStandardMaterial color={baseColor} roughness={0.84} metalness={0.04} />
        </mesh>
      ))}

      <Shaft
        start={[motorRightX - length * 0.08, inputY, 0]}
        end={[gearboxCenterX - gearboxLength * 0.5, inputY, 0]}
        radius={height * 0.07}
        color={steelColor}
        segments={24}
      />

      <mesh position={[gearboxCenterX - reducerWidth / 2, reducerBottomY, 0]} rotation={[0, Math.PI / 2, 0]}>
        <extrudeGeometry args={[reducerShape, { depth: reducerWidth, bevelEnabled: false }]} />
        <meshStandardMaterial color={gearboxColor} roughness={0.78} metalness={0.05} />
      </mesh>
      <mesh position={[gearboxCenterX, reducerBottomY - height * 0.06, 0]}>
        <boxGeometry args={[reducerWidth * 1.18, height * 0.14, reducerDepth * 1.18]} />
        <meshStandardMaterial color={darkGearboxColor} roughness={0.82} metalness={0.03} />
      </mesh>
      <mesh position={[gearboxCenterX - reducerWidth * 0.02, reducerTopY + height * 0.025, 0]}>
        <boxGeometry args={[reducerWidth * 0.7, height * 0.05, reducerDepth * 0.78]} />
        <meshStandardMaterial color={headColor} roughness={0.78} metalness={0.04} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={`gearbox-side-plate-${side}`} position={[gearboxCenterX, reducerBottomY + reducerHeight * 0.5, side * reducerDepth * 0.55]}>
          <boxGeometry args={[reducerWidth * 0.9, reducerHeight * 0.82, reducerDepth * 0.05]} />
          <meshStandardMaterial color={darkGearboxColor} roughness={0.8} metalness={0.04} />
        </mesh>
      ))}
      {[-0.42, 0.42].map((x) => (
        <mesh key={`gearbox-rib-${x}`} position={[gearboxCenterX + reducerWidth * x, reducerBottomY + reducerHeight * 0.38, 0]}>
          <boxGeometry args={[reducerWidth * 0.06, reducerHeight * 0.56, reducerDepth * 1.1]} />
          <meshStandardMaterial color={darkGearboxColor} roughness={0.8} metalness={0.04} />
        </mesh>
      ))}

      <Flange position={[inputFlangeX, inputY, inputZ]} radius={height * 0.12} width={gearboxLength * 0.12} color={darkSteel} />
      <Flange position={[upperOutput.x, upperOutput.y, upperOutput.z]} radius={height * 0.13} width={gearboxLength * 0.14} color={darkSteel} />
      <Flange position={[lowerOutput.x, lowerOutput.y, lowerOutput.z]} radius={height * 0.11} width={gearboxLength * 0.13} color="#68737e" />

      <Shaft start={[upperOutput.x, upperOutput.y, upperOutput.z]} end={upperStart} radius={height * 0.052} color={steelColor} />
      <Shaft start={[lowerOutput.x, lowerOutput.y, lowerOutput.z]} end={lowerStart} radius={height * 0.052} color={steelColor} />

      <Shaft start={upperStart} end={upperEnd} radius={height * 0.04} color={steelColor} segments={20} />
      <Shaft start={lowerStart} end={lowerEnd} radius={height * 0.04} color="#808b96" segments={20} />

      {[upperStart, upperEnd].map((position, index) => (
        <Joint key={`upper-joint-${index}`} position={position} radius={height * 0.08} width={width * 0.18} color={darkSteel} />
      ))}
      {[lowerStart, lowerEnd].map((position, index) => (
        <Joint key={`lower-joint-${index}`} position={position} radius={height * 0.07} width={width * 0.16} color="#68737e" />
      ))}
    </group>
  )
}

import type { IndustrialAsset } from '../types/plant'

interface Props {
  asset: IndustrialAsset
  color: string
}

export function MotorGearboxParallel({ asset, color }: Props) {
  const length = asset.size.width
  const height = asset.size.height
  const depth = asset.size.depth
  const motorColor = color || '#287c8e'
  const gearboxColor = '#6b7b8c'
  const steelColor = '#9ca3aa'
  const baseColor = '#596a78'

  const baseY = -height * 0.46
  const motorLength = length * 0.42
  const gearboxLength = length * 0.34
  const motorX = -length * 0.24
  const gearboxX = length * 0.23
  const inputZ = -depth * 0.22
  const outputZ = depth * 0.26
  const shaftY = height * 0.03

  return (
    <group>
      <mesh position={[0, baseY, 0]}>
        <boxGeometry args={[length * 0.96, height * 0.1, depth * 0.82]} />
        <meshStandardMaterial color={baseColor} roughness={0.84} metalness={0.04} />
      </mesh>

      <mesh position={[motorX, shaftY, inputZ]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[height * 0.28, height * 0.28, motorLength, 28]} />
        <meshStandardMaterial color={motorColor} roughness={0.68} metalness={0.06} />
      </mesh>
      <mesh position={[motorX - motorLength * 0.36, shaftY, inputZ]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[height * 0.31, height * 0.31, length * 0.12, 28]} />
        <meshStandardMaterial color="#3d5868" roughness={0.72} metalness={0.04} />
      </mesh>
      {[-1, 1].map((zOffset) => (
        <mesh key={`motor-foot-${zOffset}`} position={[motorX, baseY + height * 0.11, inputZ + zOffset * depth * 0.16]}>
          <boxGeometry args={[motorLength * 0.74, height * 0.12, depth * 0.08]} />
          <meshStandardMaterial color={baseColor} roughness={0.84} metalness={0.04} />
        </mesh>
      ))}

      <mesh position={[gearboxX, shaftY, 0]}>
        <boxGeometry args={[gearboxLength, height * 0.82, depth * 0.55]} />
        <meshStandardMaterial color={gearboxColor} roughness={0.78} metalness={0.06} />
      </mesh>
      <mesh position={[gearboxX, baseY + height * 0.12, 0]}>
        <boxGeometry args={[gearboxLength * 1.1, height * 0.16, depth * 0.62]} />
        <meshStandardMaterial color={baseColor} roughness={0.84} metalness={0.04} />
      </mesh>

      <mesh position={[0, shaftY, inputZ]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[height * 0.055, height * 0.055, length * 0.28, 20]} />
        <meshStandardMaterial color={steelColor} roughness={0.55} metalness={0.2} />
      </mesh>
      <mesh position={[length * 0.06, shaftY, inputZ]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[height * 0.1, height * 0.1, length * 0.12, 20]} />
        <meshStandardMaterial color="#7d8892" roughness={0.62} metalness={0.14} />
      </mesh>

      <mesh position={[gearboxX + gearboxLength * 0.52, shaftY, outputZ]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[height * 0.07, height * 0.07, length * 0.3, 20]} />
        <meshStandardMaterial color={steelColor} roughness={0.55} metalness={0.2} />
      </mesh>
      <mesh position={[gearboxX + gearboxLength * 0.34, shaftY, outputZ]}>
        <boxGeometry args={[length * 0.1, height * 0.22, depth * 0.18]} />
        <meshStandardMaterial color="#7d8892" roughness={0.68} metalness={0.08} />
      </mesh>
    </group>
  )
}

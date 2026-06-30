import type { IndustrialAsset } from '../types/plant'

interface Props {
  asset: IndustrialAsset
  color: string
}

export function RollingStand({ asset, color }: Props) {
  const width = asset.size.width
  const height = asset.size.height
  const housingW = width * 0.18
  const rollRadius = Math.max(0.18, width * 0.07)

  return (
    <group>
      <mesh position={[0, -height * 0.46, 0]}>
        <boxGeometry args={[width, height * 0.12, asset.size.depth]} />
        <meshStandardMaterial color={color} roughness={0.82} metalness={0.05} />
      </mesh>
      <mesh position={[-width / 2 + housingW / 2, 0, 0]}>
        <boxGeometry args={[housingW, height, asset.size.depth * 0.74]} />
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.08} />
      </mesh>
      <mesh position={[width / 2 - housingW / 2, 0, 0]}>
        <boxGeometry args={[housingW, height, asset.size.depth * 0.74]} />
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.08} />
      </mesh>
      <mesh position={[0, height * 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[rollRadius, rollRadius, width * 0.62, 24]} />
        <meshStandardMaterial color="#9ca3aa" roughness={0.58} metalness={0.18} />
      </mesh>
      <mesh position={[0, -height * 0.16, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[rollRadius, rollRadius, width * 0.62, 24]} />
        <meshStandardMaterial color="#9ca3aa" roughness={0.58} metalness={0.18} />
      </mesh>
    </group>
  )
}

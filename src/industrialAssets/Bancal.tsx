import type { IndustrialAsset } from '../types/plant'

interface Props {
  asset: IndustrialAsset
  color: string
}

export function Bancal({ asset, color }: Props) {
  const length = asset.size.width
  const height = asset.size.height
  const depth = asset.size.depth
  const railGauge = depth * 0.34
  const railY = height * 0.18
  const sleeperCount = Math.max(5, Math.round(length / 0.75))

  return (
    <group>
      <mesh position={[0, -height * 0.38, 0]}>
        <boxGeometry args={[length, height * 0.16, depth * 0.84]} />
        <meshStandardMaterial color={color} roughness={0.84} metalness={0.04} />
      </mesh>
      {Array.from({ length: sleeperCount }, (_, index) => {
        const x = -length / 2 + (index + 0.5) * (length / sleeperCount)
        return (
          <mesh key={index} position={[x, -height * 0.08, 0]}>
            <boxGeometry args={[0.12, height * 0.16, depth * 0.78]} />
            <meshStandardMaterial color={color} roughness={0.82} metalness={0.04} />
          </mesh>
        )
      })}
      {[-1, 1].map((side) => (
        <group key={side} position={[0, railY, side * railGauge]}>
          <mesh>
            <boxGeometry args={[length * 0.96, height * 0.12, depth * 0.08]} />
            <meshStandardMaterial color="#8a949e" roughness={0.55} metalness={0.22} />
          </mesh>
          <mesh position={[0, height * 0.1, 0]}>
            <boxGeometry args={[length * 0.96, height * 0.08, depth * 0.16]} />
            <meshStandardMaterial color="#9ca3aa" roughness={0.52} metalness={0.26} />
          </mesh>
          <mesh position={[0, -height * 0.09, 0]}>
            <boxGeometry args={[length * 0.96, height * 0.08, depth * 0.18]} />
            <meshStandardMaterial color="#74808a" roughness={0.6} metalness={0.18} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={`guide-${side}`} position={[0, railY + height * 0.14, side * railGauge * 1.22]}>
          <boxGeometry args={[length * 0.9, height * 0.08, depth * 0.06]} />
          <meshStandardMaterial color="#d1a34a" roughness={0.72} metalness={0.04} />
        </mesh>
      ))}
    </group>
  )
}

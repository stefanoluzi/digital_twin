import type { IndustrialAsset } from '../types/plant'

interface Props {
  asset: IndustrialAsset
  color: string
}

export function RollerTableFlat({ asset, color }: Props) {
  const length = asset.size.width
  const spacing = Number(asset.params.rollerSpacing ?? 0.8)
  const diameter = Number(asset.params.rollerDiameter ?? 0.32)
  const count = Math.max(2, Math.round(Number(asset.params.rollerCount ?? Math.floor(length / spacing) + 1)))
  const railZ = asset.size.depth / 2 - 0.18
  const y = asset.size.height * 0.1
  const supportHeight = asset.size.height * 0.44
  const supportY = -asset.size.height / 2 + supportHeight / 2

  return (
    <group>
      <mesh position={[0, -asset.size.height * 0.28, railZ]}>
        <boxGeometry args={[length, asset.size.height * 0.28, 0.16]} />
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.05} />
      </mesh>
      <mesh position={[0, -asset.size.height * 0.28, -railZ]}>
        <boxGeometry args={[length, asset.size.height * 0.28, 0.16]} />
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.05} />
      </mesh>
      {Array.from({ length: count }, (_, index) => {
        const x = count === 1 ? 0 : -length / 2 + (index * length) / (count - 1)
        return (
          <mesh key={index} position={[x, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[diameter / 2, diameter / 2, asset.size.depth * 0.86, 20]} />
            <meshStandardMaterial color="#9ca3aa" roughness={0.62} metalness={0.12} />
          </mesh>
        )
      })}
      {[-1, 1].flatMap((side) => [-1, 1].map((end) => (
        <mesh key={`${side}-${end}`} position={[end * length * 0.43, supportY, side * railZ]}>
          <boxGeometry args={[0.22, supportHeight, 0.22]} />
          <meshStandardMaterial color={color} roughness={0.82} metalness={0.04} />
        </mesh>
      )))}
    </group>
  )
}

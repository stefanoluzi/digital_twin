import type { IndustrialAsset } from '../types/plant'

interface Props {
  asset: IndustrialAsset
  color: string
}

export function RollerTableBiconical({ asset, color }: Props) {
  const length = asset.size.width
  const spacing = Number(asset.params.rollerSpacing ?? 0.8)
  const diameter = Number(asset.params.rollerDiameter ?? 0.38)
  const count = Math.max(2, Math.round(Number(asset.params.rollerCount ?? Math.floor(length / spacing) + 1)))
  const railZ = asset.size.depth / 2 - 0.18
  const rollerHalf = asset.size.depth * 0.42

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
          <group key={index} position={[x, asset.size.height * 0.1, 0]}>
            <mesh position={[0, 0, -rollerHalf / 2]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[diameter * 0.26, diameter * 0.5, rollerHalf, 20]} />
              <meshStandardMaterial color="#9ca3aa" roughness={0.62} metalness={0.12} />
            </mesh>
            <mesh position={[0, 0, rollerHalf / 2]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[diameter * 0.5, diameter * 0.26, rollerHalf, 20]} />
              <meshStandardMaterial color="#9ca3aa" roughness={0.62} metalness={0.12} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

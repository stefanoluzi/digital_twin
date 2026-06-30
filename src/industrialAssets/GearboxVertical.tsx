import type { IndustrialAsset } from '../types/plant'

export function GearboxVertical({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h, depth: d } = asset.size
  return (
    <group>
      <mesh position={[0, h * 0.04, 0]}>
        <boxGeometry args={[w * 0.68, h * 0.68, d * 0.68]} />
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.06} />
      </mesh>
      <mesh position={[0, -h * 0.44, 0]}>
        <cylinderGeometry args={[w * 0.16, w * 0.16, h * 0.2, 20]} />
        <meshStandardMaterial color="#9ca3aa" metalness={0.2} roughness={0.55} />
      </mesh>
      <mesh position={[0, h * 0.46, 0]}>
        <cylinderGeometry args={[w * 0.13, w * 0.13, h * 0.18, 20]} />
        <meshStandardMaterial color="#9ca3aa" metalness={0.2} roughness={0.55} />
      </mesh>
      <mesh position={[0, -h * 0.5, 0]}>
        <boxGeometry args={[w, h * 0.08, d]} />
        <meshStandardMaterial color="#596a78" roughness={0.82} />
      </mesh>
    </group>
  )
}

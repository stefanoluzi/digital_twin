import type { IndustrialAsset } from '../types/plant'

export function ElectricMotorVertical({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h, depth: d } = asset.size
  return (
    <group>
      <mesh position={[0, h * 0.05, 0]}>
        <cylinderGeometry args={[w * 0.34, w * 0.34, h * 0.72, 30]} />
        <meshStandardMaterial color={color} roughness={0.68} metalness={0.08} />
      </mesh>
      <mesh position={[0, -h * 0.43, 0]}>
        <cylinderGeometry args={[w * 0.48, w * 0.42, h * 0.14, 30]} />
        <meshStandardMaterial color="#596a78" roughness={0.82} />
      </mesh>
      <mesh position={[w * 0.33, h * 0.15, 0]}>
        <boxGeometry args={[w * 0.22, h * 0.24, d * 0.38]} />
        <meshStandardMaterial color="#364654" roughness={0.78} />
      </mesh>
    </group>
  )
}

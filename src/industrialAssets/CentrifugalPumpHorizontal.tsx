import type { IndustrialAsset } from '../types/plant'

export function CentrifugalPumpHorizontal({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h, depth: d } = asset.size
  return (
    <group>
      <mesh position={[0, -h * 0.43, 0]}><boxGeometry args={[w, h * 0.14, d]} /><meshStandardMaterial color="#596a78" roughness={0.84} /></mesh>
      <mesh position={[-w * 0.22, -h * 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[h * 0.26, h * 0.26, w * 0.35, 24]} />
        <meshStandardMaterial color="#287c8e" roughness={0.68} metalness={0.08} />
      </mesh>
      <mesh position={[w * 0.22, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[h * 0.32, h * 0.4, d * 0.45, 26]} />
        <meshStandardMaterial color={color} roughness={0.72} metalness={0.08} />
      </mesh>
      <mesh position={[w * 0.45, h * 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[h * 0.1, h * 0.1, w * 0.18, 18]} />
        <meshStandardMaterial color="#9ca3aa" roughness={0.55} metalness={0.2} />
      </mesh>
    </group>
  )
}

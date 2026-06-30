import type { IndustrialAsset } from '../types/plant'

export function IndustrialFan({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h, depth: d } = asset.size
  return (
    <group>
      <mesh position={[w * 0.14, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[h * 0.42, h * 0.42, d * 0.35, 32]} />
        <meshStandardMaterial color={color} roughness={0.78} />
      </mesh>
      {[0, 1, 2, 3].map((i) => <mesh key={i} position={[w * 0.14, 0, 0]} rotation={[0, 0, (Math.PI / 2) * i]}><boxGeometry args={[w * 0.08, h * 0.68, d * 0.08]} /><meshStandardMaterial color="#9ca3aa" /></mesh>)}
      <mesh position={[-w * 0.32, -h * 0.05, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[h * 0.18, h * 0.18, w * 0.32, 20]} /><meshStandardMaterial color="#287c8e" /></mesh>
      <mesh position={[-w * 0.08, -h * 0.43, 0]}><boxGeometry args={[w * 0.7, h * 0.12, d * 0.7]} /><meshStandardMaterial color="#596a78" /></mesh>
    </group>
  )
}

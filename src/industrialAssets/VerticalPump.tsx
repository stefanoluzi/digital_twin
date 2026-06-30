import type { IndustrialAsset } from '../types/plant'

export function VerticalPump({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h } = asset.size
  return (
    <group>
      <mesh position={[0, -h * 0.45, 0]}><cylinderGeometry args={[w * 0.42, w * 0.42, h * 0.1, 24]} /><meshStandardMaterial color="#596a78" /></mesh>
      <mesh position={[0, -h * 0.08, 0]}><cylinderGeometry args={[w * 0.14, w * 0.14, h * 0.64, 20]} /><meshStandardMaterial color={color} roughness={0.72} /></mesh>
      <mesh position={[0, h * 0.32, 0]}><cylinderGeometry args={[w * 0.32, w * 0.32, h * 0.26, 26]} /><meshStandardMaterial color="#287c8e" roughness={0.68} /></mesh>
      <mesh position={[0, -h * 0.32, 0]}><cylinderGeometry args={[w * 0.28, w * 0.34, h * 0.16, 24]} /><meshStandardMaterial color={color} roughness={0.72} /></mesh>
    </group>
  )
}

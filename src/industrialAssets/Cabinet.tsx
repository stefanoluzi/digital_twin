import type { IndustrialAsset } from '../types/plant'

export function Cabinet({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h, depth: d } = asset.size
  return <group><mesh><boxGeometry args={[w, h, d]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh><mesh position={[0, 0, -d * 0.51]}><boxGeometry args={[0.03, h * 0.9, 0.03]} /><meshStandardMaterial color="#2f3b45" /></mesh><mesh position={[w * 0.25, 0, -d * 0.54]}><boxGeometry args={[w * 0.05, h * 0.08, 0.04]} /><meshStandardMaterial color="#d1a34a" /></mesh></group>
}

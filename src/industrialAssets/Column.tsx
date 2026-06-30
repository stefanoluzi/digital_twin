import type { IndustrialAsset } from '../types/plant'

export function Column({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h, depth: d } = asset.size
  return <group><mesh><boxGeometry args={[w * 0.45, h, d * 0.45]} /><meshStandardMaterial color={color} roughness={0.82} /></mesh><mesh position={[0, -h * 0.48, 0]}><boxGeometry args={[w, h * 0.06, d]} /><meshStandardMaterial color="#6b7b8c" /></mesh></group>
}

import type { IndustrialAsset } from '../types/plant'

export function TankVertical({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h } = asset.size
  return <group><mesh><cylinderGeometry args={[w * 0.42, w * 0.42, h * 0.82, 32]} /><meshStandardMaterial color={color} roughness={0.7} metalness={0.05} /></mesh><mesh position={[0, h * 0.44, 0]}><cylinderGeometry args={[w * 0.32, w * 0.42, h * 0.08, 32]} /><meshStandardMaterial color={color} /></mesh><mesh position={[0, -h * 0.44, 0]}><cylinderGeometry args={[w * 0.42, w * 0.32, h * 0.08, 32]} /><meshStandardMaterial color={color} /></mesh></group>
}

import type { IndustrialAsset } from '../types/plant'

export function ElectricalPanel({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h, depth: d } = asset.size
  return <group><mesh><boxGeometry args={[w, h, d]} /><meshStandardMaterial color={color} roughness={0.78} /></mesh><mesh position={[0, 0, -d * 0.51]}><boxGeometry args={[w * 0.82, h * 0.78, 0.03]} /><meshStandardMaterial color="#22313d" /></mesh>{[-0.18, 0.06, 0.3].map((y) => <mesh key={y} position={[w * 0.34, y * h, -d * 0.54]}><boxGeometry args={[w * 0.08, h * 0.05, 0.04]} /><meshStandardMaterial color="#d1a34a" /></mesh>)}</group>
}

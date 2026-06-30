import type { IndustrialAsset } from '../types/plant'

export function Handrail({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h, depth: d } = asset.size
  return <group><mesh position={[0, h * 0.42, 0]}><boxGeometry args={[w, h * 0.08, d]} /><meshStandardMaterial color={color} /></mesh>{[-0.4, 0, 0.4].map((x) => <mesh key={x} position={[x * w, 0, 0]}><boxGeometry args={[0.08, h, d]} /><meshStandardMaterial color={color} /></mesh>)}</group>
}

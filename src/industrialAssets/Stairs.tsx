import type { IndustrialAsset } from '../types/plant'

export function Stairs({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h, depth: d } = asset.size
  const steps = 6
  return <group>{Array.from({ length: steps }, (_, i) => <mesh key={i} position={[-w / 2 + (i + 0.5) * (w / steps), -h / 2 + (i + 0.5) * (h / steps), 0]}><boxGeometry args={[w / steps, h / steps, d]} /><meshStandardMaterial color={color} roughness={0.82} /></mesh>)}<mesh position={[0, h * 0.08, -d * 0.45]} rotation={[0, 0, -Math.atan2(h, w)]}><boxGeometry args={[w * 1.1, 0.08, 0.08]} /><meshStandardMaterial color="#d1a34a" /></mesh></group>
}

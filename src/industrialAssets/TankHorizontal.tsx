import type { IndustrialAsset } from '../types/plant'

export function TankHorizontal({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h, depth: d } = asset.size
  return <group><mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[h * 0.42, h * 0.42, w * 0.78, 32]} /><meshStandardMaterial color={color} roughness={0.7} metalness={0.05} /></mesh>{[-0.28, 0.28].map((x) => <mesh key={x} position={[x * w, -h * 0.42, 0]}><boxGeometry args={[w * 0.12, h * 0.18, d * 0.65]} /><meshStandardMaterial color="#596a78" /></mesh>)}</group>
}

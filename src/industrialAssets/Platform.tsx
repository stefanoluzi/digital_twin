import type { IndustrialAsset } from '../types/plant'

export function Platform({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h, depth: d } = asset.size
  return <group><mesh><boxGeometry args={[w, h * 0.28, d]} /><meshStandardMaterial color={color} roughness={0.82} /></mesh>{[-1, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}-${z}`} position={[x * w * 0.43, -h * 0.42, z * d * 0.43]}><boxGeometry args={[0.16, h * 0.84, 0.16]} /><meshStandardMaterial color="#596a78" /></mesh>))}</group>
}

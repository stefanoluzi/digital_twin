import type { IndustrialAsset } from '../types/plant'

export function PipeRackSimple({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h, depth: d } = asset.size
  const pipeZ = [-0.28, 0, 0.28]
  return <group>{[-1, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}-${z}`} position={[x * w * 0.43, 0, z * d * 0.4]}><boxGeometry args={[0.12, h, 0.12]} /><meshStandardMaterial color={color} /></mesh>))}<mesh position={[0, h * 0.28, 0]}><boxGeometry args={[w, 0.12, d]} /><meshStandardMaterial color={color} /></mesh>{pipeZ.map((z) => <mesh key={z} position={[0, h * 0.42, z * d]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.08, 0.08, w * 0.9, 16]} /><meshStandardMaterial color="#8a949e" metalness={0.18} roughness={0.55} /></mesh>)}</group>
}

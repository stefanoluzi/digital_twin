import type { IndustrialAsset } from '../types/plant'

export function TransmissionShaft({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h, depth: d } = asset.size
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[h * 0.12, h * 0.12, w, 24]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.22} />
      </mesh>
      {[-0.32, 0.32].map((x) => (
        <mesh key={x} position={[x * w, -h * 0.25, 0]}>
          <boxGeometry args={[w * 0.12, h * 0.5, d * 0.55]} />
          <meshStandardMaterial color="#596a78" roughness={0.82} />
        </mesh>
      ))}
    </group>
  )
}

import type { IndustrialAsset } from '../types/plant'

export function Coupling({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h } = asset.size
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh>
        <cylinderGeometry args={[h * 0.34, h * 0.34, w * 0.5, 24]} />
        <meshStandardMaterial color={color} roughness={0.58} metalness={0.18} />
      </mesh>
      {[-0.32, 0.32].map((x) => (
        <mesh key={x} position={[0, x * w, 0]}>
          <cylinderGeometry args={[h * 0.43, h * 0.43, w * 0.14, 24]} />
          <meshStandardMaterial color="#8a949e" roughness={0.58} metalness={0.18} />
        </mesh>
      ))}
    </group>
  )
}

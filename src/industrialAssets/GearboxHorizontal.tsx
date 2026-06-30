import type { IndustrialAsset } from '../types/plant'

export function GearboxHorizontal({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h, depth: d } = asset.size
  return (
    <group>
      <mesh>
        <boxGeometry args={[w * 0.68, h * 0.62, d * 0.78]} />
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.06} />
      </mesh>
      <mesh position={[-w * 0.48, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[h * 0.11, h * 0.11, w * 0.28, 20]} />
        <meshStandardMaterial color="#9ca3aa" metalness={0.2} roughness={0.55} />
      </mesh>
      <mesh position={[w * 0.48, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[h * 0.14, h * 0.14, w * 0.28, 20]} />
        <meshStandardMaterial color="#9ca3aa" metalness={0.2} roughness={0.55} />
      </mesh>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x * w, -h * 0.43, 0]}>
          <boxGeometry args={[w * 0.18, h * 0.16, d * 0.6]} />
          <meshStandardMaterial color="#596a78" roughness={0.82} />
        </mesh>
      ))}
    </group>
  )
}

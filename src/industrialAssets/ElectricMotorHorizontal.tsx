import type { IndustrialAsset } from '../types/plant'

export function ElectricMotorHorizontal({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h, depth: d } = asset.size
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[h * 0.33, h * 0.33, w * 0.72, 28]} />
        <meshStandardMaterial color={color} roughness={0.68} metalness={0.08} />
      </mesh>
      <mesh position={[w * 0.38, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[h * 0.27, h * 0.27, w * 0.12, 24]} />
        <meshStandardMaterial color="#8a949e" roughness={0.7} metalness={0.12} />
      </mesh>
      <mesh position={[0, h * 0.35, -d * 0.18]}>
        <boxGeometry args={[w * 0.28, h * 0.22, d * 0.3]} />
        <meshStandardMaterial color="#364654" roughness={0.78} />
      </mesh>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x * w, -h * 0.43, 0]}>
          <boxGeometry args={[w * 0.18, h * 0.18, d * 0.55]} />
          <meshStandardMaterial color="#596a78" roughness={0.82} />
        </mesh>
      ))}
    </group>
  )
}

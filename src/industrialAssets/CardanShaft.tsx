import type { IndustrialAsset } from '../types/plant'

export function CardanShaft({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h } = asset.size
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[h * 0.12, h * 0.12, w * 0.72, 20]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.22} />
      </mesh>
      {[-0.42, 0.42].map((x) => (
        <group key={x} position={[x * w, 0, 0]}>
          <mesh><boxGeometry args={[w * 0.13, h * 0.32, h * 0.18]} /><meshStandardMaterial color="#6b7b8c" /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[h * 0.15, h * 0.15, h * 0.46, 16]} /><meshStandardMaterial color="#9ca3aa" /></mesh>
        </group>
      ))}
    </group>
  )
}

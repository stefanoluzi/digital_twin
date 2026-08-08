import type { IndustrialAsset } from '../types/plant'

interface ElectricMotorModelProps {
  length: number
  diameter: number
  color: string
}

export function ElectricMotorModel({ length, diameter, color }: ElectricMotorModelProps) {
  const footHeight = diameter * 0.16
  return (
    <group name="electricMotorModel">
      <mesh name="motorBody" rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[diameter * 0.33, diameter * 0.33, length * 0.72, 28]} />
        <meshStandardMaterial color={color} roughness={0.68} metalness={0.08} />
      </mesh>
      <mesh name="motorFrontCap" position={[length * 0.38, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[diameter * 0.27, diameter * 0.27, length * 0.12, 24]} />
        <meshStandardMaterial color="#8a949e" roughness={0.7} metalness={0.12} />
      </mesh>
      <mesh name="motorRearFan" position={[-length * 0.39, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[diameter * 0.3, diameter * 0.3, length * 0.08, 24]} />
        <meshStandardMaterial color="#495761" roughness={0.75} metalness={0.08} />
      </mesh>
      <mesh name="terminalBox" position={[0, diameter * 0.35, -diameter * 0.18]} castShadow>
        <boxGeometry args={[length * 0.28, diameter * 0.22, diameter * 0.3]} />
        <meshStandardMaterial color="#364654" roughness={0.78} />
      </mesh>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} name={x < 0 ? 'motorFootRear' : 'motorFootFront'} position={[x * length, -diameter * 0.43, 0]} castShadow>
          <boxGeometry args={[length * 0.18, footHeight, diameter * 0.55]} />
          <meshStandardMaterial color="#596a78" roughness={0.82} />
        </mesh>
      ))}
    </group>
  )
}

export function ElectricMotorHorizontal({ asset, color }: { asset: IndustrialAsset; color: string }) {
  const { width: w, height: h, depth: d } = asset.size
  return <ElectricMotorModel length={w} diameter={Math.min(h, d)} color={color} />
}

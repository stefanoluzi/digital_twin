import type { IndustrialAsset } from '../types/plant'

interface Props {
  asset: IndustrialAsset
  color: string
}

export function CenteringStars({ asset, color }: Props) {
  const length = asset.size.width
  const diameter = Math.min(asset.size.height, asset.size.depth)
  const starCount = Math.max(1, Math.round(Number(asset.params.starCount ?? 6)))
  const shaftRadius = diameter * 0.08
  const hubRadius = diameter * 0.16
  const bladeLength = diameter * 0.42
  const bladeWidth = diameter * 0.14
  const bladeThickness = Math.max(0.06, length * 0.012)
  const supportCount = Math.max(2, Math.min(5, Math.round(length / 1.5)))

  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[shaftRadius, shaftRadius, length, 24]} />
        <meshStandardMaterial color="#8a949e" roughness={0.54} metalness={0.22} />
      </mesh>
      {Array.from({ length: supportCount }, (_, index) => {
        const x = supportCount === 1 ? 0 : -length / 2 + (index * length) / (supportCount - 1)
        return (
          <mesh key={`support-${index}`} position={[x, -diameter * 0.52, 0]}>
            <boxGeometry args={[0.16, diameter * 0.28, diameter * 0.16]} />
            <meshStandardMaterial color="#596a78" roughness={0.82} metalness={0.04} />
          </mesh>
        )
      })}
      {Array.from({ length: starCount }, (_, index) => {
        const x = starCount === 1 ? 0 : -length / 2 + (index * length) / (starCount - 1)
        return (
          <group key={`star-${index}`} position={[x, 0, 0]} rotation={[index % 2 ? Math.PI / 8 : 0, 0, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[hubRadius, hubRadius, bladeThickness * 1.4, 18]} />
              <meshStandardMaterial color="#5f4a3f" roughness={0.72} metalness={0.08} />
            </mesh>
            {[0, 1, 2, 3, 4].map((blade) => {
              const angle = (blade * Math.PI * 2) / 5
              const y = Math.cos(angle) * diameter * 0.28
              const z = Math.sin(angle) * diameter * 0.28
              return (
                <group key={blade} rotation={[angle, 0, 0]} position={[0, y, z]}>
                  <mesh>
                    <boxGeometry args={[bladeThickness, bladeLength, bladeWidth]} />
                    <meshStandardMaterial color={color} roughness={0.74} metalness={0.06} />
                  </mesh>
                  <mesh position={[0, bladeLength * 0.48, 0]}>
                    <boxGeometry args={[bladeThickness * 1.05, bladeWidth, bladeWidth * 1.45]} />
                    <meshStandardMaterial color={color} roughness={0.74} metalness={0.06} />
                  </mesh>
                </group>
              )
            })}
          </group>
        )
      })}
    </group>
  )
}

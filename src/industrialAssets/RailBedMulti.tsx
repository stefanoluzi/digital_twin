import type { IndustrialAsset, IndustrialParamValue } from '../types/plant'

interface Props {
  asset: IndustrialAsset
  color: string
}

const positive = (value: IndustrialParamValue | undefined, fallback: number, min = 0.05) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback

export function RailBedMulti({ asset, color }: Props) {
  const length = positive(asset.params.length, asset.size.width, 0.5)
  const width = positive(asset.params.width, asset.size.depth, 0.2)
  const railCount = Math.max(1, Math.round(positive(asset.params.railCount, 6, 1)))
  const railHeight = positive(asset.params.railHeight, 0.18, 0.05)
  const railWidth = positive(asset.params.railWidth, 0.12, 0.04)
  const supportSpacing = positive(asset.params.supportSpacing, 1, 0.2)
  const showCrossSupports = Number(asset.params.showCrossSupports ?? 1) > 0
  const supportHeight = Math.max(0.08, railHeight * 0.65)
  const supportY = -asset.size.height / 2 + supportHeight / 2
  const railBaseY = supportY + supportHeight / 2 + railHeight * 0.18
  const railLength = length * 0.96
  const supportCount = Math.max(2, Math.floor(length / supportSpacing) + 1)
  const railPositions = Array.from({ length: railCount }, (_, index) => {
    if (railCount === 1) return 0
    return -width / 2 + (index * width) / (railCount - 1)
  })

  return (
    <group>
      <mesh position={[0, supportY - supportHeight * 0.32, 0]}>
        <boxGeometry args={[length, supportHeight * 0.36, width + railWidth * 2]} />
        <meshStandardMaterial color={color} roughness={0.84} metalness={0.04} />
      </mesh>

      {showCrossSupports && Array.from({ length: supportCount }, (_, index) => {
        const x = supportCount === 1 ? 0 : -length / 2 + (index * length) / (supportCount - 1)
        return (
          <mesh key={`support-${index}`} position={[x, supportY, 0]}>
            <boxGeometry args={[Math.max(0.08, railWidth * 0.9), supportHeight, width + railWidth * 3]} />
            <meshStandardMaterial color={color} roughness={0.82} metalness={0.05} />
          </mesh>
        )
      })}

      {railPositions.map((z, index) => (
        <group key={`rail-${index}`} position={[0, railBaseY, z]}>
          <mesh position={[0, -railHeight * 0.28, 0]}>
            <boxGeometry args={[railLength, railHeight * 0.26, railWidth * 1.9]} />
            <meshStandardMaterial color="#68737e" roughness={0.58} metalness={0.2} />
          </mesh>
          <mesh>
            <boxGeometry args={[railLength, railHeight * 0.72, railWidth * 0.62]} />
            <meshStandardMaterial color="#7b8794" roughness={0.56} metalness={0.22} />
          </mesh>
          <mesh position={[0, railHeight * 0.38, 0]}>
            <boxGeometry args={[railLength, railHeight * 0.26, railWidth * 1.35]} />
            <meshStandardMaterial color="#9aa4ad" roughness={0.52} metalness={0.25} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

import type { IndustrialAsset, IndustrialParamValue } from '../../types/plant'

interface Props {
  asset: IndustrialAsset
  color: string
}

const numberParam = (value: IndustrialParamValue | undefined, fallback: number, min = 0.05) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback

export function PiercerMachine({ asset, color }: Props) {
  const length = numberParam(asset.params.length, asset.size.width, 1)
  const width = numberParam(asset.params.width, asset.size.depth, 0.5)
  const height = numberParam(asset.params.height, asset.size.height, 0.8)
  const baseHeight = numberParam(asset.params.baseHeight, 0.3, 0.1)
  const frameThickness = numberParam(asset.params.frameThickness, 0.55, 0.12)
  const openingWidth = Math.max(0.3, Math.min(length - frameThickness * 2, Math.min(length * 0.72, numberParam(asset.params.openingWidth, 2.2, 0.5))))
  const rollDiameter = numberParam(asset.params.rollDiameter, 0.45, 0.1)
  const rollAngle = (numberParam(asset.params.rollAngle, 25, 0) * Math.PI) / 180
  const mandrelDiameter = numberParam(asset.params.mandrelDiameter, 0.18, 0.05)

  const bodyHeight = Math.max(0.4, height - baseHeight)
  const openingHeight = Math.max(0.25, Math.min(bodyHeight - frameThickness * 2, Math.min(bodyHeight * 0.62, numberParam(asset.params.openingHeight, 1.3, 0.3))))
  const baseY = -height / 2 + baseHeight / 2
  const railY = -height / 2 + baseHeight + 0.055
  const bodyY = -height / 2 + baseHeight + bodyHeight / 2
  const openingY = bodyY + bodyHeight * 0.02
  const bodyBottom = bodyY - bodyHeight / 2
  const bodyTop = bodyY + bodyHeight / 2
  const openingLeft = -openingWidth / 2
  const openingRight = openingWidth / 2
  const openingBottom = openingY - openingHeight / 2
  const openingTop = openingY + openingHeight / 2
  const sideBlockWidth = Math.max(frameThickness, (length - openingWidth) / 2)
  const topBlockHeight = Math.max(frameThickness, bodyTop - openingTop)
  const bottomBlockHeight = Math.max(frameThickness, openingBottom - bodyBottom)
  const topBlockY = openingTop + topBlockHeight / 2
  const bottomBlockY = openingBottom - bottomBlockHeight / 2
  const sideBlockY = openingY
  const rollLength = Math.max(0.6, openingWidth * 0.68)
  const rollYGap = openingHeight * 0.26
  const mandrelLength = width * 1.28
  const bodyColor = color || '#6b7280'

  return (
    <group>
      <mesh position={[0, baseY, 0]}>
        <boxGeometry args={[length * 1.08, baseHeight, width * 1.18]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.82} metalness={0.05} />
      </mesh>
      <mesh position={[0, railY, 0]}>
        <boxGeometry args={[length * 1.02, baseHeight * 0.24, width * 1.02]} />
        <meshStandardMaterial color="#4b5563" roughness={0.78} metalness={0.08} />
      </mesh>

      <mesh position={[0, topBlockY, 0]}>
        <boxGeometry args={[length, topBlockHeight, width]} />
        <meshStandardMaterial color={bodyColor} roughness={0.8} metalness={0.06} />
      </mesh>
      <mesh position={[0, bottomBlockY, 0]}>
        <boxGeometry args={[length, bottomBlockHeight, width]} />
        <meshStandardMaterial color={bodyColor} roughness={0.8} metalness={0.06} />
      </mesh>
      <mesh position={[openingLeft - sideBlockWidth / 2, sideBlockY, 0]}>
        <boxGeometry args={[sideBlockWidth, openingHeight, width]} />
        <meshStandardMaterial color={bodyColor} roughness={0.8} metalness={0.06} />
      </mesh>
      <mesh position={[openingRight + sideBlockWidth / 2, sideBlockY, 0]}>
        <boxGeometry args={[sideBlockWidth, openingHeight, width]} />
        <meshStandardMaterial color={bodyColor} roughness={0.8} metalness={0.06} />
      </mesh>

      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, openingY + side * rollYGap, 0]} rotation={[0, side * rollAngle, Math.PI / 2]}>
          <cylinderGeometry args={[rollDiameter / 2, rollDiameter / 2, rollLength, 28]} />
          <meshStandardMaterial color="#c7d0d8" roughness={0.48} metalness={0.24} />
        </mesh>
      ))}

      <mesh position={[0, openingY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[mandrelDiameter / 2, mandrelDiameter / 2, mandrelLength, 24]} />
        <meshStandardMaterial color="#d7dee5" roughness={0.42} metalness={0.35} />
      </mesh>
      <mesh position={[0, openingY, -mandrelLength * 0.48]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[mandrelDiameter * 0.72, mandrelDiameter * 0.72, mandrelDiameter * 0.6, 20]} />
        <meshStandardMaterial color="#aab4be" roughness={0.5} metalness={0.22} />
      </mesh>

      <mesh position={[length * 0.38, bodyY + bodyHeight * 0.12, -width / 2 - 0.045]}>
        <boxGeometry args={[length * 0.11, bodyHeight * 0.28, 0.12]} />
        <meshStandardMaterial color="#56616c" roughness={0.76} metalness={0.08} />
      </mesh>
    </group>
  )
}

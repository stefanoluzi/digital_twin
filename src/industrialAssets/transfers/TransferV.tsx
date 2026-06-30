import type { IndustrialAsset, IndustrialParamValue } from '../../types/plant'
import { commonShaftLength, positions, TransferBase } from './TransferBase'

interface Props {
  asset: IndustrialAsset
  color: string
}

const numberParam = (value: IndustrialParamValue | undefined, fallback: number, min = 0.05) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback
const countParam = (value: IndustrialParamValue | undefined, fallback: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(numberParam(value, fallback, min))))

function TransferVUnit({
  columnHeight,
  vWidth,
  vOpening,
  shaftDiameter,
  pivotAngle,
  color,
}: {
  columnHeight: number
  vWidth: number
  vOpening: number
  shaftDiameter: number
  pivotAngle: number
  color: string
}) {
  const cupRise = Math.max(0.25, Math.min(1.2, vOpening))
  const vertexY = columnHeight
  const topY = vertexY + cupRise
  const topZ = vWidth * 0.48
  const armLength = Math.sqrt(cupRise ** 2 + topZ ** 2)

  return (
    <group name="pivotGroup" rotation={[pivotAngle, 0, 0]}>
      <mesh position={[0, columnHeight * 0.5, 0]}>
        <boxGeometry args={[shaftDiameter * 1.6, columnHeight, shaftDiameter * 1.6]} />
        <meshStandardMaterial color={color} roughness={0.82} metalness={0.05} />
      </mesh>
      <mesh position={[0, vertexY, 0]}>
        <boxGeometry args={[shaftDiameter * 2.4, shaftDiameter * 0.8, shaftDiameter * 1.8]} />
        <meshStandardMaterial color="#374151" roughness={0.82} metalness={0.05} />
      </mesh>
      {[-1, 1].map((side) => {
        const dz = side * topZ
        const rotationX = Math.atan2(-cupRise, dz)
        return (
          <mesh key={side} position={[0, (vertexY + topY) / 2, dz / 2]} rotation={[rotationX, 0, 0]}>
            <boxGeometry args={[shaftDiameter * 3.4, shaftDiameter * 0.72, armLength]} />
            <meshStandardMaterial color="#6b7b8c" roughness={0.78} metalness={0.08} />
          </mesh>
        )
      })}
    </group>
  )
}

export function TransferV({ asset, color }: Props) {
  const count = countParam(asset.params.count, 1, 1, 24)
  const spacing = numberParam(asset.params.spacing, 1.8, 0.2)
  const columnHeight = numberParam(asset.params.columnHeight, 1.35, 0.4)
  const vWidth = numberParam(asset.params.vWidth, 1.1, 0.3)
  const vOpening = numberParam(asset.params.vOpening, 0.55, 0.15)
  const shaftDiameter = numberParam(asset.params.shaftDiameter, 0.18, 0.06)
  const endMargin = numberParam(asset.params.shaftLength, Math.max(0.9, vWidth * 0.9), 0.4)
  const shaftLength = commonShaftLength(count, spacing, endMargin)
  const supportHeight = numberParam(asset.params.supportHeight, 0.28, 0.12)
  const pivotAngle = numberParam(asset.params.pivotAngle, 0, 0)
  const unitPositions = positions(count, spacing)

  return (
    <group>
      <TransferBase shaftDiameter={shaftDiameter} shaftLength={shaftLength} supportHeight={supportHeight} baseDepth={vWidth * 0.9} color="#4b5563" />
      <group name="unitsGroup">
        {unitPositions.map((x, index) => (
          <group key={index} name={`unit_${index + 1}`} position={[x, 0, 0]}>
            <TransferVUnit columnHeight={columnHeight} vWidth={vWidth} vOpening={vOpening} shaftDiameter={shaftDiameter} pivotAngle={pivotAngle} color={color} />
          </group>
        ))}
        </group>
    </group>
  )
}

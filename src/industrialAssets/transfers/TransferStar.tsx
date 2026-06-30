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

function Shuriken({ diameter, thickness, armCount, color }: { diameter: number; thickness: number; armCount: number; color: string }) {
  const hubRadius = diameter * 0.18
  const armLength = diameter * 0.42
  const armWidth = diameter * 0.2

  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[hubRadius, hubRadius, thickness * 1.45, 30]} />
        <meshStandardMaterial color="#5f4a3f" roughness={0.76} metalness={0.08} />
      </mesh>
      {Array.from({ length: armCount }, (_, index) => {
        const angle = (index * Math.PI * 2) / armCount
        const y = Math.cos(angle) * diameter * 0.24
        const z = Math.sin(angle) * diameter * 0.24
        return (
          <group key={index} rotation={[angle, 0, 0]} position={[0, y, z]}>
            <mesh position={[0, armLength * 0.18, 0]} rotation={[0, 0, -0.1]}>
              <boxGeometry args={[thickness, armLength * 0.74, armWidth]} />
              <meshStandardMaterial color={color} roughness={0.74} metalness={0.06} />
            </mesh>
            <mesh position={[0, armLength * 0.42, armWidth * 0.08]} rotation={[0, 0, 0.16]}>
              <boxGeometry args={[thickness, armLength * 0.5, armWidth * 1.05]} />
              <meshStandardMaterial color={color} roughness={0.74} metalness={0.06} />
            </mesh>
            <mesh position={[0, armLength * 0.68, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[armWidth * 0.5, armWidth * 0.5, thickness * 1.05, 18]} />
              <meshStandardMaterial color={color} roughness={0.72} metalness={0.08} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

export function TransferStar({ asset, color }: Props) {
  const count = countParam(asset.params.count, 1, 1, 24)
  const spacing = numberParam(asset.params.spacing, 1.8, 0.2)
  const armCount = countParam(asset.params.armCount, 4, 4, 8)
  const diameter = numberParam(asset.params.transferDiameter, asset.size.height, 0.4)
  const thickness = numberParam(asset.params.height, 0.34, 0.1)
  const shaftDiameter = numberParam(asset.params.shaftDiameter, 0.18, 0.06)
  const endMargin = numberParam(asset.params.shaftLength, Math.max(1.1, thickness * 2.4), 0.4)
  const shaftLength = commonShaftLength(count, spacing, endMargin)
  const supportHeight = numberParam(asset.params.supportHeight, 0.28, 0.12)
  const pivotAngle = numberParam(asset.params.pivotAngle, 0, 0)
  const unitPositions = positions(count, spacing)

  return (
    <group>
      <TransferBase shaftDiameter={shaftDiameter} shaftLength={shaftLength} supportHeight={supportHeight} baseDepth={diameter * 0.38} color="#4b5563" />
      <group name="unitsGroup">
        {unitPositions.map((x, index) => (
          <group key={index} name={`unit_${index + 1}`} position={[x, 0, 0]}>
            <group name="pivotGroup" rotation={[pivotAngle, 0, 0]}>
            <Shuriken diameter={diameter} thickness={thickness} armCount={armCount} color={color} />
            </group>
          </group>
        ))}
      </group>
    </group>
  )
}

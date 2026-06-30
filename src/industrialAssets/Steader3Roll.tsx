import type { IndustrialAsset, IndustrialParamValue } from '../types/plant'

interface Props {
  asset: IndustrialAsset
  color: string
}

const positive = (value: IndustrialParamValue | undefined, fallback: number, min = 0.05) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback
const colorParam = (value: IndustrialParamValue | undefined, fallback: string) =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback

function CylinderBetween({
  start,
  end,
  radius,
  color,
  segments = 14,
}: {
  start: [number, number, number]
  end: [number, number, number]
  radius: number
  color: string
  segments?: number
}) {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const dz = end[2] - start[2]
  const length = Math.hypot(dx, dy, dz)
  const yaw = Math.atan2(dz, dx)
  const pitch = Math.atan2(dy, Math.hypot(dx, dz))

  return (
    <group position={[(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2]} rotation={[0, -yaw, pitch]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[radius, radius, length, segments]} />
        <meshStandardMaterial color={color} roughness={0.56} metalness={0.16} />
      </mesh>
    </group>
  )
}

function Roller({
  position,
  length,
  diameter,
  color,
}: {
  position: [number, number, number]
  length: number
  diameter: number
  color: string
}) {
  const capColor = '#334155'
  const shaftColor = '#94a3b8'
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[diameter / 2, diameter / 2, length, 28]} />
        <meshStandardMaterial color={color} roughness={0.64} metalness={0.1} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * length * 0.54, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[diameter * 0.55, diameter * 0.55, length * 0.035, 24]} />
            <meshStandardMaterial color={capColor} roughness={0.62} metalness={0.12} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[diameter * 0.18, diameter * 0.18, length * 0.16, 16]} />
            <meshStandardMaterial color={shaftColor} roughness={0.52} metalness={0.22} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function Steader3Roll({ asset, color }: Props) {
  const length = positive(asset.params.length, asset.size.width, 1)
  const width = positive(asset.params.width, asset.size.depth, 0.8)
  const height = positive(asset.params.height, asset.size.height, 0.8)
  const rollerDiameter = positive(asset.params.rollerDiameter, 0.35, 0.1)
  const rollerLength = Math.min(length * 0.78, positive(asset.params.rollerLength, 1.4, 0.3))
  const rollerColor = colorParam(asset.params.rollerColor, '#d97706')
  const frameColor = colorParam(asset.params.frameColor, color || '#374151')
  const showTubePlaceholder = (asset.params.showTubePlaceholder ?? 1) !== 0
  const showHydraulics = (asset.params.showHydraulics ?? 1) !== 0
  const baseY = -height * 0.46
  const centralY = 0
  const topRoll: [number, number, number] = [0, centralY + height * 0.28, 0]
  const lowerLeft: [number, number, number] = [0, centralY - height * 0.16, -width * 0.28]
  const lowerRight: [number, number, number] = [0, centralY - height * 0.16, width * 0.28]
  const sideZ = width * 0.48
  const sidePlateH = height * 0.82
  const sidePlateY = baseY + height * 0.08 + sidePlateH / 2
  const bearingColor = '#4b5563'
  const steel = '#9ca3af'
  const hydraulicBody = '#1f2937'
  const leftSideZ = -sideZ

  return (
    <group>
      <mesh position={[0, baseY, 0]}>
        <boxGeometry args={[length, height * 0.16, width * 0.95]} />
        <meshStandardMaterial color={frameColor} roughness={0.82} metalness={0.05} />
      </mesh>
      <mesh position={[0, sidePlateY, leftSideZ]}>
        <boxGeometry args={[length * 0.92, sidePlateH, width * 0.11]} />
        <meshStandardMaterial color={frameColor} roughness={0.82} metalness={0.05} />
      </mesh>
      {[-0.42, 0.42].map((x) => (
        <mesh key={`upright-${x}`} position={[x * length, sidePlateY + height * 0.02, leftSideZ]}>
          <boxGeometry args={[length * 0.08, sidePlateH * 1.04, width * 0.16]} />
          <meshStandardMaterial color="#27303b" roughness={0.84} metalness={0.06} />
        </mesh>
      ))}
      {showTubePlaceholder && (
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[rollerDiameter * 0.32, rollerDiameter * 0.32, length * 1.08, 24]} />
          <meshStandardMaterial color="#cbd5e1" transparent opacity={0.25} roughness={0.48} metalness={0.08} />
        </mesh>
      )}

      <Roller position={topRoll} length={rollerLength} diameter={rollerDiameter} color={rollerColor} />
      <Roller position={lowerLeft} length={rollerLength} diameter={rollerDiameter} color={rollerColor} />
      <Roller position={lowerRight} length={rollerLength} diameter={rollerDiameter} color={rollerColor} />

      {[topRoll, lowerLeft, lowerRight].map((position, index) => (
        <group key={`bearing-set-${index}`}>
          {[-1, 1].map((xSide) => (
            <mesh key={xSide} position={[xSide * rollerLength * 0.64, position[1], position[2]]}>
              <boxGeometry args={[length * 0.12, rollerDiameter * 0.85, rollerDiameter * 0.85]} />
              <meshStandardMaterial color={bearingColor} roughness={0.74} metalness={0.08} />
            </mesh>
          ))}
          {[-1, 1].map((xSide) => (
            <mesh key={`arm-${xSide}`} position={[xSide * rollerLength * 0.42, (position[1] + baseY) / 2, position[2]]}>
              <boxGeometry args={[length * 0.08, Math.max(height * 0.12, Math.abs(position[1] - baseY)), width * 0.07]} />
              <meshStandardMaterial color="#2f3945" roughness={0.8} metalness={0.06} />
            </mesh>
          ))}
        </group>
      ))}

      {showHydraulics && (
        <>
          <CylinderBetween start={[-length * 0.38, height * 0.32, -sideZ]} end={[-rollerLength * 0.38, topRoll[1], topRoll[2] - rollerDiameter * 0.6]} radius={height * 0.035} color={hydraulicBody} />
          <CylinderBetween start={[length * 0.38, baseY + height * 0.16, -sideZ]} end={[rollerLength * 0.38, lowerLeft[1], lowerLeft[2]]} radius={height * 0.03} color={hydraulicBody} />
          <CylinderBetween start={[length * 0.38, baseY + height * 0.16, sideZ]} end={[rollerLength * 0.38, lowerRight[1], lowerRight[2]]} radius={height * 0.03} color={hydraulicBody} />
        </>
      )}

      {[-1, 1].map((zSide) => (
        <CylinderBetween key={`hose-${zSide}`} start={[-length * 0.46, baseY + height * 0.14, zSide * sideZ]} end={[-length * 0.1, height * 0.22, zSide * width * 0.18]} radius={height * 0.01} color={steel} segments={10} />
      ))}
    </group>
  )
}

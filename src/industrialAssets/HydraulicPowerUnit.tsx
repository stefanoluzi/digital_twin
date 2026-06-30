import type { IndustrialAsset, IndustrialParamValue } from '../types/plant'

interface Props {
  asset: IndustrialAsset
  color: string
}

const positive = (value: IndustrialParamValue | undefined, fallback: number, min = 0.05) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback
const clampCount = (value: IndustrialParamValue | undefined, fallback: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(positive(value, fallback, min))))

function Pipe({
  start,
  end,
  radius,
  color,
}: {
  start: [number, number, number]
  end: [number, number, number]
  radius: number
  color: string
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
        <cylinderGeometry args={[radius, radius, length, 14]} />
        <meshStandardMaterial color={color} roughness={0.48} metalness={0.24} />
      </mesh>
    </group>
  )
}

function EyeBolt({ position, radius, color }: { position: [number, number, number]; radius: number; color: string }) {
  return (
    <group position={position}>
      <mesh position={[0, radius * 0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[radius * 0.22, radius * 0.22, radius * 1.25, 8]} />
        <meshStandardMaterial color={color} roughness={0.58} metalness={0.18} />
      </mesh>
      <mesh position={[-radius * 0.62, 0, 0]}>
        <cylinderGeometry args={[radius * 0.2, radius * 0.2, radius * 1.1, 8]} />
        <meshStandardMaterial color={color} roughness={0.58} metalness={0.18} />
      </mesh>
      <mesh position={[radius * 0.62, 0, 0]}>
        <cylinderGeometry args={[radius * 0.2, radius * 0.2, radius * 1.1, 8]} />
        <meshStandardMaterial color={color} roughness={0.58} metalness={0.18} />
      </mesh>
      <mesh position={[0, -radius * 0.75, 0]}>
        <cylinderGeometry args={[radius * 0.18, radius * 0.18, radius * 0.9, 8]} />
        <meshStandardMaterial color={color} roughness={0.58} metalness={0.18} />
      </mesh>
    </group>
  )
}

export function HydraulicPowerUnit({ asset, color }: Props) {
  const length = positive(asset.params.length, asset.size.width, 1)
  const width = positive(asset.params.width, asset.size.depth, 0.8)
  const height = positive(asset.params.height, asset.size.height, 0.8)
  const pumpCount = clampCount(asset.params.pumpCount, 1, 1, 2)
  const accumulatorCount = clampCount(asset.params.accumulatorCount, 2, 0, 4)
  const filterCount = clampCount(asset.params.filterCount, 2, 0, 4)
  const valveSections = clampCount(asset.params.valveSections, 5, 1, 8)

  const tankColor = color || '#2563eb'
  const motorColor = '#38bdf8'
  const pumpColor = '#9aa4ad'
  const manifoldColor = '#334155'
  const darkSteel = '#4b5563'
  const steel = '#7b8794'
  const pipeColor = '#cbd5e1'
  const filterColor = '#e5e7eb'
  const accumulatorColor = '#1e293b'

  const skidY = -height * 0.47
  const skidBeamH = height * 0.075
  const tankHeight = height * 0.35
  const tankY = skidY + skidBeamH * 0.7 + tankHeight / 2
  const topY = tankY + tankHeight / 2
  const tankLength = length * 0.9
  const tankWidth = width * 0.78
  const motorY = topY + height * 0.22
  const motorRadius = height * 0.13
  const motorBodyLength = length * 0.34
  const motorX = -length * 0.28
  const pumpX = motorX + motorBodyLength * 0.64
  const valveX = length * 0.16
  const valveY = topY + height * 0.29
  const valveZ = width * 0.08
  const accumulatorX = length * 0.38
  const accumulatorBaseZ = -width * 0.32
  const filterBaseX = -length * 0.02
  const filterZ = width * 0.32

  return (
    <group>
      {[-1, 1].map((zSide) => (
        <mesh key={`skid-long-${zSide}`} position={[0, skidY, zSide * width * 0.47]}>
          <boxGeometry args={[length * 1.06, skidBeamH, width * 0.075]} />
          <meshStandardMaterial color={darkSteel} roughness={0.76} metalness={0.1} />
        </mesh>
      ))}
      {[-0.42, -0.14, 0.14, 0.42].map((x) => (
        <mesh key={`skid-cross-${x}`} position={[x * length, skidY + skidBeamH * 0.08, 0]}>
          <boxGeometry args={[length * 0.045, skidBeamH * 1.15, width * 1.02]} />
          <meshStandardMaterial color={darkSteel} roughness={0.78} metalness={0.08} />
        </mesh>
      ))}

      <mesh position={[0, tankY, 0]}>
        <boxGeometry args={[tankLength, tankHeight, tankWidth]} />
        <meshStandardMaterial color={tankColor} roughness={0.72} metalness={0.04} />
      </mesh>
      <mesh position={[0, topY + height * 0.018, 0]}>
        <boxGeometry args={[tankLength * 1.03, height * 0.035, tankWidth * 1.06]} />
        <meshStandardMaterial color="#1d4ed8" roughness={0.72} metalness={0.05} />
      </mesh>
      <mesh position={[-length * 0.2, topY + height * 0.045, width * 0.2]}>
        <cylinderGeometry args={[width * 0.09, width * 0.09, height * 0.03, 18]} />
        <meshStandardMaterial color={steel} roughness={0.62} metalness={0.14} />
      </mesh>
      <mesh position={[length * 0.28, topY + height * 0.085, width * 0.22]}>
        <cylinderGeometry args={[width * 0.025, width * 0.04, height * 0.12, 12]} />
        <meshStandardMaterial color={steel} roughness={0.58} metalness={0.16} />
      </mesh>
      <mesh position={[-length * 0.42, tankY, -tankWidth * 0.51]}>
        <boxGeometry args={[length * 0.035, tankHeight * 0.72, width * 0.035]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.46} metalness={0.08} />
      </mesh>
      <mesh position={[length * 0.42, tankY, -tankWidth * 0.51]}>
        <boxGeometry args={[length * 0.06, tankHeight * 0.58, width * 0.03]} />
        <meshStandardMaterial color="#1e40af" roughness={0.72} metalness={0.03} />
      </mesh>

      {[-0.42, 0.42].map((x) => (
        <EyeBolt key={`eye-${x}`} position={[x * length, topY + height * 0.1, -tankWidth * 0.38]} radius={height * 0.035} color={steel} />
      ))}
      {[-1, 1].map((zSide) => (
        <mesh key={`side-stiffener-${zSide}`} position={[-length * 0.06, tankY + tankHeight * 0.08, zSide * tankWidth * 0.52]}>
          <boxGeometry args={[length * 0.55, tankHeight * 0.08, width * 0.035]} />
          <meshStandardMaterial color="#1e40af" roughness={0.74} metalness={0.04} />
        </mesh>
      ))}

      {Array.from({ length: pumpCount }, (_, index) => {
        const z = pumpCount === 1 ? -width * 0.16 : -width * 0.27 + index * width * 0.22
        return (
          <group key={`motor-pump-${index}`}>
            <mesh position={[motorX, motorY, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[motorRadius, motorRadius, motorBodyLength, 28]} />
              <meshStandardMaterial color={motorColor} roughness={0.58} metalness={0.08} />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh key={`motor-cap-${index}-${side}`} position={[motorX + side * motorBodyLength * 0.52, motorY, z]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[motorRadius * 1.04, motorRadius * 1.04, length * 0.035, 24]} />
                <meshStandardMaterial color="#0ea5e9" roughness={0.62} metalness={0.08} />
              </mesh>
            ))}
            <mesh position={[motorX - motorBodyLength * 0.58, motorY, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[motorRadius * 0.9, motorRadius * 0.9, length * 0.03, 18]} />
              <meshStandardMaterial color="#475569" roughness={0.68} metalness={0.08} />
            </mesh>
            <mesh position={[motorX - motorBodyLength * 0.1, motorY + motorRadius * 1.05, z]}>
              <boxGeometry args={[length * 0.13, height * 0.09, width * 0.13]} />
              <meshStandardMaterial color="#334155" roughness={0.7} metalness={0.04} />
            </mesh>
            {[-0.55, 0.55].map((foot) => (
              <mesh key={`motor-foot-${index}-${foot}`} position={[motorX + foot * motorBodyLength * 0.32, topY + height * 0.045, z]}>
                <boxGeometry args={[length * 0.09, height * 0.08, width * 0.13]} />
                <meshStandardMaterial color={darkSteel} roughness={0.78} metalness={0.06} />
              </mesh>
            ))}
            <mesh position={[pumpX - length * 0.09, motorY, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[motorRadius * 0.4, motorRadius * 0.4, length * 0.12, 16]} />
              <meshStandardMaterial color={steel} roughness={0.52} metalness={0.2} />
            </mesh>
            <mesh position={[pumpX + length * 0.02, motorY, z]}>
              <boxGeometry args={[length * 0.14, height * 0.22, width * 0.18]} />
              <meshStandardMaterial color={pumpColor} roughness={0.56} metalness={0.18} />
            </mesh>
            <mesh position={[pumpX + length * 0.11, motorY, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[height * 0.085, height * 0.085, length * 0.08, 18]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.52} metalness={0.18} />
            </mesh>
            <Pipe start={[pumpX + length * 0.16, motorY, z]} end={[valveX - length * 0.24, valveY, valveZ]} radius={height * 0.016} color={pipeColor} />
          </group>
        )
      })}

      <group position={[valveX, valveY, valveZ]}>
        <mesh>
          <boxGeometry args={[length * 0.48, height * 0.16, width * 0.18]} />
          <meshStandardMaterial color={manifoldColor} roughness={0.7} metalness={0.12} />
        </mesh>
        {Array.from({ length: valveSections }, (_, index) => {
          const x = valveSections === 1 ? 0 : -length * 0.2 + (index * length * 0.4) / (valveSections - 1)
          return (
            <group key={`valve-${index}`} position={[x, height * 0.11, 0]}>
              <mesh>
                <boxGeometry args={[length * 0.04, height * 0.16, width * 0.19]} />
                <meshStandardMaterial color="#475569" roughness={0.72} metalness={0.08} />
              </mesh>
              <mesh position={[0, height * 0.095, 0]}>
                <boxGeometry args={[length * 0.045, height * 0.035, width * 0.16]} />
                <meshStandardMaterial color="#64748b" roughness={0.68} metalness={0.08} />
              </mesh>
            </group>
          )
        })}
      </group>

      {Array.from({ length: filterCount }, (_, index) => {
        const x = filterCount === 1 ? filterBaseX : filterBaseX + (index - (filterCount - 1) / 2) * length * 0.12
        const y = topY + height * 0.23
        return (
          <group key={`filter-${index}`} position={[x, y, filterZ]}>
            <mesh position={[0, -height * 0.16, 0]}>
              <boxGeometry args={[width * 0.16, height * 0.08, width * 0.16]} />
              <meshStandardMaterial color={darkSteel} roughness={0.72} metalness={0.08} />
            </mesh>
            <mesh>
              <cylinderGeometry args={[width * 0.06, width * 0.06, height * 0.34, 18]} />
              <meshStandardMaterial color={filterColor} roughness={0.54} metalness={0.12} />
            </mesh>
            <mesh position={[0, height * 0.19, 0]}>
              <cylinderGeometry args={[width * 0.07, width * 0.07, height * 0.055, 18]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.58} metalness={0.14} />
            </mesh>
            <mesh position={[0, -height * 0.24, 0]}>
              <boxGeometry args={[width * 0.08, height * 0.18, width * 0.06]} />
              <meshStandardMaterial color={darkSteel} roughness={0.78} metalness={0.06} />
            </mesh>
            <Pipe start={[0, -height * 0.16, 0]} end={[valveX - x, valveY - y, valveZ - filterZ]} radius={height * 0.012} color={pipeColor} />
          </group>
        )
      })}

      {Array.from({ length: accumulatorCount }, (_, index) => {
        const z = accumulatorCount === 1 ? accumulatorBaseZ : accumulatorBaseZ + (index - (accumulatorCount - 1) / 2) * width * 0.14
        const y = topY + height * 0.3
        return (
          <group key={`accumulator-${index}`} position={[accumulatorX, y, z]}>
            <mesh position={[0, -height * 0.31, 0]}>
              <boxGeometry args={[width * 0.17, height * 0.08, width * 0.17]} />
              <meshStandardMaterial color={darkSteel} roughness={0.74} metalness={0.08} />
            </mesh>
            <mesh>
              <cylinderGeometry args={[width * 0.065, width * 0.065, height * 0.54, 20]} />
              <meshStandardMaterial color={accumulatorColor} roughness={0.52} metalness={0.14} />
            </mesh>
            <mesh position={[0, height * 0.29, 0]}>
              <cylinderGeometry args={[width * 0.01, width * 0.065, height * 0.08, 20]} />
              <meshStandardMaterial color="#334155" roughness={0.54} metalness={0.12} />
            </mesh>
            <mesh position={[0, -height * 0.29, 0]}>
              <boxGeometry args={[width * 0.05, height * 0.16, width * 0.06]} />
              <meshStandardMaterial color={darkSteel} roughness={0.76} metalness={0.08} />
            </mesh>
            <Pipe start={[0, -height * 0.27, 0]} end={[valveX - accumulatorX, valveY - y, valveZ - z]} radius={height * 0.012} color={pipeColor} />
          </group>
        )
      })}

      <Pipe start={[valveX - length * 0.28, valveY - height * 0.02, valveZ]} end={[valveX + length * 0.32, valveY - height * 0.02, valveZ]} radius={height * 0.018} color={pipeColor} />
      <mesh position={[valveX + length * 0.28, valveY + height * 0.08, valveZ]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[height * 0.06, height * 0.06, height * 0.02, 18]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.48} metalness={0.08} />
      </mesh>
      <mesh position={[valveX + length * 0.28, valveY + height * 0.08, valveZ]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[height * 0.032, height * 0.032, height * 0.024, 12]} />
        <meshStandardMaterial color="#0f172a" roughness={0.7} metalness={0.02} />
      </mesh>
    </group>
  )
}

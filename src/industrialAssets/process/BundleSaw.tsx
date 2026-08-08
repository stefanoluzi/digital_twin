import * as THREE from 'three'
import type { IndustrialAsset, IndustrialParamKey } from '../../types/plant'
import { ElectricMotorModel } from '../ElectricMotorHorizontal'

interface Props {
  asset: IndustrialAsset
  color: string
}

const numberParam = (asset: IndustrialAsset, key: IndustrialParamKey, fallback: number, min = 0.01) => {
  const value = asset.params[key]
  return typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback
}

const finiteParam = (asset: IndustrialAsset, key: IndustrialParamKey, fallback: number) => {
  const value = asset.params[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const enabledParam = (asset: IndustrialAsset, key: IndustrialParamKey, fallback: boolean) => {
  const value = asset.params[key]
  return typeof value === 'number' ? value > 0 : fallback
}

function BeltSpan({ start, end, radius }: { start: THREE.Vector3; end: THREE.Vector3; radius: number }) {
  const direction = end.clone().sub(start)
  const length = direction.length()
  const midpoint = start.clone().add(end).multiplyScalar(0.5)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  return (
    <mesh position={midpoint} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial color="#22272b" roughness={0.92} metalness={0.02} />
    </mesh>
  )
}

export function BundleSaw({ asset, color }: Props) {
  const length = numberParam(asset, 'length', 3.5, 1)
  const width = numberParam(asset, 'width', 2, 0.8)
  const chassisHeight = numberParam(asset, 'chassisHeight', 0.45, 0.15)
  const wheelRadius = numberParam(asset, 'wheelRadius', 0.35, 0.1)
  const wheelWidth = numberParam(asset, 'wheelWidth', 0.2, 0.05)
  const wheelbase = Math.min(length * 0.88, numberParam(asset, 'wheelbase', 2.4, 0.5))
  const trackWidth = Math.min(width * 1.15, numberParam(asset, 'trackWidth', 1.7, 0.5))

  const shaftDiameter = numberParam(asset, 'shaftDiameter', 0.2, 0.05)
  const shaftLength = numberParam(asset, 'shaftLength', 2.8, width * 0.8)
  const shaftHeight = Math.max(wheelRadius * 2 + chassisHeight * 0.35, numberParam(asset, 'shaftHeight', 1, 0.35))
  const shaftFrontOffset = finiteParam(asset, 'shaftFrontOffset', 1.2)

  const bladeDiameter = numberParam(asset, 'bladeDiameter', 1.6, 0.4)
  const bladeThickness = numberParam(asset, 'bladeThickness', 0.08, 0.02)
  const bladeHubDiameter = Math.min(bladeDiameter * 0.7, numberParam(asset, 'bladeHubDiameter', 0.35, shaftDiameter * 1.05))
  const bladeToothCount = Math.max(8, Math.min(64, Math.round(numberParam(asset, 'bladeToothCount', 36, 8))))
  const showBladeTeeth = enabledParam(asset, 'showBladeTeeth', true)
  const showBladeGuard = enabledParam(asset, 'showBladeGuard', false)

  const drivenPulleyDiameter = numberParam(asset, 'drivenPulleyDiameter', 0.8, 0.25)
  const drivenPulleyWidth = numberParam(asset, 'drivenPulleyWidth', 0.2, 0.05)
  const drivenPulleyGrooves = Math.max(0, Math.min(6, Math.round(numberParam(asset, 'drivenPulleyGrooves', 2, 0))))
  const motorPulleyDiameter = numberParam(asset, 'motorPulleyDiameter', 0.35, 0.12)
  const beltWidth = numberParam(asset, 'beltWidth', 0.08, 0.02)
  const showBelts = enabledParam(asset, 'showBelts', true)
  const showBeltGuard = enabledParam(asset, 'showBeltGuard', true)

  const motorLength = numberParam(asset, 'motorLength', 1.4, 0.5)
  const motorDiameter = numberParam(asset, 'motorDiameter', 0.65, 0.25)
  const motorHeight = numberParam(asset, 'motorHeight', 1.6, 0.8)
  const motorOffsetX = finiteParam(asset, 'motorOffsetX', -0.35)
  const motorOffsetZ = finiteParam(asset, 'motorOffsetZ', 0.2)

  const beamWidth = Math.max(0.14, width * 0.09)
  const crossThickness = Math.max(0.16, length * 0.06)
  const chassisCenterY = wheelRadius * 1.02 + chassisHeight * 0.38
  const chassisTop = chassisCenterY + chassisHeight / 2
  const platformThickness = Math.max(0.1, chassisHeight * 0.24)
  const platformTop = chassisTop + platformThickness
  const bearingBeamHeight = Math.max(0.18, chassisHeight * 0.55)
  const bearingBaseY = Math.max(chassisTop, shaftHeight - shaftDiameter * 2.2)
  const bearingX = Math.min(width * 0.34, shaftLength * 0.27)
  const bearingWidth = Math.max(0.3, shaftDiameter * 2.3)
  const bearingDepth = Math.max(0.34, shaftDiameter * 2.7)

  const bladeX = shaftLength / 2 + bladeThickness / 2
  const drivenPulleyX = -shaftLength / 2 - drivenPulleyWidth / 2
  const pulleyWidth = Math.max(0.08, beltWidth * 1.4)
  const motorCenterY = Math.max(platformTop + motorDiameter * 0.48, motorHeight - motorDiameter * 0.5)
  const motorPulleyX = motorOffsetX - motorLength * 0.48 - pulleyWidth / 2
  const bladeRadius = bladeDiameter / 2
  const toothLength = Math.max(0.045, bladeDiameter * 0.055)
  const toothWidth = Math.max(0.035, bladeDiameter * 0.035)

  const drivenCenter = new THREE.Vector3(drivenPulleyX, shaftHeight, shaftFrontOffset)
  const motorCenter = new THREE.Vector3(motorPulleyX, motorCenterY, motorOffsetZ)
  const centerDeltaY = motorCenter.y - drivenCenter.y
  const centerDeltaZ = motorCenter.z - drivenCenter.z
  const centerDistance = Math.max(0.001, Math.hypot(centerDeltaY, centerDeltaZ))
  const perpendicularY = -centerDeltaZ / centerDistance
  const perpendicularZ = centerDeltaY / centerDistance
  const drivenRadius = drivenPulleyDiameter / 2
  const motorRadius = motorPulleyDiameter / 2
  const beltStarts = [-1, 1].map((side) => new THREE.Vector3(
    drivenCenter.x,
    drivenCenter.y + side * perpendicularY * drivenRadius,
    drivenCenter.z + side * perpendicularZ * drivenRadius,
  ))
  const beltEnds = [-1, 1].map((side) => new THREE.Vector3(
    motorCenter.x,
    motorCenter.y + side * perpendicularY * motorRadius,
    motorCenter.z + side * perpendicularZ * motorRadius,
  ))

  return (
    <group name="BundleSawGroup" position={[0, -asset.size.height / 2, 0]}>
      <group name="chassisGroup">
        {[-1, 1].map((side) => (
          <mesh key={side} name={side < 0 ? 'longitudinalBeamLeft' : 'longitudinalBeamRight'} position={[side * width * 0.34, chassisCenterY, 0]} castShadow receiveShadow>
            <boxGeometry args={[beamWidth, chassisHeight, length]} />
            <meshStandardMaterial color={color} roughness={0.78} metalness={0.16} />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <mesh key={side} name={side < 0 ? 'crossBeamRear' : 'crossBeamFront'} position={[0, chassisCenterY, side * length * 0.4]} castShadow receiveShadow>
            <boxGeometry args={[width * 0.78, chassisHeight, crossThickness]} />
            <meshStandardMaterial color={color} roughness={0.78} metalness={0.16} />
          </mesh>
        ))}
        <mesh name="upperPlatform" position={[0, chassisTop + platformThickness / 2, -length * 0.08]} castShadow receiveShadow>
          <boxGeometry args={[width * 0.82, platformThickness, length * 0.58]} />
          <meshStandardMaterial color="#687782" roughness={0.76} metalness={0.2} />
        </mesh>
        <mesh name="frontBearingBeam" position={[0, bearingBaseY - bearingBeamHeight / 2, shaftFrontOffset]} castShadow receiveShadow>
          <boxGeometry args={[width * 0.88, bearingBeamHeight, bearingDepth * 1.25]} />
          <meshStandardMaterial color="#414a51" roughness={0.82} metalness={0.2} />
        </mesh>
      </group>

      <group name="wheelsGroup">
        {[-1, 1].flatMap((xSide) => [-1, 1].map((zSide) => (
          <mesh
            key={`${xSide}-${zSide}`}
            name={`wheel${zSide > 0 ? 'F' : 'R'}${xSide > 0 ? 'R' : 'L'}`}
            position={[xSide * trackWidth / 2, wheelRadius, zSide * wheelbase / 2]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[wheelRadius, wheelRadius, wheelWidth, 24]} />
            <meshStandardMaterial color="#252b30" roughness={0.9} metalness={0.18} />
          </mesh>
        )))}
      </group>

      <group name="frontShaftGroup">
        <mesh name="shaft" position={[0, shaftHeight, shaftFrontOffset]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[shaftDiameter / 2, shaftDiameter / 2, shaftLength, 24]} />
          <meshStandardMaterial color="#aeb7bd" roughness={0.38} metalness={0.68} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side} name={side < 0 ? 'bearingHousingLeft' : 'bearingHousingRight'} position={[side * bearingX, 0, shaftFrontOffset]}>
            <mesh name="bearingBase" position={[0, bearingBaseY + 0.06, 0]} castShadow receiveShadow>
              <boxGeometry args={[bearingWidth * 1.2, 0.12, bearingDepth * 1.2]} />
              <meshStandardMaterial color="#4b5563" roughness={0.82} metalness={0.18} />
            </mesh>
            <mesh name="bearingBody" position={[0, (bearingBaseY + shaftHeight) / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[bearingWidth, Math.max(0.2, shaftHeight - bearingBaseY), bearingDepth]} />
              <meshStandardMaterial color="#59636c" roughness={0.72} metalness={0.24} />
            </mesh>
            <mesh name="bearingSeat" position={[0, shaftHeight, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[shaftDiameter * 0.95, shaftDiameter * 0.95, bearingWidth * 1.06, 20]} />
              <meshStandardMaterial color="#3b434a" roughness={0.68} metalness={0.32} />
            </mesh>
          </group>
        ))}

        <mesh name="blade" position={[bladeX, shaftHeight, shaftFrontOffset]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[bladeRadius, bladeRadius, bladeThickness, 48]} />
          <meshStandardMaterial color="#cbd2d8" roughness={0.34} metalness={0.76} side={THREE.DoubleSide} />
        </mesh>
        <mesh name="bladeHub" position={[bladeX + bladeThickness * 0.55, shaftHeight, shaftFrontOffset]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[bladeHubDiameter / 2, bladeHubDiameter / 2, bladeThickness * 2.1, 28]} />
          <meshStandardMaterial color="#59636c" roughness={0.48} metalness={0.52} />
        </mesh>
        {showBladeTeeth && Array.from({ length: bladeToothCount }, (_, index) => {
          const angle = index * Math.PI * 2 / bladeToothCount
          const radius = bladeRadius + toothLength * 0.34
          return (
            <mesh
              key={index}
              name={`bladeTooth${index + 1}`}
              position={[bladeX, shaftHeight + Math.cos(angle) * radius, shaftFrontOffset + Math.sin(angle) * radius]}
              rotation={[angle, 0, 0]}
              castShadow
            >
              <boxGeometry args={[bladeThickness * 1.08, toothLength, toothWidth]} />
              <meshStandardMaterial color="#b8c0c7" roughness={0.38} metalness={0.7} />
            </mesh>
          )
        })}
        {showBladeGuard && (
          <mesh name="bladeGuard" position={[bladeX, shaftHeight, shaftFrontOffset]} rotation={[0, Math.PI / 2, 0]} castShadow>
            <torusGeometry args={[bladeRadius * 0.92, Math.max(0.055, bladeThickness * 1.1), 8, 32, Math.PI]} />
            <meshStandardMaterial color="#d97706" roughness={0.72} metalness={0.12} />
          </mesh>
        )}

        <mesh name="drivenPulley" position={[drivenPulleyX, shaftHeight, shaftFrontOffset]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[drivenPulleyDiameter / 2, drivenPulleyDiameter / 2, drivenPulleyWidth, 32]} />
          <meshStandardMaterial color="#374151" roughness={0.68} metalness={0.32} />
        </mesh>
        <mesh name="drivenPulleyHub" position={[drivenPulleyX - drivenPulleyWidth * 0.52, shaftHeight, shaftFrontOffset]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[shaftDiameter * 0.82, shaftDiameter * 0.82, drivenPulleyWidth * 1.35, 24]} />
          <meshStandardMaterial color="#737f88" roughness={0.48} metalness={0.5} />
        </mesh>
        {Array.from({ length: drivenPulleyGrooves }, (_, index) => (
          <mesh key={index} name={`drivenPulleyGroove${index + 1}`} position={[drivenPulleyX + (index - (drivenPulleyGrooves - 1) / 2) * drivenPulleyWidth * 0.25, shaftHeight, shaftFrontOffset]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[drivenPulleyDiameter * 0.48, Math.max(0.012, drivenPulleyWidth * 0.035), 6, 24]} />
            <meshStandardMaterial color="#1f2428" roughness={0.9} metalness={0.12} />
          </mesh>
        ))}
      </group>

      <group name="motorGroup">
        <group name="motor" position={[motorOffsetX, motorCenterY, motorOffsetZ]}>
          <ElectricMotorModel length={motorLength} diameter={motorDiameter} color="#287c8e" />
        </group>
        <mesh name="motorOutputShaft" position={[(motorOffsetX - motorLength * 0.48 + motorPulleyX) / 2, motorCenterY, motorOffsetZ]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[shaftDiameter * 0.34, shaftDiameter * 0.34, Math.abs(motorOffsetX - motorLength * 0.48 - motorPulleyX) + pulleyWidth, 16]} />
          <meshStandardMaterial color="#aeb7bd" roughness={0.38} metalness={0.68} />
        </mesh>
        <mesh name="motorPulley" position={motorCenter} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[motorPulleyDiameter / 2, motorPulleyDiameter / 2, pulleyWidth, 24]} />
          <meshStandardMaterial color="#374151" roughness={0.68} metalness={0.32} />
        </mesh>
      </group>

      <group name="transmissionGroup">
        {showBelts && (
          <group name="belts">
            <BeltSpan start={beltStarts[0]} end={beltEnds[0]} radius={beltWidth / 2} />
            <BeltSpan start={beltStarts[1]} end={beltEnds[1]} radius={beltWidth / 2} />
          </group>
        )}
        {showBeltGuard && (
          <mesh
            name="beltGuard"
            position={[(drivenCenter.x + motorCenter.x) / 2, (drivenCenter.y + motorCenter.y) / 2, (drivenCenter.z + motorCenter.z) / 2]}
            castShadow
          >
            <boxGeometry args={[
              Math.abs(drivenCenter.x - motorCenter.x) + Math.max(drivenPulleyWidth, pulleyWidth) + 0.16,
              Math.abs(drivenCenter.y - motorCenter.y) + Math.max(drivenPulleyDiameter, motorPulleyDiameter) + 0.18,
              Math.abs(drivenCenter.z - motorCenter.z) + Math.max(drivenPulleyDiameter, motorPulleyDiameter) + 0.18,
            ]} />
            <meshStandardMaterial color="#4b5563" roughness={0.78} metalness={0.16} transparent opacity={0.28} depthWrite={false} />
          </mesh>
        )}
      </group>
    </group>
  )
}

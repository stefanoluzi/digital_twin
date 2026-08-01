import type { IndustrialAsset, IndustrialParamKey } from '../../types/plant'

interface Props {
  asset: IndustrialAsset
  color: string
}

const numberParam = (asset: IndustrialAsset, key: IndustrialParamKey, fallback: number) => {
  const value = asset.params[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function LanceCarrierCart({ asset, color }: Props) {
  const bodyLength = numberParam(asset, 'bodyLength', 3.2)
  const bodyDiameter = numberParam(asset, 'bodyDiameter', 1.4)
  const bodyEndCapLength = numberParam(asset, 'bodyEndCapLength', 0.15)
  const frontNeckLength = numberParam(asset, 'frontNeckLength', 0.35)
  const frontNeckDiameter = numberParam(asset, 'frontNeckDiameter', 0.55)
  const chassisLength = numberParam(asset, 'chassisLength', 3.5)
  const chassisWidth = numberParam(asset, 'chassisWidth', 1.6)
  const wheelRadius = numberParam(asset, 'wheelRadius', 0.35)
  const wheelWidth = numberParam(asset, 'wheelWidth', 0.2)
  const wheelbase = Math.min(chassisLength * 0.82, numberParam(asset, 'wheelbase', 2.3))
  const trackWidth = numberParam(asset, 'trackWidth', 1.45)
  const showLance = numberParam(asset, 'showLance', 1) > 0
  const lanceLength = numberParam(asset, 'lanceLength', 5)
  const lanceDiameter = numberParam(asset, 'lanceDiameter', 0.2)
  const lanceOffsetY = numberParam(asset, 'lanceOffsetY', 0)
  const showTowBar = numberParam(asset, 'showTowBar', 0) > 0

  // Convencion del editor: avance longitudinal sobre +X y ejes de rueda sobre Z.
  const beamHeight = Math.max(0.14, bodyDiameter * 0.12)
  const beamWidth = Math.max(0.12, chassisWidth * 0.1)
  const crossThickness = Math.max(0.12, chassisLength * 0.045)
  const chassisCenterY = wheelRadius * 1.02
  const chassisTop = chassisCenterY + beamHeight / 2
  const saddleHeight = Math.max(0.1, bodyDiameter * 0.08)
  const bodyCenterY = chassisTop + saddleHeight + bodyDiameter / 2
  const saddleWidth = Math.min(chassisWidth * 0.72, bodyDiameter * 0.72)
  const saddleLength = Math.max(0.18, bodyLength * 0.1)
  const bodyFrontX = bodyLength / 2
  const frontCapCenterX = bodyFrontX + bodyEndCapLength / 2
  const rearCapCenterX = -bodyLength / 2 - bodyEndCapLength / 2
  const neckCenterX = bodyFrontX + bodyEndCapLength + frontNeckLength / 2
  const neckEndX = bodyFrontX + bodyEndCapLength + frontNeckLength
  const lanceCenterY = bodyCenterY + lanceOffsetY
  const flangeLength = 0.1
  const flangeCenterX = neckEndX + flangeLength / 2
  const lanceStartX = neckEndX + flangeLength
  const lanceCenterX = lanceStartX + lanceLength / 2
  const rearTowStartX = -chassisLength / 2 + 0.08
  const rearTowEndX = -chassisLength / 2 - 0.9
  const rearTowStartZ = chassisWidth * 0.3
  const towBarLength = Math.hypot(rearTowStartX - rearTowEndX, rearTowStartZ)
  const towAngle = Math.atan2(rearTowStartZ, rearTowStartX - rearTowEndX)

  const frameMaterial = <meshStandardMaterial color="#414a51" roughness={0.8} metalness={0.26} />
  const bodyMaterial = <meshStandardMaterial color={color} roughness={0.58} metalness={0.34} />
  const endMaterial = <meshStandardMaterial color="#69747c" roughness={0.55} metalness={0.42} />
  const darkMetal = <meshStandardMaterial color="#252b30" roughness={0.84} metalness={0.24} />
  const lanceMaterial = <meshStandardMaterial color="#aeb7bd" roughness={0.3} metalness={0.75} />

  return (
    <group name="LanceCarrierCartGroup" position={[0, -asset.size.height / 2, 0]}>
      <group name="chassisGroup">
        {[-1, 1].map((side) => (
          <mesh key={`longitudinal-${side}`} name={side < 0 ? 'longitudinalBeamLeft' : 'longitudinalBeamRight'} position={[0, chassisCenterY, side * chassisWidth * 0.3]} castShadow receiveShadow>
            <boxGeometry args={[chassisLength, beamHeight, beamWidth]} />
            {frameMaterial}
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <mesh key={`cross-${side}`} name={side < 0 ? 'crossBeamRear' : 'crossBeamFront'} position={[side * chassisLength * 0.42, chassisCenterY, 0]} castShadow receiveShadow>
            <boxGeometry args={[crossThickness, beamHeight, chassisWidth * 0.72]} />
            {frameMaterial}
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <mesh key={`saddle-${side}`} name={side < 0 ? 'bodySupportRear' : 'bodySupportFront'} position={[side * bodyLength * 0.27, chassisTop + saddleHeight / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[saddleLength, saddleHeight, saddleWidth]} />
            {endMaterial}
          </mesh>
        ))}
      </group>

      <group name="bodyGroup">
        <mesh name="mainHorizontalCylinder" position={[0, bodyCenterY, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[bodyDiameter / 2, bodyDiameter / 2, bodyLength, 32]} />
          {bodyMaterial}
        </mesh>
        <mesh name="rearEndCap" position={[rearCapCenterX, bodyCenterY, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[bodyDiameter * 0.53, bodyDiameter * 0.53, bodyEndCapLength, 32]} />
          {endMaterial}
        </mesh>
        <mesh name="frontEndCap" position={[frontCapCenterX, bodyCenterY, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[bodyDiameter * 0.53, bodyDiameter * 0.53, bodyEndCapLength, 32]} />
          {endMaterial}
        </mesh>
        <mesh name="frontNeck" position={[neckCenterX, bodyCenterY, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[frontNeckDiameter / 2, frontNeckDiameter / 2, frontNeckLength, 24]} />
          {endMaterial}
        </mesh>
      </group>

      <group name="wheelsGroup">
        {[-1, 1].flatMap((xSign) => [-1, 1].map((zSign) => (
          <mesh
            key={`wheel-${xSign}-${zSign}`}
            name={`wheel${xSign > 0 ? 'F' : 'R'}${zSign > 0 ? 'L' : 'R'}`}
            position={[xSign * wheelbase / 2, wheelRadius, zSign * trackWidth / 2]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[wheelRadius, wheelRadius, wheelWidth, 24]} />
            {darkMetal}
          </mesh>
        )))}
      </group>

      {showLance && (
        <group name="lanceGroup">
          <mesh name="lanceSupportFlange" position={[flangeCenterX, lanceCenterY, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[frontNeckDiameter * 0.62, frontNeckDiameter * 0.62, flangeLength, 24]} />
            {endMaterial}
          </mesh>
          <mesh name="lanceCylinder" position={[lanceCenterX, lanceCenterY, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[lanceDiameter / 2, lanceDiameter / 2, lanceLength, 24]} />
            {lanceMaterial}
          </mesh>
        </group>
      )}

      {showTowBar && (
        <group name="towBarGroup">
          {[-1, 1].map((side) => (
            <mesh
              key={`tow-${side}`}
              position={[(rearTowStartX + rearTowEndX) / 2, chassisCenterY, side * rearTowStartZ / 2]}
              rotation={[0, -side * towAngle, 0]}
              castShadow
            >
              <boxGeometry args={[towBarLength, 0.1, 0.1]} />
              {frameMaterial}
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

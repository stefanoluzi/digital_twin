import type { IndustrialAsset, IndustrialParamKey } from '../../types/plant'

interface Props {
  asset: IndustrialAsset
  color: string
}

const numberParam = (asset: IndustrialAsset, key: IndustrialParamKey, fallback: number) => {
  const value = asset.params[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const stringParam = (asset: IndustrialAsset, key: IndustrialParamKey, fallback: string) => {
  const value = asset.params[key]
  return typeof value === 'string' ? value : fallback
}

export function RectangularPool({ asset, color }: Props) {
  const length = numberParam(asset, 'length', 6)
  const width = numberParam(asset, 'width', 3)
  const height = numberParam(asset, 'height', 1.5)
  const wallThickness = Math.min(numberParam(asset, 'wallThickness', 0.15), Math.min(length, width) / 2 - 0.01)
  const bottomThickness = Math.min(numberParam(asset, 'bottomThickness', 0.2), height - 0.01)
  const innerLength = Math.max(0.02, length - wallThickness * 2)
  const innerWidth = Math.max(0.02, width - wallThickness * 2)
  const innerHeight = Math.max(0.01, height - bottomThickness)
  const showLiquid = numberParam(asset, 'showLiquid', 1) > 0
  const liquidLevel = Math.min(1, Math.max(0, numberParam(asset, 'liquidLevel', 0.75)))
  const liquidOpacity = Math.min(1, Math.max(0, numberParam(asset, 'liquidOpacity', 0.45)))
  const liquidColor = stringParam(asset, 'liquidColor', '#4aa3df')
  const showTopRim = numberParam(asset, 'showTopRim', 1) > 0
  const rimWidth = numberParam(asset, 'rimWidth', 0.1)
  const rimHeight = numberParam(asset, 'rimHeight', 0.08)
  const showExternalRibs = numberParam(asset, 'showExternalRibs', 0) > 0
  const ribCount = Math.max(1, Math.round(numberParam(asset, 'ribCountLongSides', 5)))
  const ribThickness = numberParam(asset, 'ribThickness', 0.08)
  const supportType = stringParam(asset, 'supportType', 'floor')
  const supportHeight = supportType === 'floor' ? 0 : numberParam(asset, 'supportHeight', 0.35)
  const showDrain = numberParam(asset, 'showDrain', 0) > 0
  const drainDiameter = numberParam(asset, 'drainDiameter', 0.18)
  const drainSide = stringParam(asset, 'drainSide', 'right')
  const manualBodyColor = stringParam(asset, 'bodyColor', asset.color)
  const bodyColor = color === asset.color ? manualBodyColor : color
  const interiorColor = stringParam(asset, 'interiorColor', bodyColor)
  const baseY = supportHeight
  const wallY = baseY + height / 2
  const rimY = baseY + height + rimHeight / 2
  const drainLength = Math.max(0.18, wallThickness * 2.2)
  const drainY = baseY + bottomThickness + drainDiameter * 0.65

  const bodyMaterial = <meshStandardMaterial color={bodyColor} roughness={0.78} metalness={0.07} />
  const interiorMaterial = <meshStandardMaterial color={interiorColor} roughness={0.82} metalness={0.04} />

  return (
    <group name="RectangularPoolGroup" position={[0, -asset.size.height / 2, 0]}>
      <mesh name="bottomPlate" position={[0, baseY + bottomThickness / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, bottomThickness, width]} />
        {interiorMaterial}
      </mesh>
      <mesh name="leftWall" position={[0, wallY, -width / 2 + wallThickness / 2]} castShadow receiveShadow>
        <boxGeometry args={[length, height, wallThickness]} />
        {bodyMaterial}
      </mesh>
      <mesh name="rightWall" position={[0, wallY, width / 2 - wallThickness / 2]} castShadow receiveShadow>
        <boxGeometry args={[length, height, wallThickness]} />
        {bodyMaterial}
      </mesh>
      <mesh name="frontWall" position={[length / 2 - wallThickness / 2, wallY, 0]} castShadow receiveShadow>
        <boxGeometry args={[wallThickness, height, innerWidth]} />
        {bodyMaterial}
      </mesh>
      <mesh name="rearWall" position={[-length / 2 + wallThickness / 2, wallY, 0]} castShadow receiveShadow>
        <boxGeometry args={[wallThickness, height, innerWidth]} />
        {bodyMaterial}
      </mesh>

      {showLiquid && (
        <mesh
          name="liquidSurface"
          position={[0, baseY + bottomThickness + innerHeight * liquidLevel - 0.003, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <planeGeometry args={[Math.max(0.01, innerLength - 0.02), Math.max(0.01, innerWidth - 0.02)]} />
          <meshStandardMaterial color={liquidColor} transparent opacity={liquidOpacity} roughness={0.25} metalness={0} depthWrite={false} />
        </mesh>
      )}

      {showTopRim && (
        <group name="topRim">
          {[-1, 1].map((side) => (
            <mesh key={`rim-long-${side}`} position={[0, rimY, side * width / 2]}>
              <boxGeometry args={[length + rimWidth * 2, rimHeight, wallThickness + rimWidth * 2]} />
              {bodyMaterial}
            </mesh>
          ))}
          {[-1, 1].map((side) => (
            <mesh key={`rim-short-${side}`} position={[side * length / 2, rimY, 0]}>
              <boxGeometry args={[wallThickness + rimWidth * 2, rimHeight, innerWidth]} />
              {bodyMaterial}
            </mesh>
          ))}
        </group>
      )}

      {showExternalRibs && (
        <group name="externalRibs">
          {Array.from({ length: ribCount }, (_, index) => {
            const x = ribCount === 1 ? 0 : -innerLength / 2 + index * innerLength / (ribCount - 1)
            return [-1, 1].map((side) => (
              <mesh key={`${index}-${side}`} position={[x, baseY + height * 0.48, side * (width / 2 + ribThickness / 2)]}>
                <boxGeometry args={[ribThickness, height * 0.78, ribThickness]} />
                {bodyMaterial}
              </mesh>
            ))
          })}
        </group>
      )}

      {supportType === 'legs' && (
        <group name="supports">
          {[-1, 1].flatMap((xSide) => [-1, 1].map((zSide) => (
            <mesh key={`${xSide}-${zSide}`} position={[xSide * length * 0.4, supportHeight / 2, zSide * width * 0.36]} castShadow>
              <boxGeometry args={[0.28, supportHeight, 0.28]} />
              {bodyMaterial}
            </mesh>
          )))}
        </group>
      )}
      {supportType === 'skid' && (
        <group name="supports">
          {[-1, 1].map((side) => (
            <mesh key={side} position={[0, supportHeight / 2, side * width * 0.34]} castShadow>
              <boxGeometry args={[length * 0.9, supportHeight, 0.22]} />
              {bodyMaterial}
            </mesh>
          ))}
        </group>
      )}

      {showDrain && (
        <mesh
          name="drain"
          position={drainSide === 'left'
            ? [0, drainY, -width / 2 - drainLength / 2]
            : drainSide === 'right'
              ? [0, drainY, width / 2 + drainLength / 2]
              : drainSide === 'front'
                ? [length / 2 + drainLength / 2, drainY, 0]
                : [-length / 2 - drainLength / 2, drainY, 0]}
          rotation={(drainSide === 'left' || drainSide === 'right') ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[drainDiameter / 2, drainDiameter / 2, drainLength, 20]} />
          {bodyMaterial}
        </mesh>
      )}
    </group>
  )
}

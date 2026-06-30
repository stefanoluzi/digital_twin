export function positions(count: number, spacing: number) {
  const start = -((count - 1) * spacing) / 2
  return Array.from({ length: count }, (_, index) => start + index * spacing)
}

export function commonShaftLength(count: number, spacing: number, extraEndLength: number) {
  return Math.max(extraEndLength, (count - 1) * spacing + extraEndLength)
}

export function TransferBase({
  shaftDiameter,
  shaftLength,
  supportHeight,
  baseDepth,
  color,
}: {
  shaftDiameter: number
  shaftLength: number
  supportHeight: number
  baseDepth: number
  color: string
}) {
  const supportCount = Math.max(2, Math.min(6, Math.ceil(shaftLength / 2) + 1))
  const supportStep = supportCount > 1 ? shaftLength / (supportCount - 1) : 0
  const supportStart = -shaftLength / 2
  const baseY = -supportHeight - shaftDiameter * 0.55

  return (
    <group name="commonShaftGroup">
      <mesh position={[0, baseY, 0]}>
        <boxGeometry args={[shaftLength * 1.08, shaftDiameter * 0.55, baseDepth]} />
        <meshStandardMaterial color="#4b5563" roughness={0.82} metalness={0.06} />
      </mesh>
      {Array.from({ length: supportCount }, (_, index) => supportStart + index * supportStep).map((x, index) => (
        <group key={index} position={[x, -supportHeight * 0.5, 0]}>
          <mesh>
            <boxGeometry args={[shaftDiameter * 1.45, supportHeight * 0.9, shaftDiameter * 1.8]} />
            <meshStandardMaterial color={color} roughness={0.82} metalness={0.05} />
          </mesh>
          <mesh position={[0, supportHeight * 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[shaftDiameter * 0.72, shaftDiameter * 0.72, shaftDiameter * 1.52, 18]} />
            <meshStandardMaterial color="#374151" roughness={0.7} metalness={0.12} />
          </mesh>
        </group>
      ))}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[shaftDiameter / 2, shaftDiameter / 2, shaftLength, 24]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.48} metalness={0.28} />
      </mesh>
    </group>
  )
}

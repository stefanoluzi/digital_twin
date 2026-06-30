import type { IndustrialAsset, IndustrialParamValue } from '../types/plant'

interface Props {
  asset: IndustrialAsset
  color: string
}

const positive = (value: IndustrialParamValue | undefined, fallback: number, min = 0.05) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback

export function ChainBed({ asset, color }: Props) {
  const length = positive(asset.params.length, asset.size.width, 1)
  const height = asset.size.height
  const depth = positive(asset.params.width, asset.size.depth, 0.5)
  const rows = Math.max(1, Math.min(10, Math.round(Number(asset.params.chainCount ?? 2))))
  const chainWidth = positive(asset.params.chainWidth, 0.24, 0.08)
  const chainHeight = positive(asset.params.chainHeight, 0.12, 0.04)
  const supportSpacing = positive(asset.params.supportSpacing, 1.3, 0.25)
  const showSupports = Number(asset.params.showSupports ?? 1) > 0
  const linkPitch = 0.36
  const linkCount = Math.max(10, Math.floor(length / linkPitch))
  const frameColor = color
  const chainColor = '#2f3b45'
  const pinColor = '#9aa4ad'
  const railColor = '#566573'
  const sideZ = depth / 2 - 0.12
  const deckY = -height * 0.34
  const chainY = height * 0.18
  const crossMemberCount = Math.max(2, Math.floor(length / supportSpacing) + 1)

  return (
    <group>
      <mesh position={[0, deckY, 0]}>
        <boxGeometry args={[length, height * 0.2, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.82} metalness={0.04} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={`side-${side}`} position={[0, height * 0.02, side * sideZ]}>
          <boxGeometry args={[length, 0.16, 0.16]} />
          <meshStandardMaterial color={railColor} roughness={0.76} metalness={0.08} />
        </mesh>
      ))}
      {showSupports && Array.from({ length: crossMemberCount }, (_, index) => {
        const x = -length / 2 + (index + 0.5) * (length / crossMemberCount)
        return (
          <mesh key={`cross-${index}`} position={[x, -height * 0.08, 0]}>
            <boxGeometry args={[0.12, 0.14, depth * 0.86]} />
            <meshStandardMaterial color={railColor} roughness={0.78} metalness={0.06} />
          </mesh>
        )
      })}
      {Array.from({ length: rows }, (_, row) => {
        const z = rows === 1 ? 0 : -depth / 2 + chainWidth + (row * (depth - chainWidth * 2)) / (rows - 1)
        return (
          <group key={`row-${row}`}>
            {[-1, 1].map((end) => (
              <mesh key={`sprocket-${row}-${end}`} position={[end * (length / 2 - 0.18), chainY, z]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.18, 0.18, chainWidth * 1.45, 20]} />
                <meshStandardMaterial color="#6b7782" roughness={0.62} metalness={0.22} />
              </mesh>
            ))}
            <mesh position={[0, chainY - 0.035, z]}>
              <boxGeometry args={[length * 0.92, chainHeight * 0.36, chainWidth * 1.25]} />
              <meshStandardMaterial color="#1f2931" roughness={0.86} metalness={0.08} />
            </mesh>
            {Array.from({ length: linkCount }, (_, index) => {
              const x = -length / 2 + (index + 0.5) * (length / linkCount)
              const alternate = index % 2 === 0
              return (
                <group key={`link-${row}-${index}`} position={[x, chainY, z]}>
                  <mesh position={[0, 0.025, -chainWidth / 2]}>
                    <boxGeometry args={[alternate ? 0.24 : 0.16, chainHeight * 0.68, 0.045]} />
                    <meshStandardMaterial color={chainColor} roughness={0.68} metalness={0.2} />
                  </mesh>
                  <mesh position={[0, 0.025, chainWidth / 2]}>
                    <boxGeometry args={[alternate ? 0.24 : 0.16, chainHeight * 0.68, 0.045]} />
                    <meshStandardMaterial color={chainColor} roughness={0.68} metalness={0.2} />
                  </mesh>
                  <mesh position={[-0.085, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.025, 0.025, chainWidth * 1.18, 10]} />
                    <meshStandardMaterial color={pinColor} roughness={0.48} metalness={0.35} />
                  </mesh>
                  <mesh position={[0.085, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.025, 0.025, chainWidth * 1.18, 10]} />
                    <meshStandardMaterial color={pinColor} roughness={0.48} metalness={0.35} />
                  </mesh>
                </group>
              )
            })}
            <mesh position={[0, chainY + 0.085, z - chainWidth * 0.72]}>
              <boxGeometry args={[length * 0.9, 0.04, 0.045]} />
              <meshStandardMaterial color="#74808a" roughness={0.65} metalness={0.12} />
            </mesh>
            <mesh position={[0, chainY + 0.085, z + chainWidth * 0.72]}>
              <boxGeometry args={[length * 0.9, 0.04, 0.045]} />
              <meshStandardMaterial color="#74808a" roughness={0.65} metalness={0.12} />
            </mesh>
          </group>
        )
      })}
      {[-1, 1].map((end) => (
        <mesh key={`end-guard-${end}`} position={[end * (length / 2 - 0.08), height * 0.04, 0]}>
          <boxGeometry args={[0.12, height * 0.42, depth * 0.9]} />
          <meshStandardMaterial color={frameColor} roughness={0.82} metalness={0.04} />
        </mesh>
      ))}
      {[-1, 1].flatMap((xSide) => [-1, 1].map((zSide) => {
        const key = `${xSide}:${zSide}`
        return (
          <mesh key={key} position={[xSide * (length / 2 - 0.22), -height * 0.56, zSide * (depth / 2 - 0.18)]}>
            <boxGeometry args={[0.16, height * 0.45, 0.16]} />
            <meshStandardMaterial color={frameColor} roughness={0.84} metalness={0.03} />
          </mesh>
        )
      }))}
    </group>
  )
}

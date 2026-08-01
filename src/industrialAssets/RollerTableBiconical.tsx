import type { IndustrialAsset } from '../types/plant'
import { RollerTableBearingSystem, rollerSupportOffset } from './RollerTableBearingSystem'

interface Props {
  asset: IndustrialAsset
  color: string
}

export function RollerTableBiconical({ asset, color }: Props) {
  const length = asset.size.width
  const spacing = Number(asset.params.rollerSpacing ?? 0.8)
  const diameter = Number(asset.params.rollerDiameter ?? 0.38)
  // The roller axis follows local Z; rollerWidth is its full axial length.
  const rollerWidth = Number(asset.params.rollerWidth ?? 1.2)
  const count = Math.max(2, Math.round(Number(asset.params.rollerCount ?? Math.floor(length / spacing) + 1)))
  const shaftExtension = Number(asset.params.shaftExtension ?? 0.12)
  const railZ = rollerSupportOffset(rollerWidth, shaftExtension)
  const rollerCenterY = asset.size.height * 0.1
  const railHeight = asset.size.height * 0.28
  const railY = -asset.size.height * 0.28
  const railTopY = railY + railHeight / 2
  const supportHeight = asset.size.height * 0.44
  const supportY = -asset.size.height / 2 + supportHeight / 2
  const coneLength = rollerWidth * 0.45
  const centerSectionLength = rollerWidth * 0.1
  const coneCenterOffset = centerSectionLength / 2 + coneLength / 2

  return (
    <group>
      <mesh position={[0, railY, railZ]}>
        <boxGeometry args={[length, railHeight, 0.16]} />
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.05} />
      </mesh>
      <mesh position={[0, railY, -railZ]}>
        <boxGeometry args={[length, railHeight, 0.16]} />
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.05} />
      </mesh>
      {Array.from({ length: count }, (_, index) => {
        const x = count === 1 ? 0 : -length / 2 + (index * length) / (count - 1)
        return (
          <group key={index} position={[x, rollerCenterY, 0]}>
            <mesh position={[0, 0, -coneCenterOffset]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[diameter * 0.26, diameter * 0.5, coneLength, 20]} />
              <meshStandardMaterial color="#9ca3aa" roughness={0.62} metalness={0.12} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[diameter * 0.26, diameter * 0.26, centerSectionLength, 20]} />
              <meshStandardMaterial color="#8f979e" roughness={0.66} metalness={0.1} />
            </mesh>
            <mesh position={[0, 0, coneCenterOffset]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[diameter * 0.5, diameter * 0.26, coneLength, 20]} />
              <meshStandardMaterial color="#9ca3aa" roughness={0.62} metalness={0.12} />
            </mesh>
          </group>
        )
      })}
      <RollerTableBearingSystem
        count={count}
        tableLength={length}
        rollerWidth={rollerWidth}
        rollerCenterY={rollerCenterY}
        railTopY={railTopY}
        showBearingHousings={Number(asset.params.showBearingHousings ?? 1) > 0}
        housingWidth={Number(asset.params.housingWidth ?? 0.38)}
        housingLength={Number(asset.params.housingLength ?? 0.48)}
        housingHeight={Number(asset.params.housingHeight ?? 0.58)}
        housingBaseThickness={Number(asset.params.housingBaseThickness ?? 0.08)}
        shaftDiameter={Number(asset.params.shaftDiameter ?? diameter * 0.25)}
        shaftExtension={shaftExtension}
        housingCapHeight={Number(asset.params.housingCapHeight ?? 0.1)}
        housingColor={String(asset.params.housingColor ?? '#4b5563')}
      />
      {[-1, 1].flatMap((side) => [-1, 1].map((end) => (
        <mesh key={`${side}-${end}`} position={[end * length * 0.43, supportY, side * railZ]}>
          <boxGeometry args={[0.22, supportHeight, 0.22]} />
          <meshStandardMaterial color={color} roughness={0.82} metalness={0.04} />
        </mesh>
      )))}
    </group>
  )
}

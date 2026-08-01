import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

export const rollerSupportOffset = (rollerWidth: number, shaftExtension: number) => rollerWidth / 2 + shaftExtension / 2

interface Props {
  count: number
  tableLength: number
  rollerWidth: number
  rollerCenterY: number
  railTopY: number
  showBearingHousings: boolean
  housingWidth: number
  housingLength: number
  housingHeight: number
  housingBaseThickness: number
  shaftDiameter: number
  shaftExtension: number
  housingCapHeight: number
  housingColor: string
}

export function RollerTableBearingSystem({
  count,
  tableLength,
  rollerWidth,
  rollerCenterY,
  railTopY,
  showBearingHousings,
  housingWidth,
  housingLength,
  housingHeight,
  housingBaseThickness,
  shaftDiameter,
  shaftExtension,
  housingCapHeight,
  housingColor,
}: Props) {
  const safeWidth = Math.max(0.12, housingWidth)
  const safeLength = Math.max(0.12, housingLength)
  const safeBase = Math.max(0.025, housingBaseThickness)
  const safeCap = Math.min(Math.max(0.025, housingCapHeight), Math.max(0.05, housingHeight * 0.35))
  const bodyHeight = Math.max(0.12, housingHeight - safeCap)
  const safeShaftDiameter = Math.max(0.04, shaftDiameter)
  const safeShaftExtension = Math.max(0.04, shaftExtension)
  const supportZ = rollerSupportOffset(rollerWidth, safeShaftExtension)
  const baseTopY = railTopY + safeBase
  const bossRadius = Math.max(safeShaftDiameter * 0.92, Math.min(safeWidth, housingHeight) * 0.25)

  const geometries = useMemo(() => ({
    shaft: new THREE.CylinderGeometry(safeShaftDiameter / 2, safeShaftDiameter / 2, safeShaftExtension, 16),
    base: new THREE.BoxGeometry(safeWidth * 1.38, safeBase, safeLength * 1.18),
    body: new THREE.BoxGeometry(safeWidth, bodyHeight, safeLength),
    boss: new THREE.CylinderGeometry(bossRadius, bossRadius, safeLength * 1.06, 20),
    cap: new THREE.BoxGeometry(safeWidth * 1.08, safeCap, safeLength * 1.04),
  }), [bodyHeight, bossRadius, safeBase, safeCap, safeLength, safeShaftDiameter, safeShaftExtension, safeWidth])
  const materials = useMemo(() => ({
    shaft: new THREE.MeshStandardMaterial({ color: '#aab2b9', roughness: 0.42, metalness: 0.3 }),
    housing: new THREE.MeshStandardMaterial({ color: housingColor, roughness: 0.76, metalness: 0.08 }),
    boss: new THREE.MeshStandardMaterial({ color: '#303841', roughness: 0.58, metalness: 0.16 }),
  }), [housingColor])

  useEffect(() => () => {
    Object.values(geometries).forEach((geometry) => geometry.dispose())
    Object.values(materials).forEach((material) => material.dispose())
  }, [geometries, materials])

  return Array.from({ length: count }, (_, index) => {
    const x = count === 1 ? 0 : -tableLength / 2 + (index * tableLength) / (count - 1)
    return (
      <group key={`bearing-set-${index}`} position-x={x}>
        {[-1, 1].map((side) => (
          <group key={side} position-z={side * supportZ}>
            <mesh geometry={geometries.shaft} material={materials.shaft} position-y={rollerCenterY} rotation-x={Math.PI / 2} />
            {showBearingHousings && <>
              <mesh geometry={geometries.base} material={materials.housing} position-y={railTopY + safeBase / 2} />
              <mesh geometry={geometries.body} material={materials.housing} position-y={baseTopY + bodyHeight / 2} />
              <mesh geometry={geometries.boss} material={materials.boss} position-y={rollerCenterY} rotation-x={Math.PI / 2} />
              <mesh geometry={geometries.cap} material={materials.housing} position-y={baseTopY + bodyHeight + safeCap / 2} />
            </>}
          </group>
        ))}
      </group>
    )
  })
}

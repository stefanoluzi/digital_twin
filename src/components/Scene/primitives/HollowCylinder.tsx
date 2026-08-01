import { useEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import type { IndustrialAsset } from '../../../types/plant'

interface Props {
  asset: IndustrialAsset
  material: ReactNode
}

export const MIN_HOLLOW_CYLINDER_WALL_THICKNESS = 0.01

export function createAnnulusShape(outerRadius: number, innerRadius: number) {
  const shape = new THREE.Shape()
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false)
  if (innerRadius > 0) {
    const hole = new THREE.Path()
    hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true)
    shape.holes.push(hole)
  }
  return shape
}

export function HollowCylinder({ asset, material }: Props) {
  const outerDiameter = Number(asset.params.outerDiameter ?? 1)
  const innerDiameter = Number(asset.params.innerDiameter ?? 0.5)
  const length = Number(asset.params.length ?? 1.5)
  const radialSegments = Math.max(8, Math.min(128, Math.round(Number(asset.params.radialSegments ?? 32))))

  const geometry = useMemo(() => {
    const safeOuter = Math.max(0.02, outerDiameter)
    const safeInner = Math.max(0, Math.min(innerDiameter, safeOuter - MIN_HOLLOW_CYLINDER_WALL_THICKNESS * 2))
    const next = new THREE.ExtrudeGeometry(createAnnulusShape(safeOuter / 2, safeInner / 2), {
      depth: Math.max(0.01, length),
      steps: 1,
      bevelEnabled: false,
      curveSegments: radialSegments,
    })
    next.translate(0, 0, -Math.max(0.01, length) / 2)
    next.computeVertexNormals()
    return next
  }, [innerDiameter, length, outerDiameter, radialSegments])

  useEffect(() => () => geometry.dispose(), [geometry])

  return <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>{material}</mesh>
}

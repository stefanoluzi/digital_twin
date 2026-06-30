import { useMemo } from 'react'
import * as THREE from 'three'
import type { IndustrialAsset, IndustrialParamValue } from '../../types/plant'
import { commonShaftLength, positions, TransferBase } from './TransferBase'

interface Props {
  asset: IndustrialAsset
  color: string
}

const numberParam = (value: IndustrialParamValue | undefined, fallback: number, min = 0.05) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback
const countParam = (value: IndustrialParamValue | undefined, fallback: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(numberParam(value, fallback, min))))

function ExtrudedSilhouette({
  points,
  thickness,
  color,
  metalness = 0.08,
}: {
  points: Array<[number, number]>
  thickness: number
  color: string
  metalness?: number
}) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    points.forEach(([z, y], index) => {
      if (index === 0) shape.moveTo(z, y)
      else shape.lineTo(z, y)
    })
    shape.closePath()

    const nextGeometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
      curveSegments: 1,
    })
    nextGeometry.translate(0, 0, -thickness / 2)
    nextGeometry.computeVertexNormals()
    return nextGeometry
  }, [points, thickness])

  return (
    <mesh geometry={geometry} rotation={[0, Math.PI / 2, 0]}>
      <meshStandardMaterial color={color} roughness={0.78} metalness={metalness} side={THREE.DoubleSide} />
    </mesh>
  )
}

function TransferClawUnit({
  height,
  clawLength,
  clawOpening,
  shaftDiameter,
  pivotAngle,
  color,
}: {
  height: number
  clawLength: number
  clawOpening: number
  shaftDiameter: number
  pivotAngle: number
  color: string
}) {
  const opening = Math.max(0.2, Math.min(1.1, clawOpening))
  const unitThickness = shaftDiameter * 3.45
  const supportThickness = shaftDiameter * 1.45
  const topPlateWidth = clawLength * 0.34
  const hookReach = clawLength * (1 + opening * 0.22)

  const topPlatePoints: Array<[number, number]> = [
    [-topPlateWidth * 0.55, height * 0.84],
    [-topPlateWidth * 0.42, height * 0.94],
    [-topPlateWidth * 0.08, height],
    [topPlateWidth * 0.42, height * 0.96],
    [topPlateWidth * 0.58, height * 0.86],
    [topPlateWidth * 0.22, height * 0.8],
    [-topPlateWidth * 0.18, height * 0.8],
  ]

  const clawPoints: Array<[number, number]> = [
    [-clawLength * 0.36, height * 0.72],
    [-clawLength * 0.1, height * 0.78],
    [hookReach * 0.16, height * 0.74],
    [hookReach * 0.38, height * 0.64],
    [hookReach * 0.6, height * 0.5],
    [hookReach * 0.82, height * 0.34],
    [hookReach, height * 0.18],
    [hookReach * 1.04, height * 0.09],
    [hookReach * 0.92, height * 0.04],
    [hookReach * 0.68, height * 0.03],
    [hookReach * 0.46, height * 0.1],
    [hookReach * 0.35, height * 0.22],
    [hookReach * 0.46, height * 0.32],
    [hookReach * 0.66, height * 0.4],
    [hookReach * 0.78, height * 0.5],
    [hookReach * 0.62, height * 0.56],
    [hookReach * 0.36, height * 0.62],
    [clawLength * 0.02, height * 0.64],
    [-clawLength * 0.26, height * 0.62],
  ]

  return (
    <group name="pivotGroup" rotation={[pivotAngle, 0, 0]}>
      <mesh position={[0, height * 0.38, -clawLength * 0.24]}>
        <boxGeometry args={[supportThickness, height * 0.76, supportThickness]} />
        <meshStandardMaterial color={color} roughness={0.82} metalness={0.05} />
      </mesh>
      <ExtrudedSilhouette points={topPlatePoints} thickness={unitThickness} color="#4b5563" />
      <ExtrudedSilhouette points={clawPoints} thickness={unitThickness} color="#687782" metalness={0.1} />
      <mesh position={[0, 0, -clawLength * 0.22]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[shaftDiameter * 0.92, shaftDiameter * 0.92, unitThickness * 1.08, 20]} />
        <meshStandardMaterial color="#374151" roughness={0.7} metalness={0.14} />
      </mesh>
    </group>
  )
}

export function TransferClaw({ asset, color }: Props) {
  const count = countParam(asset.params.count, 1, 1, 24)
  const spacing = numberParam(asset.params.spacing, 1.8, 0.2)
  const height = numberParam(asset.params.height, 1.45, 0.6)
  const clawLength = numberParam(asset.params.clawLength, 1.35, 0.4)
  const clawOpening = numberParam(asset.params.clawOpening, 0.65, 0.15)
  const shaftDiameter = numberParam(asset.params.shaftDiameter, 0.18, 0.06)
  const endMargin = numberParam(asset.params.shaftLength, Math.max(0.9, clawLength * 0.75), 0.4)
  const shaftLength = commonShaftLength(count, spacing, endMargin)
  const supportHeight = numberParam(asset.params.supportHeight, 0.28, 0.12)
  const pivotAngle = numberParam(asset.params.pivotAngle, 0, 0)
  const unitPositions = positions(count, spacing)

  return (
    <group>
      <TransferBase shaftDiameter={shaftDiameter} shaftLength={shaftLength} supportHeight={supportHeight} baseDepth={clawLength * 1.08} color="#4b5563" />
      <group name="unitsGroup">
        {unitPositions.map((x, index) => (
          <group key={index} name={`unit_${index + 1}`} position={[x, 0, 0]}>
            <TransferClawUnit height={height} clawLength={clawLength} clawOpening={clawOpening} shaftDiameter={shaftDiameter} pivotAngle={pivotAngle} color={color} />
          </group>
        ))}
        </group>
    </group>
  )
}

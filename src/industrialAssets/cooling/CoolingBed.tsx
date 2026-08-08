import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { IndustrialAsset, IndustrialParamKey } from '../../types/plant'
import { createHelicalScrewGeometry, type HelixDetailLevel, type HelixDirection } from './createHelicalScrewGeometry'

interface Props {
  asset: IndustrialAsset
  color: string
}

export const MAX_SCREW_COUNT = 60

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

const colorParam = (asset: IndustrialAsset, key: IndustrialParamKey, fallback: string) => {
  const value = asset.params[key]
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}

export function CoolingBed({ asset, color }: Props) {
  const length = numberParam(asset, 'length', 25, 4)
  const configuredWidth = numberParam(asset, 'width', 16, 2)
  const frameHeight = numberParam(asset, 'frameHeight', 1.2, 0.35)
  const screwCount = Math.max(2, Math.min(MAX_SCREW_COUNT, Math.round(numberParam(asset, 'screwCount', 16, 2))))
  const screwSpacing = numberParam(asset, 'screwSpacing', 1, 0.25)
  const screwLength = numberParam(asset, 'screwLength', 24, 2)
  const shaftDiameter = numberParam(asset, 'shaftDiameter', 0.16, 0.05)
  const helixOuterDiameter = Math.max(shaftDiameter * 1.3, numberParam(asset, 'helixOuterDiameter', 0.42, 0.12))
  const helixPitch = numberParam(asset, 'helixPitch', 0.3, 0.1)
  const helixThickness = Math.min(helixOuterDiameter * 0.28, numberParam(asset, 'helixThickness', 0.05, 0.015))
  const helixDirection = ['right', 'left', 'alternating'].includes(String(asset.params.helixDirection)) ? String(asset.params.helixDirection) : 'right'
  const detailLevel: HelixDetailLevel = asset.params.detailLevel === 'medium' ? 'medium' : 'low'
  const screwRotation = finiteParam(asset, 'screwRotation', 0)

  const housingWidth = numberParam(asset, 'housingWidth', 0.35, 0.15)
  const housingHeight = numberParam(asset, 'housingHeight', 0.5, 0.2)
  const supportBeamWidth = numberParam(asset, 'supportBeamWidth', 0.3, 0.12)
  const showDriveUnits = enabledParam(asset, 'showDriveUnits', true)
  const driveMode = ['individual', 'grouped', 'hidden'].includes(String(asset.params.driveMode)) ? String(asset.params.driveMode) : 'grouped'
  const driveGroupSize = Math.max(1, Math.min(20, Math.round(numberParam(asset, 'driveGroupSize', 4, 1))))
  const motorScale = numberParam(asset, 'motorScale', 0.7, 0.2)

  const showReferenceTubes = enabledParam(asset, 'showReferenceTubes', false)
  const referenceTubeCount = Math.max(1, Math.min(8, Math.round(numberParam(asset, 'referenceTubeCount', 2, 1))))
  const tubeLength = numberParam(asset, 'tubeLength', 12, 1)
  const tubeDiameter = numberParam(asset, 'tubeDiameter', 0.3, 0.08)
  const tubeSpacing = numberParam(asset, 'tubeSpacing', 2, 0.3)
  const tubeProgress = Math.min(1, Math.max(0, finiteParam(asset, 'tubeProgress', 0.5)))
  const showWalkways = enabledParam(asset, 'showWalkways', true)
  const walkwayEveryNRows = Math.max(1, Math.min(20, Math.round(numberParam(asset, 'walkwayEveryNRows', 4, 1))))

  const bodyColor = colorParam(asset, 'bodyColor', color)
  const screwColor = colorParam(asset, 'screwColor', '#aeb7bd')
  const rowSpan = (screwCount - 1) * screwSpacing
  const actualWidth = Math.max(configuredWidth, rowSpan + helixOuterDiameter + supportBeamWidth * 2)
  const actualDepth = Math.max(length, screwLength + housingWidth * 2)
  const shaftY = frameHeight
  const frameBeamHeight = Math.max(0.18, frameHeight * 0.22)
  const crossBeamCount = Math.max(3, Math.min(10, Math.ceil(actualDepth / 4)))
  const driveEnabled = showDriveUnits && driveMode !== 'hidden'

  const shaftGeometry = useMemo(
    () => new THREE.CylinderGeometry(shaftDiameter / 2, shaftDiameter / 2, screwLength, detailLevel === 'medium' ? 18 : 12),
    [detailLevel, shaftDiameter, screwLength],
  )
  const housingGeometry = useMemo(
    () => new THREE.BoxGeometry(housingWidth, housingHeight, housingWidth),
    [housingHeight, housingWidth],
  )
  const helixRightGeometry = useMemo(() => createHelicalScrewGeometry({
    length: screwLength,
    outerDiameter: helixOuterDiameter,
    shaftDiameter,
    pitch: helixPitch,
    thickness: helixThickness,
    detailLevel,
    direction: 'right',
  }), [detailLevel, helixOuterDiameter, helixPitch, helixThickness, shaftDiameter, screwLength])
  const helixLeftGeometry = useMemo(() => createHelicalScrewGeometry({
    length: screwLength,
    outerDiameter: helixOuterDiameter,
    shaftDiameter,
    pitch: helixPitch,
    thickness: helixThickness,
    detailLevel,
    direction: 'left',
  }), [detailLevel, helixOuterDiameter, helixPitch, helixThickness, shaftDiameter, screwLength])

  const frameMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.78, metalness: 0.16 }), [bodyColor])
  const screwMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: screwColor, roughness: 0.38, metalness: 0.64 }), [screwColor])
  const housingMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#414a51', roughness: 0.74, metalness: 0.24 }), [])
  const driveMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#287c8e', roughness: 0.68, metalness: 0.12 }), [])
  const tubeMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8f989f', roughness: 0.45, metalness: 0.58 }), [])

  useEffect(() => () => {
    shaftGeometry.dispose()
    housingGeometry.dispose()
    helixRightGeometry.dispose()
    helixLeftGeometry.dispose()
    frameMaterial.dispose()
    screwMaterial.dispose()
    housingMaterial.dispose()
    driveMaterial.dispose()
    tubeMaterial.dispose()
  }, [driveMaterial, frameMaterial, helixLeftGeometry, helixRightGeometry, housingGeometry, housingMaterial, screwMaterial, shaftGeometry, tubeMaterial])

  const screwRows = useMemo(() => Array.from({ length: screwCount }, (_, index) => ({
    index,
    x: (index - (screwCount - 1) / 2) * screwSpacing,
  })), [screwCount, screwSpacing])
  const walkwayRows = useMemo(
    () => screwRows.filter(({ index }) => (index + 1) % walkwayEveryNRows === 0 && index < screwCount - 1),
    [screwCount, screwRows, walkwayEveryNRows],
  )
  const driveRows = useMemo(() => {
    if (!driveEnabled) return []
    if (driveMode === 'individual') return screwRows.map(({ x }) => x)
    return Array.from({ length: Math.ceil(screwCount / driveGroupSize) }, (_, groupIndex) => {
      const start = groupIndex * driveGroupSize
      const end = Math.min(screwCount, start + driveGroupSize)
      return (screwRows[start].x + screwRows[end - 1].x) / 2
    })
  }, [driveEnabled, driveGroupSize, driveMode, screwCount, screwRows])
  const referenceTubeX = (tubeProgress - 0.5) * Math.max(0, actualWidth - tubeLength)
  const referenceTubeY = shaftY + helixOuterDiameter / 2 + tubeDiameter / 2

  const geometryForRow = (index: number) => {
    const direction: HelixDirection = helixDirection === 'alternating'
      ? (index % 2 === 0 ? 'right' : 'left')
      : helixDirection as HelixDirection
    return direction === 'left' ? helixLeftGeometry : helixRightGeometry
  }

  return (
    <group name="CoolingBedGroup" position={[0, -asset.size.height / 2, 0]} dispose={null}>
      <group name="frameGroup">
        <group name="sideBeams">
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * (actualWidth / 2 - supportBeamWidth / 2), shaftY - frameBeamHeight * 0.8, 0]} material={frameMaterial} castShadow receiveShadow>
              <boxGeometry args={[supportBeamWidth, frameBeamHeight, actualDepth]} />
            </mesh>
          ))}
        </group>
        <group name="crossBeams">
          {Array.from({ length: crossBeamCount }, (_, index) => {
            const z = crossBeamCount === 1 ? 0 : -actualDepth / 2 + supportBeamWidth + index * (actualDepth - supportBeamWidth * 2) / (crossBeamCount - 1)
            return (
              <mesh key={index} position={[0, shaftY - frameBeamHeight * 1.15, z]} material={frameMaterial} castShadow receiveShadow>
                <boxGeometry args={[actualWidth, frameBeamHeight, supportBeamWidth]} />
              </mesh>
            )
          })}
        </group>
        <group name="supports">
          {[-1, 1].flatMap((xSide) => [-1, 0, 1].map((zStep) => {
            const legHeight = Math.max(0.18, shaftY - frameBeamHeight * 1.25)
            return (
              <mesh key={`${xSide}-${zStep}`} position={[xSide * (actualWidth / 2 - supportBeamWidth), legHeight / 2, zStep * actualDepth * 0.42]} material={frameMaterial} castShadow receiveShadow>
                <boxGeometry args={[supportBeamWidth * 1.25, legHeight, supportBeamWidth * 1.25]} />
              </mesh>
            )
          }))}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[0, shaftY - housingHeight * 0.55, side * (screwLength / 2 + housingWidth * 0.15)]} material={housingMaterial} castShadow receiveShadow>
              <boxGeometry args={[actualWidth, Math.max(0.16, housingHeight * 0.3), supportBeamWidth]} />
            </mesh>
          ))}
        </group>
        {showWalkways && (
          <group name="walkways">
            {walkwayRows.map(({ index, x }) => (
              <mesh key={index} position={[x + screwSpacing / 2, shaftY - helixOuterDiameter * 0.62, 0]} material={housingMaterial} receiveShadow>
                <boxGeometry args={[Math.min(screwSpacing * 0.42, 0.42), 0.06, screwLength * 0.88]} />
              </mesh>
            ))}
          </group>
        )}
      </group>

      <group name="screwsGroup">
        {screwRows.map(({ index, x }) => (
          <group key={index} name={`screwUnit_${String(index + 1).padStart(2, '0')}`} position={[x, 0, 0]}>
            <group name="screwPivotGroup" position={[0, shaftY, 0]} rotation={[0, 0, screwRotation]}>
              <mesh name="centralShaft" geometry={shaftGeometry} material={screwMaterial} rotation={[Math.PI / 2, 0, 0]} castShadow />
              <mesh name="helix" geometry={geometryForRow(index)} material={screwMaterial} castShadow />
            </group>
            <mesh name="frontHousing" position={[0, shaftY - housingHeight * 0.12, screwLength / 2 + housingWidth / 2]} geometry={housingGeometry} material={housingMaterial} castShadow receiveShadow />
            <mesh name="rearHousing" position={[0, shaftY - housingHeight * 0.12, -screwLength / 2 - housingWidth / 2]} geometry={housingGeometry} material={housingMaterial} castShadow receiveShadow />
            {[-1, 1].map((side) => (
              <mesh key={side} name={side < 0 ? 'rearJournal' : 'frontJournal'} position={[0, shaftY, side * (screwLength / 2 + housingWidth * 0.52)]} rotation={[Math.PI / 2, 0, 0]} material={screwMaterial} castShadow>
                <cylinderGeometry args={[shaftDiameter * 0.42, shaftDiameter * 0.42, housingWidth * 1.15, 10]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {driveEnabled && (
        <group name="driveGroup">
          {driveRows.map((x, index) => {
            const driveZ = -screwLength / 2 - housingWidth - motorScale * 0.48
            return (
              <group key={index} name={`driveUnit_${index + 1}`} position={[x, 0, driveZ]}>
                <mesh name="gearbox" position={[0, shaftY, motorScale * 0.3]} material={housingMaterial} castShadow>
                  <boxGeometry args={[motorScale * 0.62, motorScale * 0.7, motorScale * 0.62]} />
                </mesh>
                <mesh name="motor" position={[0, shaftY + motorScale * 0.05, -motorScale * 0.34]} rotation={[Math.PI / 2, 0, 0]} material={driveMaterial} castShadow>
                  <cylinderGeometry args={[motorScale * 0.3, motorScale * 0.3, motorScale * 0.88, 16]} />
                </mesh>
                <mesh name="coupling" position={[0, shaftY, motorScale * 0.68]} rotation={[Math.PI / 2, 0, 0]} material={screwMaterial} castShadow>
                  <cylinderGeometry args={[shaftDiameter * 0.72, shaftDiameter * 0.72, motorScale * 0.42, 12]} />
                </mesh>
              </group>
            )
          })}
        </group>
      )}

      {showReferenceTubes && (
        <group name="referenceTubesGroup">
          {Array.from({ length: referenceTubeCount }, (_, index) => {
            const z = (index - (referenceTubeCount - 1) / 2) * tubeSpacing
            return (
              <mesh key={index} name={`referenceTube_${index + 1}`} position={[referenceTubeX, referenceTubeY, z]} rotation={[0, 0, Math.PI / 2]} material={tubeMaterial} castShadow>
                <cylinderGeometry args={[tubeDiameter / 2, tubeDiameter / 2, tubeLength, 20]} />
              </mesh>
            )
          })}
        </group>
      )}
    </group>
  )
}

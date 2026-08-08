import { useMemo } from 'react'
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Preparacion PLC:
 * - sawHeadPosition (0-1 o 0-100 %) debe mapearse directamente a headPosition.
 * - bladeRunning queda persistido para una futura rotacion de la hoja, sin animacion por defecto.
 */
export function LinsingerVerticalSaw({ asset, color }: Props) {
  const width = numberParam(asset, 'width', 4, 1.8)
  const depth = numberParam(asset, 'depth', 2.5, 1)
  const totalHeight = numberParam(asset, 'totalHeight', 5.5, 2.5)
  const columnWidth = Math.min(width * 0.28, numberParam(asset, 'columnWidth', 0.55, 0.2))
  const columnDepth = Math.min(depth * 0.7, numberParam(asset, 'columnDepth', 0.65, 0.25))
  const topBeamHeight = Math.min(totalHeight * 0.25, numberParam(asset, 'topBeamHeight', 0.65, 0.25))

  const headWidth = Math.min(width - columnWidth * 1.25, numberParam(asset, 'headWidth', 2.5, 0.8))
  const headHeight = numberParam(asset, 'headHeight', 1.2, 0.5)
  const headDepth = Math.min(depth * 1.1, numberParam(asset, 'headDepth', 1.2, 0.5))
  const headPosition = clamp(finiteParam(asset, 'headPosition', 0.15), 0, 1)
  const requestedStroke = numberParam(asset, 'verticalStroke', 2.4, 0.1)
  const requestedMinHeight = numberParam(asset, 'headMinHeight', 1.8, 0.6)
  const requestedMaxHeight = numberParam(asset, 'headMaxHeight', 4.2, requestedMinHeight + 0.1)

  const bladeDiameter = numberParam(asset, 'bladeDiameter', 1.8, 0.4)
  const bladeThickness = numberParam(asset, 'bladeThickness', 0.08, 0.02)
  const bladeHubDiameter = Math.min(bladeDiameter * 0.68, numberParam(asset, 'bladeHubDiameter', 0.35, 0.1))
  const bladeToothCount = Math.max(8, Math.min(64, Math.round(numberParam(asset, 'bladeToothCount', 40, 8))))
  const showBladeTeeth = enabledParam(asset, 'showBladeTeeth', true)
  const showBladeGuard = enabledParam(asset, 'showBladeGuard', true)

  const motorLength = numberParam(asset, 'motorLength', 1.4, 0.5)
  const motorDiameter = numberParam(asset, 'motorDiameter', 0.65, 0.25)
  const motorOffsetX = finiteParam(asset, 'motorOffsetX', 0.55)
  const motorOffsetY = finiteParam(asset, 'motorOffsetY', 0.45)
  const motorOffsetZ = finiteParam(asset, 'motorOffsetZ', -0.55)

  const showBillet = enabledParam(asset, 'showBillet', true)
  const billetDiameter = numberParam(asset, 'billetDiameter', 0.65, 0.15)
  const billetLength = numberParam(asset, 'billetLength', 6, 1)
  const billetHeight = numberParam(asset, 'billetHeight', 1, billetDiameter / 2)
  const showBilletSupports = enabledParam(asset, 'showBilletSupports', true)
  const supportSpacing = Math.min(billetLength * 0.82, numberParam(asset, 'supportSpacing', 3, 0.5))
  const supportHeight = numberParam(asset, 'supportHeight', 0.75, 0.2)
  const showClamps = enabledParam(asset, 'showClamps', true)

  const driveType = String(asset.params.verticalDriveType ?? 'hydraulicCylinder')
  const cylinderDiameter = numberParam(asset, 'cylinderDiameter', 0.3, 0.1)
  const cylinderStroke = numberParam(asset, 'cylinderStroke', 2.4, 0.2)

  const baseHeight = Math.max(0.24, totalHeight * 0.055)
  const baseRailWidth = Math.max(0.32, width * 0.14)
  const baseCrossDepth = Math.max(0.28, depth * 0.16)
  const frameTop = totalHeight - topBeamHeight
  const safeMinHeight = Math.max(baseHeight + bladeDiameter * 0.42, requestedMinHeight)
  const safeMaxHeight = Math.max(safeMinHeight, Math.min(frameTop - headHeight * 0.46, requestedMaxHeight))
  const effectiveStroke = Math.min(requestedStroke, safeMaxHeight - safeMinHeight)
  const headY = clamp(safeMaxHeight - headPosition * effectiveStroke, safeMinHeight, safeMaxHeight)
  const columnHeight = frameTop - baseHeight
  const columnY = baseHeight + columnHeight / 2
  const columnX = width / 2 - columnWidth / 2
  const guideX = Math.min(columnX - columnWidth * 0.62, headWidth * 0.52)
  const guideWidth = Math.max(0.09, columnWidth * 0.2)
  const guideDepth = Math.max(0.1, columnDepth * 0.22)

  const bladeRadius = bladeDiameter / 2
  const bladeLocalY = -headHeight * 0.16
  const bladeZ = headDepth * 0.2
  const toothLength = Math.max(0.045, bladeDiameter * 0.052)
  const toothWidth = Math.max(0.035, bladeDiameter * 0.03)
  const toothAngles = useMemo(
    () => Array.from({ length: bladeToothCount }, (_, index) => index * Math.PI * 2 / bladeToothCount),
    [bladeToothCount],
  )

  const driveX = -width * 0.34
  const driveZ = -columnDepth * 0.24
  const cylinderBodyLength = Math.min(cylinderStroke * 0.42, Math.max(0.5, frameTop - safeMaxHeight))
  const cylinderBodyTop = frameTop - 0.08
  const cylinderBodyBottom = cylinderBodyTop - cylinderBodyLength
  const rodEndY = headY + headHeight * 0.34
  const rodLength = Math.max(0.08, cylinderBodyBottom - rodEndY)

  return (
    <group name="LinsingerVerticalSawGroup" position={[0, -asset.size.height / 2, 0]}>
      <group name="baseGroup">
        <group name="basePlate">
          {[-1, 1].map((side) => (
            <mesh key={side} name={side < 0 ? 'baseRailLeft' : 'baseRailRight'} position={[side * (width / 2 - baseRailWidth / 2), baseHeight / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[baseRailWidth, baseHeight, depth]} />
              <meshStandardMaterial color="#414a51" roughness={0.82} metalness={0.2} />
            </mesh>
          ))}
          {[-1, 1].map((side) => (
            <mesh key={side} name={side < 0 ? 'baseCrossRear' : 'baseCrossFront'} position={[0, baseHeight / 2, side * (depth / 2 - baseCrossDepth / 2)]} castShadow receiveShadow>
              <boxGeometry args={[width, baseHeight, baseCrossDepth]} />
              <meshStandardMaterial color="#4b5563" roughness={0.82} metalness={0.18} />
            </mesh>
          ))}
        </group>

        <group name="columns">
          {[-1, 1].map((side) => (
            <mesh key={side} name={side < 0 ? 'columnLeft' : 'columnRight'} position={[side * columnX, columnY, 0]} castShadow receiveShadow>
              <boxGeometry args={[columnWidth, columnHeight, columnDepth]} />
              <meshStandardMaterial color={color} roughness={0.78} metalness={0.16} />
            </mesh>
          ))}
        </group>
        <mesh name="topBeam" position={[0, totalHeight - topBeamHeight / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, topBeamHeight, Math.max(columnDepth, depth * 0.42)]} />
          <meshStandardMaterial color={color} roughness={0.78} metalness={0.16} />
        </mesh>

        <group name="verticalGuides">
          {[-1, 1].map((side) => (
            <mesh key={side} name={side < 0 ? 'guideLeft' : 'guideRight'} position={[side * guideX, baseHeight + columnHeight * 0.53, columnDepth * 0.54]} castShadow>
              <boxGeometry args={[guideWidth, columnHeight * 0.84, guideDepth]} />
              <meshStandardMaterial color="#c0c8ce" roughness={0.38} metalness={0.62} />
            </mesh>
          ))}
        </group>

        {showBilletSupports && (
          <group name="billetSupports">
            {[-1, 1].map((zSide) => (
              <group key={zSide} name={zSide < 0 ? 'supportRear' : 'supportFront'} position={[0, supportHeight, zSide * supportSpacing / 2]}>
                {[-1, 1].map((xSide) => (
                  <mesh key={xSide} position={[xSide * billetDiameter * 0.36, 0, 0]} rotation={[0, 0, xSide * Math.PI / 4]} castShadow>
                    <boxGeometry args={[Math.max(0.38, billetDiameter * 0.82), 0.14, 0.28]} />
                    <meshStandardMaterial color="#687782" roughness={0.8} metalness={0.16} />
                  </mesh>
                ))}
                <mesh position={[0, -supportHeight * 0.46, 0]} castShadow>
                  <boxGeometry args={[0.32, supportHeight * 0.82, 0.32]} />
                  <meshStandardMaterial color="#4b5563" roughness={0.82} metalness={0.18} />
                </mesh>
              </group>
            ))}
          </group>
        )}

        {showClamps && (
          <group name="clamps">
            {[-1, 1].map((side) => (
              <group key={side} name={side < 0 ? 'clampLeft' : 'clampRight'} position={[side * (billetDiameter / 2 + 0.2), billetHeight, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[0.24, billetDiameter * 0.85, 0.42]} />
                  <meshStandardMaterial color="#d97706" roughness={0.72} metalness={0.16} />
                </mesh>
                <mesh position={[side * 0.13, -billetDiameter * 0.42, 0]} castShadow>
                  <boxGeometry args={[0.5, 0.16, 0.5]} />
                  <meshStandardMaterial color="#59636c" roughness={0.78} metalness={0.18} />
                </mesh>
              </group>
            ))}
          </group>
        )}
      </group>

      {driveType !== 'hidden' && (
        <group name="verticalDriveGroup">
          {driveType === 'hydraulicCylinder' ? (
            <>
              <mesh name="cylinderBody" position={[driveX, cylinderBodyBottom + cylinderBodyLength / 2, driveZ]} castShadow>
                <cylinderGeometry args={[cylinderDiameter / 2, cylinderDiameter / 2, cylinderBodyLength, 24]} />
                <meshStandardMaterial color="#374151" roughness={0.7} metalness={0.3} />
              </mesh>
              <mesh name="cylinderRod" position={[driveX, rodEndY + rodLength / 2, driveZ]} castShadow>
                <cylinderGeometry args={[cylinderDiameter * 0.27, cylinderDiameter * 0.27, rodLength, 20]} />
                <meshStandardMaterial color="#cbd2d8" roughness={0.3} metalness={0.74} />
              </mesh>
            </>
          ) : (
            <>
              <mesh name="verticalScrew" position={[driveX, (baseHeight + frameTop) / 2, driveZ]} castShadow>
                <cylinderGeometry args={[cylinderDiameter * 0.22, cylinderDiameter * 0.22, frameTop - baseHeight, 18]} />
                <meshStandardMaterial color="#aeb7bd" roughness={0.4} metalness={0.62} />
              </mesh>
              <mesh name="screwDrive" position={[driveX, frameTop - cylinderDiameter * 0.45, driveZ]} castShadow>
                <boxGeometry args={[cylinderDiameter * 1.8, cylinderDiameter * 0.9, cylinderDiameter * 1.8]} />
                <meshStandardMaterial color="#374151" roughness={0.72} metalness={0.24} />
              </mesh>
            </>
          )}
        </group>
      )}

      <group name="verticalHeadGroup" position={[0, headY, 0]}>
        <group name="headHousing">
          <mesh name="headHousingTop" position={[0, headHeight * 0.34, -headDepth * 0.22]} castShadow receiveShadow>
            <boxGeometry args={[headWidth, headHeight * 0.32, headDepth * 0.56]} />
            <meshStandardMaterial color="#59636c" roughness={0.76} metalness={0.2} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} name={side < 0 ? 'headHousingLeft' : 'headHousingRight'} position={[side * headWidth * 0.43, -headHeight * 0.08, -headDepth * 0.22]} castShadow receiveShadow>
              <boxGeometry args={[headWidth * 0.14, headHeight * 0.72, headDepth * 0.56]} />
              <meshStandardMaterial color="#59636c" roughness={0.76} metalness={0.2} />
            </mesh>
          ))}
        </group>
        {[-1, 1].map((side) => (
          <mesh key={side} name={side < 0 ? 'headGuideBlockLeft' : 'headGuideBlockRight'} position={[side * guideX, 0, columnDepth * 0.48]} castShadow>
            <boxGeometry args={[guideWidth * 3, headHeight * 0.68, guideDepth * 2.4]} />
            <meshStandardMaterial color="#414a51" roughness={0.72} metalness={0.28} />
          </mesh>
        ))}

        <group name="motor" position={[motorOffsetX, motorOffsetY, motorOffsetZ]} rotation={[0, Math.PI / 2, 0]}>
          <ElectricMotorModel length={motorLength} diameter={motorDiameter} color="#287c8e" />
        </group>
        <mesh name="shaft" position={[0, bladeLocalY, bladeZ - headDepth * 0.12]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[bladeHubDiameter * 0.22, bladeHubDiameter * 0.22, headDepth * 0.82, 22]} />
          <meshStandardMaterial color="#aeb7bd" roughness={0.34} metalness={0.7} />
        </mesh>
        <mesh name="blade" position={[0, bladeLocalY, bladeZ]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[bladeRadius, bladeRadius, bladeThickness, 48]} />
          <meshStandardMaterial color="#cbd2d8" roughness={0.32} metalness={0.76} side={THREE.DoubleSide} />
        </mesh>
        <mesh name="bladeHub" position={[0, bladeLocalY, bladeZ + bladeThickness * 0.72]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[bladeHubDiameter / 2, bladeHubDiameter / 2, bladeThickness * 2.4, 28]} />
          <meshStandardMaterial color="#59636c" roughness={0.48} metalness={0.52} />
        </mesh>
        {showBladeTeeth && toothAngles.map((angle, index) => {
          const radius = bladeRadius + toothLength * 0.3
          return (
            <mesh
              key={index}
              name={`bladeTooth${index + 1}`}
              position={[Math.cos(angle) * radius, bladeLocalY + Math.sin(angle) * radius, bladeZ]}
              rotation={[0, 0, angle - Math.PI / 2]}
              castShadow
            >
              <boxGeometry args={[toothLength, toothWidth, bladeThickness * 1.08]} />
              <meshStandardMaterial color="#b8c0c7" roughness={0.38} metalness={0.7} />
            </mesh>
          )
        })}
        {showBladeGuard && (
          <mesh name="bladeGuard" position={[0, bladeLocalY, bladeZ - bladeThickness * 1.3]} rotation={[0, 0, 0]} castShadow>
            <torusGeometry args={[bladeRadius * 0.93, Math.max(0.065, bladeThickness * 1.18), 8, 36, Math.PI * 1.12]} />
            <meshStandardMaterial color="#d97706" roughness={0.72} metalness={0.12} />
          </mesh>
        )}
      </group>

      {showBillet && (
        <group name="billetReferenceGroup">
          <mesh name="billet" position={[0, billetHeight, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[billetDiameter / 2, billetDiameter / 2, billetLength, 32]} />
            <meshStandardMaterial color="#8f989f" roughness={0.5} metalness={0.54} />
          </mesh>
        </group>
      )}
    </group>
  )
}

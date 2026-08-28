import { forwardRef, useCallback, useLayoutEffect, useRef } from 'react'
import { Edges, Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { Color } from 'three'
import { AREA_BY_CODE } from '../../config/areas'
import { getIndustrialAssetWorldTransform } from '../../services/sceneWorldTransformService'
import type { IndustrialAsset, ViewSettings } from '../../types/plant'
import { Bancal } from '../../industrialAssets/Bancal'
import { Cabinet } from '../../industrialAssets/Cabinet'
import { CardanShaft } from '../../industrialAssets/CardanShaft'
import { CenteringStars } from '../../industrialAssets/CenteringStars'
import { CentrifugalPumpHorizontal } from '../../industrialAssets/CentrifugalPumpHorizontal'
import { ChainBed } from '../../industrialAssets/ChainBed'
import { Column } from '../../industrialAssets/Column'
import { Coupling } from '../../industrialAssets/Coupling'
import { ElectricalPanel } from '../../industrialAssets/ElectricalPanel'
import { ElectricMotorHorizontal } from '../../industrialAssets/ElectricMotorHorizontal'
import { ElectricMotorVertical } from '../../industrialAssets/ElectricMotorVertical'
import { GearboxHorizontal } from '../../industrialAssets/GearboxHorizontal'
import { GearboxVertical } from '../../industrialAssets/GearboxVertical'
import { Handrail } from '../../industrialAssets/Handrail'
import { HydraulicPowerUnit } from '../../industrialAssets/HydraulicPowerUnit'
import { IndustrialFan } from '../../industrialAssets/IndustrialFan'
import { MotorGearboxParallel } from '../../industrialAssets/MotorGearboxParallel'
import { PiercerDrive } from '../../industrialAssets/PiercerDrive'
import { PiercerMachine } from '../../industrialAssets/process/PiercerMachine'
import { BundleSaw } from '../../industrialAssets/process/BundleSaw'
import { LinsingerVerticalSaw } from '../../industrialAssets/cutting/LinsingerVerticalSaw'
import { CoolingBed } from '../../industrialAssets/cooling/CoolingBed'
import { BilletTong } from '../../industrialAssets/furnace/BilletTong'
import { PipeRackSimple } from '../../industrialAssets/PipeRackSimple'
import { Platform } from '../../industrialAssets/Platform'
import { RailBedMulti } from '../../industrialAssets/RailBedMulti'
import { RollerTableBiconical } from '../../industrialAssets/RollerTableBiconical'
import { RollerTableFlat } from '../../industrialAssets/RollerTableFlat'
import { RollingStand } from '../../industrialAssets/RollingStand'
import { Steader3Roll } from '../../industrialAssets/Steader3Roll'
import { Stairs } from '../../industrialAssets/Stairs'
import { TankHorizontal } from '../../industrialAssets/TankHorizontal'
import { TankVertical } from '../../industrialAssets/TankVertical'
import { TransmissionShaft } from '../../industrialAssets/TransmissionShaft'
import { TransferClaw } from '../../industrialAssets/transfers/TransferClaw'
import { TransferStar } from '../../industrialAssets/transfers/TransferStar'
import { TransferV } from '../../industrialAssets/transfers/TransferV'
import { VerticalPump } from '../../industrialAssets/VerticalPump'
import { LanceCarrierCart } from '../../industrialAssets/transport/LanceCarrierCart'
import { RectangularPool } from '../../industrialAssets/infrastructure/RectangularPool'
import { HollowCylinder } from './primitives/HollowCylinder'
import { applyIndustrialPresentation } from '../../visualization/industrialMaterials'
import { getVisualTheme, type VisualPreset } from '../../visualization/visualTheme'

interface Props {
  asset: IndustrialAsset
  selected: boolean
  primary: boolean
  view: ViewSettings
  visualPreset: VisualPreset
  showLabel: boolean
  onHoverChange?: (hovered: boolean) => void
  onSelect: (event: ThreeEvent<MouseEvent>) => void
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void
  onPointerMove?: (event: ThreeEvent<PointerEvent>) => void
  onPointerUp?: (event: ThreeEvent<PointerEvent>) => void
  onContextMenu?: (event: ThreeEvent<MouseEvent>) => void
}

const criticalityColors: Record<string, string> = {
  A: '#ef4444',
  B: '#f97316',
  C: '#eab308',
  D: '#22c55e',
  none: '#9ca3af',
}

function displayColor(asset: IndustrialAsset, colorMode: ViewSettings['colorMode']) {
  if (colorMode === 'manual') return asset.color
  if (colorMode === 'area') return AREA_BY_CODE[asset.areaCode]?.color ?? AREA_BY_CODE.UNASSIGNED.color
  return criticalityColors[asset.criticality || 'none']
}

function Material({ asset, selected, view }: Pick<Props, 'asset' | 'selected' | 'view'>) {
  const color = displayColor(asset, view.colorMode)
  const emissive = new Color(color).multiplyScalar(selected ? 0.18 : 0.08)

  return (
    <meshStandardMaterial
      color={color}
      roughness={0.78}
      metalness={0.04}
      emissive={emissive}
      emissiveIntensity={1}
    />
  )
}

function AssetGeometry({ asset, selected, view }: Pick<Props, 'asset' | 'selected' | 'view'>) {
  const { width: w, height: h, depth: d } = asset.size
  const color = displayColor(asset, view.colorMode)
  const material = <Material asset={asset} selected={selected} view={view} />
  switch (asset.type) {
    case 'box':
    case 'long_box':
    case 'beam':
    case 'plate':
      return <mesh castShadow receiveShadow><boxGeometry args={[w, h, d]} />{material}</mesh>
    case 'cylinder':
      return <mesh castShadow receiveShadow><cylinderGeometry args={[w / 2, w / 2, h, 32]} />{material}</mesh>
    case 'hollow_cylinder':
      return <HollowCylinder asset={asset} material={material} />
    case 'pipe':
      return <group>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow><cylinderGeometry args={[h / 2, h / 2, w, 24]} />{material}</mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} scale={[1.01, 1.01, 1.01]}>
          <cylinderGeometry args={[h * 0.28, h * 0.28, w + 0.02, 24]} />
          <meshStandardMaterial color="#1b2228" roughness={0.9} metalness={0} />
        </mesh>
      </group>
    case 'roller_table_flat':
      return <RollerTableFlat asset={asset} color={color} />
    case 'roller_table_biconical':
      return <RollerTableBiconical asset={asset} color={color} />
    case 'bancal':
      return <Bancal asset={asset} color={color} />
    case 'rail_bed_multi':
      return <RailBedMulti asset={asset} color={color} />
    case 'lance_carrier_cart':
      return <LanceCarrierCart asset={asset} color={color} />
    case 'centering_stars':
      return <CenteringStars asset={asset} color={color} />
    case 'chain_bed':
      return <ChainBed asset={asset} color={color} />
    case 'rolling_stand':
      return <RollingStand asset={asset} color={color} />
    case 'steader_3_roll':
      return <Steader3Roll asset={asset} color={color} />
    case 'piercer_drive':
      return <PiercerDrive asset={asset} color={color} />
    case 'piercer_machine':
      return <PiercerMachine asset={asset} color={color} />
    case 'billet_tong':
      return <BilletTong asset={asset} color={color} />
    case 'bundle_saw':
      return <BundleSaw asset={asset} color={color} />
    case 'linsinger_vertical_saw':
      return <LinsingerVerticalSaw asset={asset} color={color} />
    case 'cooling_bed':
      return <CoolingBed asset={asset} color={color} />
    case 'electric_motor_horizontal':
      return <ElectricMotorHorizontal asset={asset} color={color} />
    case 'electric_motor_vertical':
      return <ElectricMotorVertical asset={asset} color={color} />
    case 'gearbox_horizontal':
      return <GearboxHorizontal asset={asset} color={color} />
    case 'gearbox_vertical':
      return <GearboxVertical asset={asset} color={color} />
    case 'motor_gearbox_parallel':
      return <MotorGearboxParallel asset={asset} color={color} />
    case 'hydraulic_power_unit':
      return <HydraulicPowerUnit asset={asset} color={color} />
    case 'transfer_star':
      return <TransferStar asset={asset} color={color} />
    case 'transfer_v':
      return <TransferV asset={asset} color={color} />
    case 'transfer_claw':
      return <TransferClaw asset={asset} color={color} />
    case 'coupling':
      return <Coupling asset={asset} color={color} />
    case 'cardan_shaft':
      return <CardanShaft asset={asset} color={color} />
    case 'transmission_shaft':
      return <TransmissionShaft asset={asset} color={color} />
    case 'centrifugal_pump_horizontal':
      return <CentrifugalPumpHorizontal asset={asset} color={color} />
    case 'vertical_pump':
      return <VerticalPump asset={asset} color={color} />
    case 'industrial_fan':
      return <IndustrialFan asset={asset} color={color} />
    case 'platform':
      return <Platform asset={asset} color={color} />
    case 'stairs':
      return <Stairs asset={asset} color={color} />
    case 'handrail':
      return <Handrail asset={asset} color={color} />
    case 'column':
      return <Column asset={asset} color={color} />
    case 'electrical_panel':
      return <ElectricalPanel asset={asset} color={color} />
    case 'cabinet':
      return <Cabinet asset={asset} color={color} />
    case 'tank_vertical':
      return <TankVertical asset={asset} color={color} />
    case 'tank_horizontal':
      return <TankHorizontal asset={asset} color={color} />
    case 'rectangular_pool':
      return <RectangularPool asset={asset} color={color} />
    case 'pipe_rack_simple':
      return <PipeRackSimple asset={asset} color={color} />
    case 'motor':
    case 'roller':
      return <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow><cylinderGeometry args={[h / 2, h / 2, w, 24]} />{material}</mesh>
    case 'tank':
      return <mesh castShadow receiveShadow><cylinderGeometry args={[w / 2, w / 2, h, 32]} />{material}</mesh>
    case 'roller_table': {
      const count = Math.max(3, Math.min(12, Math.round(w / 0.65)))
      return <group>
        <mesh position={[0, -h * 0.3, 0]}><boxGeometry args={[w, h * 0.4, d]} />{material}</mesh>
        {Array.from({ length: count }, (_, i) => {
          const x = count === 1 ? 0 : -w / 2 + (i * w) / (count - 1)
          return <mesh key={i} position={[x, h * 0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[h * 0.18, h * 0.18, d * 0.92, 16]} />{material}
          </mesh>
        })}
      </group>
    }
    case 'pump':
      return <group>
        <mesh position={[-w * 0.2, -h * 0.25, 0]} castShadow><boxGeometry args={[w * 0.55, h * 0.5, d]} />{material}</mesh>
        <mesh position={[w * 0.2, h * 0.08, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[h * 0.34, h * 0.34, d, 20]} />{material}</mesh>
      </group>
    default:
      return <mesh castShadow receiveShadow><boxGeometry args={[w, h, d]} />{material}</mesh>
  }
}

export const IndustrialObject = forwardRef<THREE.Group, Props>(function IndustrialObject({
  asset,
  selected,
  primary,
  view,
  visualPreset,
  showLabel,
  onHoverChange,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onContextMenu,
}, ref) {
  const objectRef = useRef<THREE.Group | null>(null)
  const setObjectRef = useCallback((node: THREE.Group | null) => {
    objectRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }, [ref])
  const click = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(event) }
  const label = (view.labelMode === 'name' ? asset.name : view.labelMode === 'area' ? asset.areaCode : asset.id) || asset.id || asset.name || 'Sin ID'
  const worldTransform = getIndustrialAssetWorldTransform(asset)
  const selectionColor = visualPreset === 'DIGITAL_TWIN'
    ? primary ? '#d97706' : '#1677ff'
    : primary ? '#ffd166' : '#67b7ff'

  useLayoutEffect(() => {
    if (!objectRef.current) return
    applyIndustrialPresentation(objectRef.current, asset.type, visualPreset, getVisualTheme(visualPreset, view.theme))
  })

  return (
    <group
      ref={setObjectRef}
      position={[worldTransform.position.x, worldTransform.position.y, worldTransform.position.z]}
      rotation={[worldTransform.rotation.x, worldTransform.rotation.y, worldTransform.rotation.z]}
      scale={[worldTransform.scale.x, worldTransform.scale.y, worldTransform.scale.z]}
      onClick={click}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerOver={(event) => { event.stopPropagation(); onHoverChange?.(true) }}
      onPointerOut={() => onHoverChange?.(false)}
      onContextMenu={onContextMenu}
      userData={{ assetId: asset.id }}
    >
      <AssetGeometry asset={asset} selected={selected} view={view} />
      {selected && <mesh scale={1.035} raycast={() => null} userData={{ excludeFromAlignmentBounds: true }}>
        <boxGeometry args={[asset.size.width, asset.size.height, asset.size.depth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        <Edges color={selectionColor} lineWidth={primary ? 2.2 : 1.1} />
      </mesh>}
      {showLabel && (
        <Html position={[0, asset.size.height / 2 + 0.28, 0]} center style={{ pointerEvents: 'none' }}>
          <span className={`asset-label ${selected ? 'selected' : ''}${primary ? ' primary' : ''}`}>{label}</span>
        </Html>
      )}
    </group>
  )
})

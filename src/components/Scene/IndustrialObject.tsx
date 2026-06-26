import { forwardRef } from 'react'
import { Edges, Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type * as THREE from 'three'
import { Color } from 'three'
import type { IndustrialAsset, ViewSettings } from '../../types/plant'

interface Props {
  asset: IndustrialAsset
  selected: boolean
  view: ViewSettings
  onSelect: () => void
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
  const material = <Material asset={asset} selected={selected} view={view} />
  switch (asset.type) {
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
  view,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onContextMenu,
}, ref) {
  const click = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect() }
  const label = (view.labelMode === 'name' ? asset.name : asset.id) || asset.id || asset.name || 'Sin ID'

  return (
    <group
      ref={ref}
      position={[asset.position.x, asset.position.y, asset.position.z]}
      rotation={[asset.rotation.x, asset.rotation.y, asset.rotation.z]}
      onClick={click}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={onContextMenu}
      userData={{ assetId: asset.id }}
    >
      <AssetGeometry asset={asset} selected={selected} view={view} />
      {selected && <mesh scale={1.035}>
        <boxGeometry args={[asset.size.width, asset.size.height, asset.size.depth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        <Edges color="#ffd166" lineWidth={1.5} />
      </mesh>}
      {view.showLabels && (
        <Html position={[0, asset.size.height / 2 + 0.28, 0]} center style={{ pointerEvents: 'none' }}>
          <span className={`asset-label ${selected ? 'selected' : ''}`}>{label}</span>
        </Html>
      )}
    </group>
  )
})

import { useEffect, useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { LayoutImage } from '../../types/plant'

interface Props {
  layout: LayoutImage | null
  color: string
  onClearSelection: () => void
}

type FloorEvent = ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>

export function Floor({ layout, color, onClearSelection }: Props) {
  const clearSelection = (event: FloorEvent) => {
    event.stopPropagation()
    onClearSelection()
  }

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onPointerDown={clearSelection} onClick={clearSelection}>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color={color} roughness={0.96} />
      </mesh>
      {layout?.visible && <LayoutPlane layout={layout} onClearSelection={clearSelection} />}
    </group>
  )
}

function LayoutPlane({ layout, onClearSelection }: { layout: LayoutImage; onClearSelection: (event: FloorEvent) => void }) {
  const texture = useMemo(() => new THREE.TextureLoader().load(layout.dataUrl), [layout.dataUrl])
  useEffect(() => () => texture.dispose(), [texture])

  const aspect = layout.heightPx > 0 ? layout.heightPx / Math.max(1, layout.widthPx) : 1
  const width = 24 * layout.scale
  const depth = width * aspect

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]} receiveShadow onPointerDown={onClearSelection} onClick={onClearSelection}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial map={texture} transparent opacity={layout.opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

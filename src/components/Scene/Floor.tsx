import type { ThreeEvent } from '@react-three/fiber'

interface Props {
  color: string
  elevation?: number
  onClearSelection: (event: FloorEvent) => void
}

type FloorEvent = ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>

export function Floor({ color, elevation = 0, onClearSelection }: Props) {
  const clearSelection = (event: FloorEvent) => {
    event.stopPropagation()
    onClearSelection(event)
  }

  return (
    <group>
      <mesh position={[0, elevation, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow onPointerDown={clearSelection} onClick={clearSelection}>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color={color} roughness={0.96} transparent={elevation !== 0} opacity={elevation === 0 ? 1 : 0.08} depthWrite={elevation === 0} />
      </mesh>
    </group>
  )
}

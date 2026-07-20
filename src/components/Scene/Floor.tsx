import type { ThreeEvent } from '@react-three/fiber'

interface Props {
  color: string
  onClearSelection: () => void
}

type FloorEvent = ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>

export function Floor({ color, onClearSelection }: Props) {
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
    </group>
  )
}

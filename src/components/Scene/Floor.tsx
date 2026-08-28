import type { ThreeEvent } from '@react-three/fiber'
import type { VisualPreset } from '../../visualization/visualTheme'

interface Props {
  color: string
  elevation?: number
  visualPreset: VisualPreset
  onClearSelection: (event: FloorEvent) => void
}

type FloorEvent = ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>

export function Floor({ color, elevation = 0, visualPreset, onClearSelection }: Props) {
  const clearSelection = (event: FloorEvent) => {
    event.stopPropagation()
    onClearSelection(event)
  }

  if (visualPreset === 'DIGITAL_TWIN') {
    return (
      <group>
        <mesh position={[0, elevation, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[1000, 1000]} />
          <meshStandardMaterial color={color} roughness={0.98} metalness={0} />
        </mesh>
        <mesh position={[0, elevation + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={clearSelection} onClick={clearSelection}>
          <planeGeometry args={[1000, 1000]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      </group>
    )
  }

  return (
    <group>
      <mesh position={[0, elevation, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow onPointerDown={clearSelection} onClick={clearSelection}>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color={color} roughness={0.96} metalness={0} transparent={elevation !== 0} opacity={elevation === 0 ? 1 : 0.08} depthWrite={elevation === 0} />
      </mesh>
    </group>
  )
}

import { useMemo, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { IndustrialAsset, SnapSettings } from '../../types/plant'

interface Props {
  asset: IndustrialAsset
  snap: SnapSettings
  onRotate: (rotation: IndustrialAsset['rotation']) => void
  setOrbitEnabled: (enabled: boolean) => void
  setTransformInteracting: (active: boolean) => void
}

const DEBUG_TRANSFORM = false
const positiveOr = (value: number, fallback: number) => Number.isFinite(value) && value > 0 ? value : fallback
const roundTo = (value: number, step: number) => step > 0 ? Math.round(value / step) * step : value
const normalizeAngle = (value: number) => {
  const fullTurn = Math.PI * 2
  return ((value + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI
}
const pointerTarget = (event: ThreeEvent<PointerEvent>) => event.target as (Element & {
  setPointerCapture?: (pointerId: number) => void
  releasePointerCapture?: (pointerId: number) => void
}) | null

export function YRotationHandle({ asset, snap, onRotate, setOrbitEnabled, setTransformInteracting }: Props) {
  const dragRef = useRef<{
    plane: THREE.Plane
    center: THREE.Vector3
    startPointerAngle: number
    startRotationY: number
  } | null>(null)

  const radius = useMemo(() => Math.max(asset.size.width, asset.size.depth) * 0.68 + 0.35, [asset.size])
  const y = asset.size.height / 2 + 0.18

  const hitOnPlane = (event: ThreeEvent<PointerEvent>, plane: THREE.Plane) => {
    const hit = new THREE.Vector3()
    return event.ray.intersectPlane(plane, hit) ? hit : null
  }

  const angleFromHit = (hit: THREE.Vector3, center: THREE.Vector3) => Math.atan2(hit.z - center.z, hit.x - center.x)

  const beginDrag = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0 || asset.locked) return
    event.stopPropagation()
    const center = new THREE.Vector3(asset.position.x, asset.position.y, asset.position.z)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -asset.position.y)
    const hit = hitOnPlane(event, plane)
    if (!hit) return

    dragRef.current = {
      plane,
      center,
      startPointerAngle: angleFromHit(hit, center),
      startRotationY: asset.rotation.y,
    }
    setTransformInteracting(true)
    setOrbitEnabled(false)
    pointerTarget(event)?.setPointerCapture?.(event.pointerId)
    if (DEBUG_TRANSFORM) console.debug('[YRotationHandle] pointerDown', { id: asset.id, rotationY: asset.rotation.y })
  }

  const drag = (event: ThreeEvent<PointerEvent>) => {
    const dragState = dragRef.current
    if (!dragState || asset.locked) return
    event.stopPropagation()
    const hit = hitOnPlane(event, dragState.plane)
    if (!hit) return

    const currentPointerAngle = angleFromHit(hit, dragState.center)
    const delta = currentPointerAngle - dragState.startPointerAngle
    const step = snap.enabled ? (positiveOr(snap.rotationDegrees, 15) * Math.PI) / 180 : 0
    const yRotation = normalizeAngle(step > 0 ? roundTo(dragState.startRotationY + delta, step) : dragState.startRotationY + delta)
    onRotate({ ...asset.rotation, y: yRotation })
    if (DEBUG_TRANSFORM) console.debug('[YRotationHandle] rotate', { id: asset.id, y: yRotation })
  }

  const endDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!dragRef.current) return
    event.stopPropagation()
    dragRef.current = null
    setOrbitEnabled(true)
    setTransformInteracting(false)
    pointerTarget(event)?.releasePointerCapture?.(event.pointerId)
    if (DEBUG_TRANSFORM) console.debug('[YRotationHandle] pointerUp', { id: asset.id })
  }

  return (
    <group position={[asset.position.x, asset.position.y, asset.position.z]}>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, y, 0]}
        onPointerDown={beginDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <torusGeometry args={[radius, 0.045, 10, 96]} />
        <meshBasicMaterial color="#f6b73c" depthTest={false} />
      </mesh>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, y, 0]}
        onPointerDown={beginDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <torusGeometry args={[radius, 0.18, 8, 96]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
      </mesh>
    </group>
  )
}

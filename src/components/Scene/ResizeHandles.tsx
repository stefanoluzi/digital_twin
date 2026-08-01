import { useMemo, useRef } from 'react'
import { Edges } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { IndustrialAsset, SnapSettings } from '../../types/plant'

type Axis = 'x' | 'y' | 'z'
type HandleSign = { x: -1 | 1; y: -1 | 1; z: -1 | 1 }

interface Props {
  asset: IndustrialAsset
  snap: SnapSettings
  onResize: (update: Pick<IndustrialAsset, 'position' | 'size'>) => void
  onResizeStart: () => void
  onResizeEnd: () => void
  setOrbitEnabled: (enabled: boolean) => void
}

const MIN_SIZE = 0.1
const HEIGHT_SNAP = 0.1
const handleSigns: HandleSign[] = [
  { x: -1, y: -1, z: -1 },
  { x: -1, y: -1, z: 1 },
  { x: 1, y: -1, z: -1 },
  { x: 1, y: -1, z: 1 },
  { x: -1, y: 1, z: -1 },
  { x: -1, y: 1, z: 1 },
  { x: 1, y: 1, z: -1 },
  { x: 1, y: 1, z: 1 },
]

const finiteOr = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback
const positiveOr = (value: number, fallback: number) => Number.isFinite(value) && value > 0 ? value : fallback
const snapValue = (value: number, step: number) => Math.round(value / step) * step
const pointerTarget = (event: ThreeEvent<PointerEvent>) => event.target as (Element & {
  setPointerCapture?: (pointerId: number) => void
  releasePointerCapture?: (pointerId: number) => void
}) | null

function snapDimension(value: number, axis: Axis, snap: SnapSettings) {
  const step = snap.enabled ? (axis === 'y' ? HEIGHT_SNAP : positiveOr(snap.gridSize, HEIGHT_SNAP)) : 0
  const next = step > 0 ? snapValue(value, step) : value
  return Math.max(MIN_SIZE, finiteOr(next, MIN_SIZE))
}

function localHandlePosition(asset: IndustrialAsset, sign: HandleSign) {
  return new THREE.Vector3(
    (asset.size.width / 2) * sign.x,
    (asset.size.height / 2) * sign.y,
    (asset.size.depth / 2) * sign.z,
  )
}

function worldMatrixFor(asset: IndustrialAsset) {
  const matrix = new THREE.Matrix4()
  const rotation = new THREE.Euler(asset.rotation.x, asset.rotation.y, asset.rotation.z)
  const quaternion = new THREE.Quaternion().setFromEuler(rotation)
  matrix.compose(
    new THREE.Vector3(asset.position.x, asset.position.y, asset.position.z),
    quaternion,
    new THREE.Vector3(asset.uniformScale, asset.uniformScale, asset.uniformScale),
  )
  return matrix
}

export function ResizeHandles({ asset, snap, onResize, onResizeStart, onResizeEnd, setOrbitEnabled }: Props) {
  const dragRef = useRef<{
    sign: HandleSign
    plane: THREE.Plane
    inverseMatrix: THREE.Matrix4
    startLocal: THREE.Vector3
    baseSize: IndustrialAsset['size']
    basePosition: IndustrialAsset['position']
  } | null>(null)

  const handleSize = useMemo(() => Math.max(0.13, Math.min(0.32, Math.max(asset.size.width, asset.size.height, asset.size.depth) * 0.035)), [asset.size])
  const matrix = useMemo(() => worldMatrixFor(asset), [asset.position, asset.rotation, asset.uniformScale])

  const hitOnPlane = (event: ThreeEvent<PointerEvent>, plane: THREE.Plane) => {
    const hit = new THREE.Vector3()
    return event.ray.intersectPlane(plane, hit) ? hit : null
  }

  const beginDrag = (event: ThreeEvent<PointerEvent>, sign: HandleSign) => {
    if (event.button !== 0 || asset.locked) return
    event.stopPropagation()

    const handleWorld = localHandlePosition(asset, sign).applyMatrix4(matrix)
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(event.camera.getWorldDirection(new THREE.Vector3()), handleWorld)
    const hit = hitOnPlane(event, plane)
    if (!hit) return

    const inverseMatrix = matrix.clone().invert()
    dragRef.current = {
      sign,
      plane,
      inverseMatrix,
      startLocal: hit.clone().applyMatrix4(inverseMatrix),
      baseSize: { ...asset.size },
      basePosition: { ...asset.position },
    }
    onResizeStart()
    setOrbitEnabled(false)
    pointerTarget(event)?.setPointerCapture?.(event.pointerId)
  }

  const drag = (event: ThreeEvent<PointerEvent>) => {
    const dragState = dragRef.current
    if (!dragState || asset.locked) return
    event.stopPropagation()

    const hit = hitOnPlane(event, dragState.plane)
    if (!hit) return

    const currentLocal = hit.applyMatrix4(dragState.inverseMatrix)
    const delta = currentLocal.sub(dragState.startLocal)
    const width = snapDimension(dragState.baseSize.width + delta.x * dragState.sign.x, 'x', snap)
    const depth = snapDimension(dragState.baseSize.depth + delta.z * dragState.sign.z, 'z', snap)
    const height = dragState.sign.y > 0
      ? snapDimension(dragState.baseSize.height + delta.y, 'y', snap)
      : dragState.baseSize.height

    const offsetLocal = new THREE.Vector3(
      ((width - dragState.baseSize.width) / 2) * dragState.sign.x,
      (height - dragState.baseSize.height) / 2,
      ((depth - dragState.baseSize.depth) / 2) * dragState.sign.z,
    )
    const rotationMatrix = new THREE.Matrix4().extractRotation(matrix)
    const offsetWorld = offsetLocal.multiplyScalar(asset.uniformScale).applyMatrix4(rotationMatrix)
    const baseElevation = dragState.basePosition.y - dragState.baseSize.height * asset.uniformScale / 2

    onResize({
      size: { width, height, depth },
      position: {
        x: dragState.basePosition.x + offsetWorld.x,
        y: baseElevation + height * asset.uniformScale / 2,
        z: dragState.basePosition.z + offsetWorld.z,
      },
    })
  }

  const endDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!dragRef.current) return
    event.stopPropagation()
    dragRef.current = null
    onResizeEnd()
    setOrbitEnabled(true)
    pointerTarget(event)?.releasePointerCapture?.(event.pointerId)
  }

  return (
    <group position={[asset.position.x, asset.position.y, asset.position.z]} rotation={[asset.rotation.x, asset.rotation.y, asset.rotation.z]} scale={[asset.uniformScale, asset.uniformScale, asset.uniformScale]}>
      <mesh scale={1.015}>
        <boxGeometry args={[asset.size.width, asset.size.height, asset.size.depth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        <Edges color="#f6b73c" lineWidth={1.25} />
      </mesh>
      {handleSigns.map((sign) => (
        <mesh
          key={`${sign.x}:${sign.y}:${sign.z}`}
          position={[(asset.size.width / 2) * sign.x, (asset.size.height / 2) * sign.y, (asset.size.depth / 2) * sign.z]}
          onPointerDown={(event) => beginDrag(event, sign)}
          onPointerMove={drag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <boxGeometry args={[handleSize, handleSize, handleSize]} />
          <meshStandardMaterial color={sign.y > 0 ? '#ffbf3d' : '#e98f30'} emissive="#4d2b00" emissiveIntensity={0.35} depthTest={false} />
        </mesh>
      ))}
    </group>
  )
}

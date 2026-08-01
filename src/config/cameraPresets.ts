import * as THREE from 'three'

export type PlantFrontDirection = 'POSITIVE_X' | 'NEGATIVE_X' | 'POSITIVE_Z' | 'NEGATIVE_Z'

export type CameraPresetId =
  | 'TOP'
  | 'FRONT'
  | 'BACK'
  | 'LEFT'
  | 'RIGHT'
  | 'ISO_FRONT'
  | 'ISO_BACK'
  | 'ISO_LEFT'
  | 'ISO_RIGHT'

export const PLANT_FRONT_DIRECTION: PlantFrontDirection = 'NEGATIVE_Z'

const ISOMETRIC_ELEVATION = 0.85
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const TOP_UP = new THREE.Vector3(0, 0, -1)

function plantAxes(frontDirection: PlantFrontDirection) {
  switch (frontDirection) {
    case 'POSITIVE_X':
      return { front: new THREE.Vector3(1, 0, 0), right: new THREE.Vector3(0, 0, -1) }
    case 'NEGATIVE_X':
      return { front: new THREE.Vector3(-1, 0, 0), right: new THREE.Vector3(0, 0, 1) }
    case 'POSITIVE_Z':
      return { front: new THREE.Vector3(0, 0, 1), right: new THREE.Vector3(1, 0, 0) }
    case 'NEGATIVE_Z':
      return { front: new THREE.Vector3(0, 0, -1), right: new THREE.Vector3(-1, 0, 0) }
  }
}

export function getCameraPresetDirection(
  preset: CameraPresetId,
  frontDirection: PlantFrontDirection = PLANT_FRONT_DIRECTION,
) {
  const { front, right } = plantAxes(frontDirection)
  const back = front.clone().negate()
  const left = right.clone().negate()
  const elevated = (horizontal: THREE.Vector3) => horizontal.addScaledVector(WORLD_UP, ISOMETRIC_ELEVATION).normalize()

  switch (preset) {
    case 'TOP': return WORLD_UP.clone()
    case 'FRONT': return front
    case 'BACK': return back
    case 'LEFT': return left
    case 'RIGHT': return right
    case 'ISO_FRONT': return elevated(front.add(right))
    case 'ISO_BACK': return elevated(back.add(left))
    case 'ISO_LEFT': return elevated(front.add(left))
    case 'ISO_RIGHT': return elevated(back.add(right))
  }
}

export function getCameraPresetUp(preset: CameraPresetId) {
  return preset === 'TOP' ? TOP_UP.clone() : WORLD_UP.clone()
}

interface CameraControlsLike {
  target: THREE.Vector3
  update: () => void
}

export function applyCameraPreset(
  camera: THREE.Camera,
  controls: CameraControlsLike,
  preset: CameraPresetId,
  frontDirection: PlantFrontDirection = PLANT_FRONT_DIRECTION,
) {
  const target = controls.target.clone()
  const distance = camera.position.distanceTo(target)
  const safeDistance = Number.isFinite(distance) && distance > 0.0001 ? distance : 1
  const direction = getCameraPresetDirection(preset, frontDirection)
  const orthographic = camera as THREE.OrthographicCamera
  const perspective = camera as THREE.PerspectiveCamera
  const zoom = orthographic.isOrthographicCamera ? orthographic.zoom : undefined
  const fov = perspective.isPerspectiveCamera ? perspective.fov : undefined

  camera.position.copy(target).addScaledVector(direction, safeDistance)
  camera.up.copy(getCameraPresetUp(preset))
  camera.lookAt(target)

  if (orthographic.isOrthographicCamera && zoom !== undefined) orthographic.zoom = zoom
  if (perspective.isPerspectiveCamera && fov !== undefined) perspective.fov = fov
  if (orthographic.isOrthographicCamera) orthographic.updateProjectionMatrix()
  else if (perspective.isPerspectiveCamera) perspective.updateProjectionMatrix()

  controls.target.copy(target)
  controls.update()
}

// Same distance and elevation as the original default; horizontal direction is its exact opposite.
export const DEFAULT_CAMERA_POSITION = [-14, 12, -14] as const

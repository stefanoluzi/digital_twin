import { forwardRef as ReactForwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { GizmoHelper, GizmoViewport, OrbitControls, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { AREA_FILTER_ALL } from '../../config/areas'
import { useSceneStore } from '../../store/sceneStore'
import type { IndustrialAsset, ReferenceLayout, ReferenceLayoutPoint } from '../../types/plant'
import { Floor } from './Floor'
import { IndustrialObject } from './IndustrialObject'
import { ResizeHandles } from './ResizeHandles'
import { YRotationHandle } from './YRotationHandle'

const roundTo = (value: number, step: number) => step > 0 ? Math.round(value / step) * step : value
const changed = (a: number, b: number) => Math.abs(a - b) > 0.0005
const finiteOr = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback
const positiveOr = (value: number, fallback: number) => Number.isFinite(value) && value > 0 ? value : fallback
const GRID_SIZE = 1000
const GRID_DIVISIONS = 1000
const CAMERA_NEAR = -10000
const CAMERA_FAR = 10000
const ORTHO_MIN_ZOOM = 0.001
const ORTHO_MAX_ZOOM = 220
const DEBUG_TRANSFORM = false
const DEBUG_LAYOUT_SCALE = false
const DEBUG_CALIBRATION = false
const DEBUG_CROP_HANDLES = false
const DEBUG_CROP_VERTICAL = false
const DEBUG_CAMERA_RIGHT_CLICK = false
const DEBUG_CALIBRATION_CAMERA = false
const DRAG_THRESHOLD_PX = 4

const DEFAULT_MOUSE_BUTTONS = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN,
}

const CROP_MOUSE_BUTTONS = {
  LEFT: undefined,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN,
}

const CALIBRATION_MOUSE_BUTTONS = {
  LEFT: undefined,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN,
}

function getOrbitMouseButtons(cropActive: boolean, calibrationActive: boolean) {
  if (cropActive) return { ...CROP_MOUSE_BUTTONS }
  if (calibrationActive) return { ...CALIBRATION_MOUSE_BUTTONS }
  return { ...DEFAULT_MOUSE_BUTTONS }
}

function preventIfCancelable(event?: Event) {
  if (event?.cancelable) event.preventDefault()
}

const sceneColors = {
  dark: {
    background: '#1b2228',
    floor: '#202932',
    gridCenter: '#6d7b86',
    grid: '#3c4852',
  },
  light: {
    background: '#eef2f5',
    floor: '#e2e8ee',
    gridCenter: '#7b8794',
    grid: '#c1cad3',
  },
}

function snapAsset(asset: IndustrialAsset, snap = useSceneStore.getState().snap): IndustrialAsset {
  if (!snap.enabled) return asset
  const gridSize = positiveOr(snap.gridSize, 0.5)
  const rotationStep = (positiveOr(snap.rotationDegrees, 15) * Math.PI) / 180
  const scaleStep = positiveOr(snap.scaleStep, 0.1)
  return {
    ...asset,
    position: {
      x: roundTo(finiteOr(asset.position.x, 0), gridSize),
      y: finiteOr(asset.position.y, asset.size.height / 2),
      z: roundTo(finiteOr(asset.position.z, 0), gridSize),
    },
    rotation: {
      x: finiteOr(asset.rotation.x, 0),
      y: roundTo(finiteOr(asset.rotation.y, 0), rotationStep),
      z: finiteOr(asset.rotation.z, 0),
    },
    size: {
      width: Math.max(0.1, roundTo(finiteOr(asset.size.width, 1), scaleStep)),
      height: Math.max(0.1, roundTo(finiteOr(asset.size.height, 1), scaleStep)),
      depth: Math.max(0.1, roundTo(finiteOr(asset.size.depth, 1), scaleStep)),
    },
  }
}

function combinedSelectionCenter(objects: IndustrialAsset[]) {
  if (objects.length === 0) return new THREE.Vector3()
  const min = new THREE.Vector3(Infinity, Infinity, Infinity)
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
  objects.forEach((asset) => {
    min.x = Math.min(min.x, asset.position.x - asset.size.width / 2)
    min.y = Math.min(min.y, asset.position.y - asset.size.height / 2)
    min.z = Math.min(min.z, asset.position.z - asset.size.depth / 2)
    max.x = Math.max(max.x, asset.position.x + asset.size.width / 2)
    max.y = Math.max(max.y, asset.position.y + asset.size.height / 2)
    max.z = Math.max(max.z, asset.position.z + asset.size.depth / 2)
  })
  return min.add(max).multiplyScalar(0.5)
}

function assetBounds(objects: IndustrialAsset[]) {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity)
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
  objects.forEach((asset) => {
    min.x = Math.min(min.x, asset.position.x - asset.size.width / 2)
    min.y = Math.min(min.y, asset.position.y - asset.size.height / 2)
    min.z = Math.min(min.z, asset.position.z - asset.size.depth / 2)
    max.x = Math.max(max.x, asset.position.x + asset.size.width / 2)
    max.y = Math.max(max.y, asset.position.y + asset.size.height / 2)
    max.z = Math.max(max.z, asset.position.z + asset.size.depth / 2)
  })
  return { min, max, center: min.clone().add(max).multiplyScalar(0.5), size: max.clone().sub(min) }
}

function referenceLayoutSize(layout: ReferenceLayout) {
  const baseHeight = layout.baseWidth / Math.max(0.0001, layout.aspectRatio)
  const cropU = layout.crop.enabled ? Math.max(0.01, layout.crop.uMax - layout.crop.uMin) : 1
  const cropV = layout.crop.enabled ? Math.max(0.01, layout.crop.vMax - layout.crop.vMin) : 1
  return {
    width: layout.baseWidth * layout.uniformScale * (layout.lockAspectRatio ? 1 : layout.stretchWidth) * cropU,
    height: baseHeight * layout.uniformScale * (layout.lockAspectRatio ? 1 : layout.stretchHeight) * cropV,
  }
}

function referenceLayoutFullSize(layout: ReferenceLayout) {
  const baseHeight = layout.baseWidth / Math.max(0.0001, layout.aspectRatio)
  return {
    width: layout.baseWidth * layout.uniformScale * (layout.lockAspectRatio ? 1 : layout.stretchWidth),
    height: baseHeight * layout.uniformScale * (layout.lockAspectRatio ? 1 : layout.stretchHeight),
  }
}

function referenceLayoutBounds(layout: ReferenceLayout) {
  const size = referenceLayoutSize(layout)
  const crop = layout.crop.enabled ? layout.crop : { enabled: false, uMin: 0, vMin: 0, uMax: 1, vMax: 1 }
  const full = referenceLayoutFullSize(layout)
  const centerU = (crop.uMin + crop.uMax) / 2
  const centerV = (crop.vMin + crop.vMax) / 2
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(layout.position.x, layout.position.y, layout.position.z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + layout.rotation.x, layout.rotation.y, layout.rotation.z)),
    new THREE.Vector3(1, 1, 1),
  )
  const corners = [
    new THREE.Vector3(-size.width / 2, -size.height / 2, 0),
    new THREE.Vector3(size.width / 2, -size.height / 2, 0),
    new THREE.Vector3(size.width / 2, size.height / 2, 0),
    new THREE.Vector3(-size.width / 2, size.height / 2, 0),
  ].map((point) => point.add(new THREE.Vector3((centerU - 0.5) * full.width, (centerV - 0.5) * full.height, 0)).applyMatrix4(matrix))
  return new THREE.Box3().setFromPoints(corners)
}

function objectBounds(asset: IndustrialAsset) {
  return new THREE.Box3(
    new THREE.Vector3(asset.position.x - asset.size.width / 2, asset.position.y - asset.size.height / 2, asset.position.z - asset.size.depth / 2),
    new THREE.Vector3(asset.position.x + asset.size.width / 2, asset.position.y + asset.size.height / 2, asset.position.z + asset.size.depth / 2),
  )
}

function combineBoxes(boxes: THREE.Box3[]) {
  if (boxes.length === 0) return null
  const box = boxes[0].clone()
  boxes.slice(1).forEach((item) => box.union(item))
  return box
}

function uvToLayoutLocal(point: ReferenceLayoutPoint, width: number, height: number, z = 0.06) {
  return new THREE.Vector3((point.u - 0.5) * width, (point.v - 0.5) * height, z)
}

const disabledRaycast = () => null

export function PlantScene() {
  const select = useSceneStore((state) => state.selectObject)
  const focus = useSceneStore((state) => state.focusObject)
  const remove = useSceneStore((state) => state.deleteObject)
  const referenceLayout = useSceneStore((state) => state.referenceLayout)
  const layoutCalibration = useSceneStore((state) => state.layoutCalibration)
  const layoutCrop = useSceneStore((state) => state.layoutCrop)
  const updateLayout = useSceneStore((state) => state.updateLayout)
  const cancelLayoutCalibration = useSceneStore((state) => state.cancelLayoutCalibration)
  const setLayoutCalibrationDraft = useSceneStore((state) => state.setLayoutCalibrationDraft)
  const transformInteractingRef = useRef(false)
  const transformReleaseTimerRef = useRef<number | null>(null)
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [calibrationDistanceInput, setCalibrationDistanceInput] = useState('')
  const [calibrationError, setCalibrationError] = useState('')
  const calibrationPendingDistance = Boolean(layoutCalibration.active && layoutCalibration.pointA && layoutCalibration.pointB && referenceLayout)
  const calibrationMessage = layoutCalibration.active
    ? layoutCalibration.pointA
      ? layoutCalibration.pointB ? 'Abrir ingreso de distancia real.' : 'Punto 1 seleccionado. Selecciona el segundo punto sobre el layout.'
      : 'Calibracion activa: selecciona el primer punto sobre el layout.'
    : ''

  const currentCalibrationDistance = referenceLayout && layoutCalibration.pointA && layoutCalibration.pointB
    ? Math.hypot(
      (layoutCalibration.pointB.u - layoutCalibration.pointA.u) * referenceLayoutSize(referenceLayout).width,
      (layoutCalibration.pointB.v - layoutCalibration.pointA.v) * referenceLayoutSize(referenceLayout).height,
    )
    : null

  const setTransformInteracting = (active: boolean) => {
    if (transformReleaseTimerRef.current !== null) {
      window.clearTimeout(transformReleaseTimerRef.current)
      transformReleaseTimerRef.current = null
    }
    if (active) {
      transformInteractingRef.current = true
      return
    }
    transformReleaseTimerRef.current = window.setTimeout(() => {
      transformInteractingRef.current = false
      transformReleaseTimerRef.current = null
    }, 80)
  }

  const clearSelection = () => {
    if (transformInteractingRef.current) return
    select(null)
    setMenu(null)
  }

  useEffect(() => {
    if (DEBUG_CALIBRATION) console.log('isCalibrating:', layoutCalibration.active)
  }, [layoutCalibration.active])

  useEffect(() => {
    if (calibrationPendingDistance && referenceLayout) {
      setCalibrationDistanceInput(referenceLayout.calibration.realDistance ? String(referenceLayout.calibration.realDistance) : '')
      setCalibrationError('')
    }
  }, [calibrationPendingDistance, referenceLayout])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && useSceneStore.getState().layoutCalibration.active) {
        cancelLayoutCalibration()
      }
      if (event.key === 'Escape' && useSceneStore.getState().layoutCrop.active) {
        useSceneStore.getState().cancelLayoutCrop()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cancelLayoutCalibration])

  useEffect(() => {
    const close = () => setMenu(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
      if (transformReleaseTimerRef.current !== null) window.clearTimeout(transformReleaseTimerRef.current)
    }
  }, [])

  const openMenu = (id: string, x: number, y: number) => {
    select(id)
    setMenu({ id, x, y })
  }

  const menuAction = (action: () => void) => {
    action()
    setMenu(null)
  }

  const confirmCalibrationDistance = () => {
    const layout = useSceneStore.getState().referenceLayout
    const draft = useSceneStore.getState().layoutCalibration
    if (!layout || !draft.pointA || !draft.pointB) return
    const currentDistance = Math.hypot(
      (draft.pointB.u - draft.pointA.u) * referenceLayoutSize(layout).width,
      (draft.pointB.v - draft.pointA.v) * referenceLayoutSize(layout).height,
    )
    const realDistance = Number(calibrationDistanceInput.replace(',', '.'))
    if (!Number.isFinite(realDistance) || realDistance <= 0) {
      setCalibrationError('Ingresa una distancia real valida mayor a cero.')
      return
    }
    if (!Number.isFinite(currentDistance) || currentDistance <= 0.0001) {
      setCalibrationError('La distancia actual entre puntos no es valida.')
      return
    }
    const scaleFactor = realDistance / currentDistance
    if (DEBUG_CALIBRATION) console.log('Calibration confirm', {
      pointA: draft.pointA,
      pointB: draft.pointB,
      currentDistance,
      realDistance,
      scaleFactor,
      uniformScaleBefore: layout.uniformScale,
      uniformScaleAfter: Math.min(1000, Math.max(0.01, layout.uniformScale * scaleFactor)),
    })
    updateLayout({
      uniformScale: Math.min(1000, Math.max(0.01, layout.uniformScale * scaleFactor)),
      calibration: {
        pointA: draft.pointA,
        pointB: draft.pointB,
        realDistance,
        calibrated: true,
      },
    })
    cancelLayoutCalibration()
  }

  const retrySecondCalibrationPoint = () => {
    if (!layoutCalibration.pointA) return
    setLayoutCalibrationDraft({ pointA: layoutCalibration.pointA, pointB: undefined })
    setCalibrationError('')
  }

  return (
    <div className={`scene${layoutCalibration.active || layoutCrop.active ? ' calibrating' : ''}`} onContextMenu={(event) => event.preventDefault()}>
      <Canvas
        orthographic
        camera={{ position: [14, 12, 14], zoom: 48, near: CAMERA_NEAR, far: CAMERA_FAR }}
        dpr={[1, 1.75]}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
        onPointerMissed={clearSelection}
      >
        <SceneContent
          onAssetContextMenu={openMenu}
          onTransformInteractingChange={setTransformInteracting}
          isTransformInteracting={() => transformInteractingRef.current}
        />
      </Canvas>
      {menu && (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()}>
          <button onClick={() => menuAction(() => select(menu.id))}>Editar</button>
          <button onClick={() => menuAction(() => focus(menu.id))}>Centrar camara</button>
          <button className="danger" onClick={() => menuAction(() => remove(menu.id))}>Eliminar</button>
        </div>
      )}
      {layoutCalibration.active && <div className="calibration-banner">{calibrationMessage}</div>}
      {layoutCrop.active && <div className="calibration-banner">Crop activo: ajusta las cuatro esquinas del marco y aplica el recorte.</div>}
      {calibrationPendingDistance && (
        <div className="calibration-modal" onPointerDown={(event) => event.stopPropagation()}>
          <div className="calibration-dialog">
            <h3>Distancia real</h3>
            {currentCalibrationDistance !== null && <p>Distancia actual: {currentCalibrationDistance.toFixed(2)} m</p>}
            <label>
              <span>Metros</span>
              <input
                autoFocus
                type="number"
                min="0.01"
                step="0.01"
                value={calibrationDistanceInput}
                onChange={(event) => setCalibrationDistanceInput(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') confirmCalibrationDistance()
                  if (event.key === 'Escape') retrySecondCalibrationPoint()
                }}
              />
            </label>
            {calibrationError && <p className="error">{calibrationError}</p>}
            <div className="calibration-actions">
              <button onClick={confirmCalibrationDistance}>Confirmar</button>
              <button onClick={retrySecondCalibrationPoint}>Elegir P2 de nuevo</button>
              <button onClick={cancelLayoutCalibration}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
      <div className="scene-hint">Gizmo: mover / rotar / escalar - Handles: redimensionar - Click derecho: editar/eliminar - Camara libre</div>
    </div>
  )
}

function SceneContent({
  onAssetContextMenu,
  onTransformInteractingChange,
  isTransformInteracting,
}: {
  onAssetContextMenu: (id: string, x: number, y: number) => void
  onTransformInteractingChange: (active: boolean) => void
  isTransformInteracting: () => boolean
}) {
  const objects = useSceneStore((state) => state.objects)
  const selectedId = useSceneStore((state) => state.selectedObjectId)
  const selectedIds = useSceneStore((state) => state.selectedObjectIds)
  const editMode = useSceneStore((state) => state.editMode)
  const referenceLayout = useSceneStore((state) => state.referenceLayout)
  const snap = useSceneStore((state) => state.snap)
  const view = useSceneStore((state) => state.view)
  const focusRequest = useSceneStore((state) => state.focusRequest)
  const focusAreaRequest = useSceneStore((state) => state.focusAreaRequest)
  const cameraViewRequest = useSceneStore((state) => state.cameraViewRequest)
  const layoutCalibration = useSceneStore((state) => state.layoutCalibration)
  const layoutCrop = useSceneStore((state) => state.layoutCrop)
  const select = useSceneStore((state) => state.selectObject)
  const toggleSelection = useSceneStore((state) => state.toggleObjectSelection)
  const update = useSceneStore((state) => state.updateObject)
  const setLayoutCalibrationDraft = useSceneStore((state) => state.setLayoutCalibrationDraft)
  const updateLayoutCropDraft = useSceneStore((state) => state.updateLayoutCropDraft)
  const controlsRef = useRef<any>(null)
  const transformRef = useRef<any>(null)
  const multiTransformRef = useRef<any>(null)
  const layoutTransformRef = useRef<any>(null)
  const layoutGroupRef = useRef<THREE.Group | null>(null)
  const multiGroupRef = useRef<THREE.Group | null>(null)
  const objectRefs = useRef(new Map<string, THREE.Group>())
  const transformBaseRef = useRef<IndustrialAsset | null>(null)
  const multiTransformBaseRef = useRef<{ center: THREE.Vector3; positions: Map<string, THREE.Vector3> } | null>(null)
  const layoutScaleBaseRef = useRef<{ uniformScale: number; stretchWidth: number; stretchHeight: number } | null>(null)
  const lastCameraViewNonceRef = useRef<number | null>(null)
  const floorDragRef = useRef<{
    id: string
    plane: THREE.Plane
    offset: THREE.Vector3
  } | null>(null)
  const [targetObject, setTargetObject] = useState<THREE.Group | null>(null)
  const [multiTargetObject, setMultiTargetObject] = useState<THREE.Group | null>(null)
  const [layoutTargetObject, setLayoutTargetObject] = useState<THREE.Group | null>(null)
  const { camera, gl, size: viewportSize } = useThree()
  const colors = sceneColors[view.theme]
  const visibleObjects = useMemo(() => (
    view.areaFilter === AREA_FILTER_ALL ? objects : objects.filter((object) => object.areaCode === view.areaFilter)
  ), [objects, view.areaFilter])
  const selectedAssets = useMemo(() => selectedIds.map((id) => objects.find((object) => object.id === id)).filter(Boolean) as IndustrialAsset[], [objects, selectedIds])
  const selectedAsset = selectedId ? objects.find((object) => object.id === selectedId) ?? null : null
  const multiSelection = selectedAssets.length > 1
  const movableSelectedAssets = selectedAssets.filter((asset) => !asset.locked)
  const multiCenter = useMemo(() => combinedSelectionCenter(selectedAssets), [selectedAssets])
  const orbitMouseButtons = useMemo(
    () => getOrbitMouseButtons(layoutCrop.active, layoutCalibration.active),
    [layoutCalibration.active, layoutCrop.active],
  )

  useEffect(() => {
    if (!controlsRef.current) return
    controlsRef.current.mouseButtons = orbitMouseButtons
    controlsRef.current.enabled = true
    if (DEBUG_CROP_HANDLES) console.log('OrbitControls enabled', controlsRef.current.enabled)
    if (DEBUG_CALIBRATION_CAMERA) console.log('calibration controls', {
      calibrationMode: layoutCalibration.active,
      mouseButtons: { ...controlsRef.current.mouseButtons },
      enabled: controlsRef.current.enabled,
    })
  }, [layoutCalibration.active, orbitMouseButtons])

  useEffect(() => {
    if (!DEBUG_CAMERA_RIGHT_CLICK) return
    const logCamera = (label: 'RIGHT DOWN' | 'RIGHT UP') => (event: PointerEvent) => {
      if (event.button !== 2 || !controlsRef.current) return
      const orthoCamera = camera as THREE.OrthographicCamera
      console.log(label, {
        position: camera.position.toArray(),
        target: controlsRef.current.target.toArray(),
        distance: camera.position.distanceTo(controlsRef.current.target),
        zoom: orthoCamera.isOrthographicCamera ? orthoCamera.zoom : undefined,
        fov: (camera as THREE.PerspectiveCamera).isPerspectiveCamera ? (camera as THREE.PerspectiveCamera).fov : undefined,
        mouseButtons: { ...controlsRef.current.mouseButtons },
      })
    }
    const onDown = logCamera('RIGHT DOWN')
    const onUp = logCamera('RIGHT UP')
    gl.domElement.addEventListener('pointerdown', onDown)
    gl.domElement.addEventListener('pointerup', onUp)
    return () => {
      gl.domElement.removeEventListener('pointerdown', onDown)
      gl.domElement.removeEventListener('pointerup', onUp)
    }
  }, [camera, gl])
  const notifyTransformInteracting = (active: boolean) => {
    if (typeof onTransformInteractingChange === 'function') onTransformInteractingChange(active)
  }
  const transformIsInteracting = () => typeof isTransformInteracting === 'function' && isTransformInteracting()
  const updateLayout = useSceneStore((state) => state.updateLayout)
  const syncLayoutFromGroup = () => {
    const group = layoutGroupRef.current
    const layout = useSceneStore.getState().referenceLayout
    if (!group || !layout) return
    const groupScaleX = Math.min(1000, Math.max(0.01, group.scale.x))
    const groupScaleY = Math.min(1000, Math.max(0.01, group.scale.z))
    const base = layoutScaleBaseRef.current ?? {
      uniformScale: layout.uniformScale,
      stretchWidth: layout.stretchWidth,
      stretchHeight: layout.stretchHeight,
    }
    let uniformScale = layout.uniformScale
    let stretchWidth = base.stretchWidth * groupScaleX
    let stretchHeight = base.stretchHeight * groupScaleY
    if (layout.lockAspectRatio) {
      const factorX = groupScaleX
      const factorY = groupScaleY
      const factor = Math.abs(factorX - 1) >= Math.abs(factorY - 1) ? factorX : factorY
      uniformScale = Math.min(1000, Math.max(0.01, base.uniformScale * factor))
      stretchWidth = 1
      stretchHeight = 1
    }
    group.scale.set(1, 1, 1)
    updateLayout({
      position: { x: group.position.x, y: group.position.y, z: group.position.z },
      rotation: { x: group.rotation.x + Math.PI / 2, y: group.rotation.y, z: group.rotation.z },
      uniformScale,
      stretchWidth,
      stretchHeight,
    })
  }

  const guardedSelect = (id: string | null, additive = false) => {
    if (layoutCalibration.active) return
    if (layoutCrop.active) return
    if (transformIsInteracting()) return
    if (DEBUG_TRANSFORM) console.debug('[TransformControls] select', { before: useSceneStore.getState().selectedObjectId, next: id })
    if (!id) {
      select(null)
      return
    }
    if (additive) toggleSelection(id)
    else select(id)
  }

  const setOrbitEnabled = (enabled: boolean) => {
    const nextEnabled = enabled && !layoutCrop.active
    if (controlsRef.current) controlsRef.current.enabled = nextEnabled
    if (DEBUG_TRANSFORM) console.debug('[TransformControls] orbitControls.enabled', controlsRef.current?.enabled)
    if (DEBUG_CROP_HANDLES) console.log('OrbitControls enabled', nextEnabled)
  }

  const fitBox = useCallback((box: THREE.Box3, direction = camera.position.clone().sub(controlsRef.current?.target ?? new THREE.Vector3()).normalize(), up = new THREE.Vector3(0, 1, 0)) => {
    if (box.isEmpty()) return
    if (DEBUG_CAMERA_RIGHT_CLICK) console.log('fit camera request')
    const orthoCamera = camera as THREE.OrthographicCamera
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const safeDirection = direction.lengthSq() > 0.0001 ? direction.clone().normalize() : new THREE.Vector3(1, 1, 1).normalize()
    const distance = Math.max(size.length() * 2, 50)
    orthoCamera.near = CAMERA_NEAR
    orthoCamera.far = CAMERA_FAR
    orthoCamera.up.copy(up)
    orthoCamera.position.copy(center).addScaledVector(safeDirection, distance)
    orthoCamera.lookAt(center)
    orthoCamera.updateMatrixWorld(true)

    const corners = [
      new THREE.Vector3(box.min.x, box.min.y, box.min.z),
      new THREE.Vector3(box.min.x, box.min.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      new THREE.Vector3(box.max.x, box.min.y, box.min.z),
      new THREE.Vector3(box.max.x, box.min.y, box.max.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z),
    ].map((point) => point.applyMatrix4(orthoCamera.matrixWorldInverse))
    const min = new THREE.Vector2(Infinity, Infinity)
    const max = new THREE.Vector2(-Infinity, -Infinity)
    corners.forEach((point) => {
      min.x = Math.min(min.x, point.x)
      min.y = Math.min(min.y, point.y)
      max.x = Math.max(max.x, point.x)
      max.y = Math.max(max.y, point.y)
    })
    const width = Math.max(1, max.x - min.x)
    const height = Math.max(1, max.y - min.y)
    const zoomX = viewportSize.width / width
    const zoomY = viewportSize.height / height
    orthoCamera.zoom = Math.min(ORTHO_MAX_ZOOM, Math.max(ORTHO_MIN_ZOOM, Math.min(zoomX, zoomY) / 1.18))
    orthoCamera.updateProjectionMatrix()
    if (controlsRef.current) {
      controlsRef.current.target.copy(center)
      controlsRef.current.update()
    }
  }, [camera, viewportSize.height, viewportSize.width])

  const boundsForMode = useCallback((mode: string) => {
    const boxes: THREE.Box3[] = []
    if (mode === 'fit_layout') {
      if (referenceLayout?.visible) boxes.push(referenceLayoutBounds(referenceLayout))
      return combineBoxes(boxes)
    }
    if (mode === 'fit_selection') {
      selectedAssets.forEach((asset) => boxes.push(objectBounds(asset)))
      return combineBoxes(boxes)
    }
    visibleObjects.forEach((asset) => boxes.push(objectBounds(asset)))
    if (referenceLayout?.visible) boxes.push(referenceLayoutBounds(referenceLayout))
    return combineBoxes(boxes)
  }, [referenceLayout, selectedAssets, visibleObjects])

  const releaseTransforming = () => {
    notifyTransformInteracting(false)
    setOrbitEnabled(true)
  }

  const handleLayoutCalibrationPick = (point: ReferenceLayoutPoint) => {
    const layout = useSceneStore.getState().referenceLayout
    const draft = useSceneStore.getState().layoutCalibration
    if (!layout || !draft.active) return
    if (!draft.pointA) {
      if (DEBUG_CALIBRATION) console.log('pointA saved', point)
      setLayoutCalibrationDraft({ pointA: point })
      return
    }
    const pointA = draft.pointA
    const pointB = point
    if (DEBUG_CALIBRATION) console.log('pointB saved', pointB)
    setLayoutCalibrationDraft({ pointA, pointB })
  }

  const registerObjectRef = useCallback((id: string, node: THREE.Group | null) => {
    if (node) {
      node.name = id
      objectRefs.current.set(id, node)
    } else {
      objectRefs.current.delete(id)
    }
    if (id === useSceneStore.getState().selectedObjectId) {
      setTargetObject(node)
      if (DEBUG_TRANSFORM) console.debug('[TransformControls] ref', { id, exists: Boolean(node), uuid: node?.uuid })
    }
  }, [])

  useEffect(() => {
    if (!focusRequest) return
    const asset = useSceneStore.getState().objects.find((object) => object.id === focusRequest.id)
    if (!asset) return
    const target = { x: asset.position.x, y: asset.size.height / 2, z: asset.position.z }
    camera.position.set(target.x + 12, target.y + 10, target.z + 12)
    camera.lookAt(target.x, target.y, target.z)
    if (controlsRef.current) {
      controlsRef.current.target.set(target.x, target.y, target.z)
      controlsRef.current.update()
    }
  }, [camera, focusRequest])

  useEffect(() => {
    if (!focusAreaRequest) return
    const targets = focusAreaRequest.areaFilter === AREA_FILTER_ALL
      ? useSceneStore.getState().objects
      : useSceneStore.getState().objects.filter((object) => object.areaCode === focusAreaRequest.areaFilter)
    if (targets.length === 0) return
    const bounds = assetBounds(targets)
    const radius = Math.max(bounds.size.x, bounds.size.y, bounds.size.z, 4)
    camera.position.set(bounds.center.x + radius * 1.15, bounds.center.y + radius * 0.9, bounds.center.z + radius * 1.15)
    camera.lookAt(bounds.center.x, bounds.center.y, bounds.center.z)
    if (controlsRef.current) {
      controlsRef.current.target.set(bounds.center.x, bounds.center.y, bounds.center.z)
      controlsRef.current.update()
    }
  }, [camera, focusAreaRequest])

  useEffect(() => {
    if (!cameraViewRequest) return
    if (lastCameraViewNonceRef.current === cameraViewRequest.nonce) return
    lastCameraViewNonceRef.current = cameraViewRequest.nonce
    const isoDirection = new THREE.Vector3(1, 0.85, 1).normalize()
    if (cameraViewRequest.mode === 'isometric') {
      const box = boundsForMode('fit_all') ?? new THREE.Box3(new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 10, 10))
      fitBox(box, isoDirection, new THREE.Vector3(0, 1, 0))
      return
    }
    if (cameraViewRequest.mode === 'top') {
      const box = boundsForMode('fit_all') ?? new THREE.Box3(new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 10, 10))
      fitBox(box, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1))
      return
    }
    const box = boundsForMode(cameraViewRequest.mode)
    if (box) fitBox(box)
  }, [boundsForMode, cameraViewRequest, fitBox])

  useEffect(() => {
    if (!selectedId) {
      setTargetObject(null)
      return
    }
    const exists = visibleObjects.some((object) => object.id === selectedId)
    if (!exists) {
      select(null)
      setTargetObject(null)
      return
    }
    const nextTarget = objectRefs.current.get(selectedId) ?? null
    setTargetObject(nextTarget)
    if (DEBUG_TRANSFORM) console.debug('[TransformControls] attach target', { id: selectedId, exists: Boolean(nextTarget), uuid: nextTarget?.uuid })
  }, [selectedId, visibleObjects, select])

  useEffect(() => {
    const group = multiGroupRef.current
    if (!group || !multiSelection) return
    group.position.copy(multiCenter)
    setMultiTargetObject(group)
  }, [multiCenter, multiSelection])

  useEffect(() => () => {
    releaseTransforming()
  }, [])

  const syncFromTransform = (commitScale = false) => {
    if (!selectedId || !targetObject) return
    const current = useSceneStore.getState().objects.find((object) => object.id === selectedId)
    if (!current) {
      select(null)
      return
    }

    if (editMode === 'scale') {
      if (!commitScale) return
      const base = transformBaseRef.current ?? current
      const next = {
        ...base,
        size: {
          width: Math.max(0.1, finiteOr(base.size.width * Math.abs(targetObject.scale.x), base.size.width)),
          height: Math.max(0.1, finiteOr(base.size.height * Math.abs(targetObject.scale.y), base.size.height)),
          depth: Math.max(0.1, finiteOr(base.size.depth * Math.abs(targetObject.scale.z), base.size.depth)),
        },
      }
      next.position.y = next.size.height / 2
      targetObject.scale.set(1, 1, 1)
      update(selectedId, snapAsset(next, snap))
      transformBaseRef.current = null
      return
    }

    const next = {
      ...current,
      position: {
        x: finiteOr(targetObject.position.x, current.position.x),
        y: finiteOr(targetObject.position.y, current.position.y),
        z: finiteOr(targetObject.position.z, current.position.z),
      },
      rotation: {
        x: finiteOr(targetObject.rotation.x, current.rotation.x),
        y: finiteOr(targetObject.rotation.y, current.rotation.y),
        z: finiteOr(targetObject.rotation.z, current.rotation.z),
      },
    }

    const hasChanged =
      changed(next.position.x, current.position.x) ||
      changed(next.position.y, current.position.y) ||
      changed(next.position.z, current.position.z) ||
      changed(next.rotation.x, current.rotation.x) ||
      changed(next.rotation.y, current.rotation.y) ||
      changed(next.rotation.z, current.rotation.z)

    if (hasChanged) update(selectedId, snapAsset(next, snap))
  }

  const beginMultiTransform = () => {
    if (!multiTargetObject || movableSelectedAssets.length === 0) return
    const positions = new Map<string, THREE.Vector3>()
    movableSelectedAssets.forEach((asset) => {
      positions.set(asset.id, new THREE.Vector3(asset.position.x, asset.position.y, asset.position.z))
    })
    multiTransformBaseRef.current = { center: multiTargetObject.position.clone(), positions }
  }

  const syncFromMultiTransform = () => {
    const base = multiTransformBaseRef.current
    if (!base || !multiTargetObject) return
    const delta = multiTargetObject.position.clone().sub(base.center)
    base.positions.forEach((position, id) => {
      const current = useSceneStore.getState().objects.find((object) => object.id === id)
      if (!current || current.locked) return
      update(id, snapAsset({
        ...current,
        position: {
          x: finiteOr(position.x + delta.x, current.position.x),
          y: finiteOr(position.y + delta.y, current.position.y),
          z: finiteOr(position.z + delta.z, current.position.z),
        },
      }, snap))
    })
  }

  useEffect(() => {
    const controls = transformRef.current
    if (!controls?.addEventListener) return
    const onDraggingChanged = (event: { value: boolean }) => {
      if (DEBUG_TRANSFORM) console.debug('[TransformControls] dragging-changed', event.value, { selectedObjectId: useSceneStore.getState().selectedObjectId })
      notifyTransformInteracting(event.value)
      setOrbitEnabled(!event.value)
      if (!event.value) syncFromTransform(true)
    }
    controls.addEventListener('dragging-changed', onDraggingChanged)
    return () => {
      controls.removeEventListener?.('dragging-changed', onDraggingChanged)
      releaseTransforming()
    }
  }, [targetObject, selectedId, editMode, snap])

  useEffect(() => {
    const controls = multiTransformRef.current
    if (!controls?.addEventListener) return
    const onDraggingChanged = (event: { value: boolean }) => {
      notifyTransformInteracting(event.value)
      setOrbitEnabled(!event.value)
      if (!event.value) {
        syncFromMultiTransform()
        multiTransformBaseRef.current = null
        if (multiGroupRef.current) multiGroupRef.current.position.copy(combinedSelectionCenter(useSceneStore.getState().objects.filter((object) => useSceneStore.getState().selectedObjectIds.includes(object.id))))
      }
    }
    controls.addEventListener('dragging-changed', onDraggingChanged)
    return () => {
      controls.removeEventListener?.('dragging-changed', onDraggingChanged)
      releaseTransforming()
    }
  }, [multiTargetObject, selectedIds, snap])

  useEffect(() => {
    const controls = layoutTransformRef.current
    if (!controls?.addEventListener) return
    const onDraggingChanged = (event: { value: boolean }) => {
      notifyTransformInteracting(event.value)
      setOrbitEnabled(!event.value)
      if (!event.value && layoutGroupRef.current) {
        syncLayoutFromGroup()
        layoutScaleBaseRef.current = null
      }
    }
    controls.addEventListener('dragging-changed', onDraggingChanged)
    return () => {
      controls.removeEventListener?.('dragging-changed', onDraggingChanged)
      releaseTransforming()
    }
  }, [referenceLayout, updateLayout])

  const hitOnPlane = (event: { ray: THREE.Ray }, plane: THREE.Plane) => {
    const hit = new THREE.Vector3()
    return event.ray.intersectPlane(plane, hit) ? hit : null
  }

  const beginFloorDrag = (asset: IndustrialAsset, event: any) => {
    if (layoutCalibration.active || layoutCrop.active) return
    if (event.ctrlKey || event.shiftKey || event.metaKey || multiSelection) return
    if (event.button !== 0 || editMode !== 'move' || asset.locked) return
    event.stopPropagation()
    select(asset.id)
    notifyTransformInteracting(true)
    setOrbitEnabled(false)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -asset.position.y)
    const hit = hitOnPlane(event, plane)
    floorDragRef.current = {
      id: asset.id,
      plane,
      offset: hit ? hit.clone().sub(new THREE.Vector3(asset.position.x, asset.position.y, asset.position.z)) : new THREE.Vector3(),
    }
    event.target?.setPointerCapture?.(event.pointerId)
    if (DEBUG_TRANSFORM) console.debug('[TransformControls] floor drag start', { id: asset.id })
  }

  const moveFloorDrag = (event: any) => {
    const drag = floorDragRef.current
    if (!drag) return
    event.stopPropagation()
    const current = useSceneStore.getState().objects.find((object) => object.id === drag.id)
    if (!current || current.locked) return
    const hit = hitOnPlane(event, drag.plane)
    if (!hit) return
    update(drag.id, snapAsset({
      ...current,
      position: {
        x: finiteOr(hit.x - drag.offset.x, current.position.x),
        y: current.size.height / 2,
        z: finiteOr(hit.z - drag.offset.z, current.position.z),
      },
    }, snap))
  }

  const endFloorDrag = (event: any) => {
    if (!floorDragRef.current) return
    event.stopPropagation()
    if (DEBUG_TRANSFORM) console.debug('[TransformControls] floor drag end', { id: floorDragRef.current.id })
    floorDragRef.current = null
    releaseTransforming()
    event.target?.releasePointerCapture?.(event.pointerId)
  }

  return (
    <>
      <color attach="background" args={[colors.background]} />
      <ambientLight intensity={2.1} />
      <directionalLight position={[12, 18, 10]} intensity={1.25} />
      <hemisphereLight args={['#d8edf8', '#303942', 1.1]} />
      <Floor color={colors.floor} onClearSelection={() => guardedSelect(null)} />
      <gridHelper args={[GRID_SIZE, GRID_DIVISIONS, colors.gridCenter, colors.grid]} position={[0, 0.022, 0]} />
      {referenceLayout?.visible && (
        <ReferenceLayoutPlane
          ref={(node) => { layoutGroupRef.current = node; setLayoutTargetObject(node) }}
          layout={referenceLayout}
          calibrationActive={layoutCalibration.active}
          cropActive={layoutCrop.active}
          cropDraft={layoutCrop.draft}
          calibrationPointA={layoutCalibration.pointA ?? referenceLayout.calibration.pointA}
          calibrationPointB={layoutCalibration.pointB ?? referenceLayout.calibration.pointB}
          onCalibrationPick={handleLayoutCalibrationPick}
          onCropDraftChange={updateLayoutCropDraft}
          onCropDraggingChange={(dragging) => {
            if (controlsRef.current) controlsRef.current.enabled = !dragging
            if (DEBUG_CROP_HANDLES) console.log('OrbitControls enabled', controlsRef.current?.enabled)
          }}
        />
      )}
      <axesHelper args={[3]} position={[-10, 0.03, 8]} />
      {visibleObjects.map((asset) => (
        <SceneAsset
          key={asset.id}
          asset={asset}
          selected={selectedIds.includes(asset.id)}
          registerObjectRef={registerObjectRef}
          onSelect={(event) => guardedSelect(asset.id, event.ctrlKey || event.shiftKey || event.metaKey)}
          view={view}
          onContextMenu={(id, x, y) => onAssetContextMenu(id, x, y)}
          onPointerDown={(event) => beginFloorDrag(asset, event)}
          onPointerMove={moveFloorDrag}
          onPointerUp={endFloorDrag}
        />
      ))}
      {multiSelection && (
        <group ref={(node) => {
          multiGroupRef.current = node
          setMultiTargetObject(node)
          if (node) node.position.copy(multiCenter)
        }} />
      )}
      {selectedAsset && targetObject && !multiSelection && !selectedAsset.locked && editMode !== 'rotate' && !view.editLayout && !layoutCalibration.active && !layoutCrop.active && (
        <TransformControls
          ref={transformRef}
          object={targetObject}
          mode={editMode === 'move' ? 'translate' : editMode}
          size={1.2}
          space="world"
          showX
          showY
          showZ
          translationSnap={snap.enabled ? positiveOr(snap.gridSize, 0.5) : undefined}
          rotationSnap={snap.enabled ? (positiveOr(snap.rotationDegrees, 15) * Math.PI) / 180 : undefined}
          scaleSnap={snap.enabled ? positiveOr(snap.scaleStep, 0.1) : undefined}
          onObjectChange={(event) => {
            ;(event as any)?.stopPropagation?.()
            syncFromTransform(editMode !== 'scale')
            if (DEBUG_TRANSFORM) {
              console.debug('[TransformControls] objectChange', {
                axis: transformRef.current?.axis,
                selectedObjectId: useSceneStore.getState().selectedObjectId,
                position: targetObject.position.toArray(),
              })
            }
          }}
          onMouseDown={(event) => {
            ;(event as any)?.stopPropagation?.()
            notifyTransformInteracting(true)
            transformBaseRef.current = structuredClone(selectedAsset)
            setOrbitEnabled(false)
            if (DEBUG_TRANSFORM) console.debug('[TransformControls] mouseDown', { axis: transformRef.current?.axis, id: selectedAsset.id, uuid: targetObject.uuid })
          }}
          onMouseUp={(event) => {
            ;(event as any)?.stopPropagation?.()
            syncFromTransform(true)
            releaseTransforming()
            if (DEBUG_TRANSFORM) console.debug('[TransformControls] mouseUp', { selectedAfter: useSceneStore.getState().selectedObjectId })
          }}
        />
      )}
      {multiSelection && multiTargetObject && movableSelectedAssets.length > 0 && editMode === 'move' && !view.editLayout && !layoutCalibration.active && !layoutCrop.active && (
        <TransformControls
          ref={multiTransformRef}
          object={multiTargetObject}
          mode="translate"
          size={1.35}
          space="world"
          showX
          showY
          showZ
          translationSnap={snap.enabled ? positiveOr(snap.gridSize, 0.5) : undefined}
          onObjectChange={(event) => {
            ;(event as any)?.stopPropagation?.()
            syncFromMultiTransform()
          }}
          onMouseDown={(event) => {
            ;(event as any)?.stopPropagation?.()
            notifyTransformInteracting(true)
            beginMultiTransform()
            setOrbitEnabled(false)
          }}
          onMouseUp={(event) => {
            ;(event as any)?.stopPropagation?.()
            syncFromMultiTransform()
            multiTransformBaseRef.current = null
            releaseTransforming()
          }}
        />
      )}
      {selectedAsset && targetObject && !multiSelection && !selectedAsset.locked && editMode === 'rotate' && !view.editLayout && !layoutCalibration.active && !layoutCrop.active && (
        <YRotationHandle
          asset={selectedAsset}
          snap={snap}
          onRotate={(rotation) => update(selectedAsset.id, snapAsset({ ...selectedAsset, rotation }, snap))}
          setOrbitEnabled={setOrbitEnabled}
          setTransformInteracting={notifyTransformInteracting}
        />
      )}
      {selectedAsset && targetObject && !multiSelection && view.showResizeHandles && editMode === 'scale' && !selectedAsset.locked && !transformIsInteracting() && !view.editLayout && !layoutCalibration.active && !layoutCrop.active && (
        <ResizeHandles
          asset={selectedAsset}
          snap={snap}
          onResize={(resizeUpdate) => update(selectedAsset.id, snapAsset({ ...selectedAsset, ...resizeUpdate }, snap))}
          setOrbitEnabled={setOrbitEnabled}
        />
      )}
      {referenceLayout?.visible && view.editLayout && !referenceLayout.locked && layoutTargetObject && !layoutCalibration.active && !layoutCrop.active && (
        <TransformControls
          ref={layoutTransformRef}
          object={layoutTargetObject}
          mode={editMode === 'move' ? 'translate' : editMode}
          size={1.1}
          space="world"
          showX
          showY={editMode === 'rotate'}
          showZ
          onObjectChange={(event) => {
            ;(event as any)?.stopPropagation?.()
            syncLayoutFromGroup()
          }}
          onMouseDown={(event) => {
            ;(event as any)?.stopPropagation?.()
            notifyTransformInteracting(true)
            layoutScaleBaseRef.current = {
              uniformScale: referenceLayout.uniformScale,
              stretchWidth: referenceLayout.stretchWidth,
              stretchHeight: referenceLayout.stretchHeight,
            }
            setOrbitEnabled(false)
          }}
          onMouseUp={(event) => {
            ;(event as any)?.stopPropagation?.()
            syncLayoutFromGroup()
            layoutScaleBaseRef.current = null
            releaseTransforming()
          }}
        />
      )}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minZoom={ORTHO_MIN_ZOOM}
        maxZoom={ORTHO_MAX_ZOOM}
        enabled
        mouseButtons={orbitMouseButtons as any}
      />
      <GizmoHelper alignment="bottom-right" margin={[72, 72]}><GizmoViewport labelColor="white" axisHeadScale={0.8} /></GizmoHelper>
    </>
  )
}

function SceneAsset({
  asset,
  selected,
  registerObjectRef,
  onSelect,
  view,
  onContextMenu,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  asset: IndustrialAsset
  selected: boolean
  registerObjectRef: (id: string, node: THREE.Group | null) => void
  onSelect: (event: any) => void
  view: ReturnType<typeof useSceneStore.getState>['view']
  onContextMenu: (id: string, x: number, y: number) => void
  onPointerDown: (event: any) => void
  onPointerMove: (event: any) => void
  onPointerUp: (event: any) => void
}) {
  const setObjectRef = useCallback((node: THREE.Group | null) => {
    registerObjectRef(asset.id, node)
  }, [asset.id, registerObjectRef])

  const openContextMenu = (event: any) => {
    event.stopPropagation()
    preventIfCancelable(event.nativeEvent as Event)
    onContextMenu(asset.id, event.nativeEvent?.clientX ?? 0, event.nativeEvent?.clientY ?? 0)
  }

  return (
    <IndustrialObject
      ref={setObjectRef}
      asset={asset}
      selected={selected}
      view={view}
      onSelect={onSelect}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={openContextMenu}
    />
  )
}

const ReferenceLayoutPlane = ReactForwardRef(function ReferenceLayoutPlane(
  {
    layout,
    calibrationActive,
    cropActive,
    cropDraft,
    calibrationPointA,
    calibrationPointB,
    onCalibrationPick,
    onCropDraftChange,
    onCropDraggingChange,
  }: {
    layout: ReferenceLayout
    calibrationActive: boolean
    cropActive: boolean
    cropDraft?: ReferenceLayout['crop']
    calibrationPointA?: ReferenceLayoutPoint
    calibrationPointB?: ReferenceLayoutPoint
    onCalibrationPick: (point: ReferenceLayoutPoint) => void
    onCropDraftChange: (crop: ReferenceLayout['crop']) => void
    onCropDraggingChange: (dragging: boolean) => void
  },
  ref: React.ForwardedRef<THREE.Group>,
) {
  const texture = useMemo(() => layout.textureDataUrl ? new THREE.TextureLoader().load(layout.textureDataUrl) : null, [layout.textureDataUrl])
  const calibrationPointerRef = useRef<{ x: number; y: number; uv?: THREE.Vector2 } | null>(null)
  const rootGroupRef = useRef<THREE.Group | null>(null)
  const cropPointerRef = useRef<{
    handle: CropHandle
  } | null>(null)
  const baseHeight = layout.baseWidth / Math.max(0.0001, layout.aspectRatio)
  const activeCrop = cropActive ? cropDraft ?? layout.crop : layout.crop
  const crop = activeCrop.enabled || cropActive ? activeCrop : { enabled: false, uMin: 0, vMin: 0, uMax: 1, vMax: 1 }
  const fullWidth = layout.baseWidth * layout.uniformScale * (layout.lockAspectRatio ? 1 : layout.stretchWidth)
  const fullHeight = baseHeight * layout.uniformScale * (layout.lockAspectRatio ? 1 : layout.stretchHeight)
  const renderedCrop = cropActive
    ? { enabled: false, uMin: 0, vMin: 0, uMax: 1, vMax: 1 }
    : crop
  const renderedU = renderedCrop.enabled ? Math.max(0.01, renderedCrop.uMax - renderedCrop.uMin) : 1
  const renderedV = renderedCrop.enabled ? Math.max(0.01, renderedCrop.vMax - renderedCrop.vMin) : 1
  const finalWidth = fullWidth * renderedU
  const finalHeight = fullHeight * renderedV
  const cropCenterU = (crop.uMin + crop.uMax) / 2
  const cropCenterV = (crop.vMin + crop.vMax) / 2
  const cropOffset = new THREE.Vector3((cropCenterU - 0.5) * fullWidth, (cropCenterV - 0.5) * fullHeight, 0)
  const renderedCenterU = renderedCrop.enabled ? (renderedCrop.uMin + renderedCrop.uMax) / 2 : 0.5
  const renderedCenterV = renderedCrop.enabled ? (renderedCrop.vMin + renderedCrop.vMax) / 2 : 0.5
  const renderedOffset = new THREE.Vector3((renderedCenterU - 0.5) * fullWidth, (renderedCenterV - 0.5) * fullHeight, 0)
  const geometry = useMemo(() => new THREE.PlaneGeometry(finalWidth, finalHeight), [finalWidth, finalHeight])
  const pointVisible = (point?: ReferenceLayoutPoint) => point && point.u >= crop.uMin && point.u <= crop.uMax && point.v >= crop.vMin && point.v <= crop.vMax
  const pointA = pointVisible(calibrationPointA) ? uvToLayoutLocal(calibrationPointA!, fullWidth, fullHeight) : null
  const pointB = pointVisible(calibrationPointB) ? uvToLayoutLocal(calibrationPointB!, fullWidth, fullHeight) : null
  useEffect(() => () => texture?.dispose(), [texture])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => {
    if (cropActive && DEBUG_CROP_HANDLES) console.log('cropMode iniciado', 'cropDraft inicial', crop)
    return () => { document.body.style.cursor = 'default' }
  }, [cropActive])
  useEffect(() => {
    if (!texture) return
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.offset.set(renderedCrop.enabled ? renderedCrop.uMin : 0, renderedCrop.enabled ? renderedCrop.vMin : 0)
    texture.repeat.set(renderedU, renderedV)
    texture.needsUpdate = true
  }, [renderedCrop.enabled, renderedCrop.uMin, renderedCrop.vMin, renderedU, renderedV, texture])

  if (!texture) return null
  if (DEBUG_LAYOUT_SCALE) {
    console.log({
      naturalWidth: layout.naturalWidth,
      naturalHeight: layout.naturalHeight,
      aspectRatio: layout.aspectRatio,
      baseWidth: layout.baseWidth,
      baseHeight,
      uniformScale: layout.uniformScale,
      finalWidth,
      finalHeight,
      renderedRatio: finalWidth / finalHeight,
    })
  }

  return (
    <group
      ref={(node) => {
        rootGroupRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      position={[layout.position.x, layout.position.y, layout.position.z]}
      rotation={[-Math.PI / 2 + layout.rotation.x, layout.rotation.y, layout.rotation.z]}
      userData={{ referenceLayout: true }}
    >
      <mesh
        name="reference-layout-calibration-plane"
        position={renderedOffset}
        raycast={calibrationActive || cropActive ? THREE.Mesh.prototype.raycast : disabledRaycast}
        renderOrder={1}
        onPointerDown={(event) => {
          if (!calibrationActive && !cropActive) return
          if (cropActive) return
          if (!calibrationActive) return
          const native = event.nativeEvent as PointerEvent
          if (DEBUG_CALIBRATION_CAMERA) console.log('calibration layout pointerDown', { button: native.button })
          if (native.button !== 0) {
            if (DEBUG_CALIBRATION_CAMERA && native.button === 2) console.log('click derecho propagado')
            return
          }
          event.stopPropagation()
          event.nativeEvent?.stopImmediatePropagation?.()
          preventIfCancelable(native)
          if (DEBUG_CALIBRATION_CAMERA) console.log('click izquierdo capturado')
          calibrationPointerRef.current = {
            x: native.clientX,
            y: native.clientY,
            uv: event.uv?.clone(),
          }
          if (DEBUG_CALIBRATION) console.log('layout pointerDown', {
            uv: event.uv,
            point: event.point,
            object: event.object.name,
          })
        }}
        onPointerUp={(event) => {
          if (!calibrationActive && !cropActive) return
          if (cropActive) return
          const native = event.nativeEvent as PointerEvent
          if (native.button !== 0) return
          event.stopPropagation()
          event.nativeEvent?.stopImmediatePropagation?.()
          const start = calibrationPointerRef.current
          calibrationPointerRef.current = null
          if (!start) return
          const moved = Math.hypot(native.clientX - start.x, native.clientY - start.y)
          if (moved > DRAG_THRESHOLD_PX) return
          const uv = event.uv ?? start.uv
          if (!uv) {
            if (DEBUG_CALIBRATION) console.log('layout click without uv', { point: event.point, object: event.object.name })
            return
          }
          if (DEBUG_CALIBRATION) console.log('layout calibration click', {
            uv,
            point: event.point,
            object: event.object.name,
          })
          onCalibrationPick({ u: uv.x, v: uv.y })
        }}
      >
        <primitive object={geometry} attach="geometry" />
        <meshBasicMaterial map={texture} transparent opacity={layout.opacity} depthWrite={false} depthTest toneMapped={false} />
      </mesh>
      {cropActive && (
        <CropEditor
          crop={crop}
          fullWidth={fullWidth}
          fullHeight={fullHeight}
          offset={cropOffset}
          dragRef={cropPointerRef}
          rootGroupRef={rootGroupRef}
          onChange={onCropDraftChange}
          onDraggingChange={onCropDraggingChange}
        />
      )}
      {pointA && <CalibrationMarker position={pointA} color="#f59e0b" />}
      {pointB && <CalibrationMarker position={pointB} color="#38bdf8" />}
      {pointA && pointB && <CalibrationLine start={pointA} end={pointB} />}
    </group>
  )
})

function CalibrationMarker({ position, color }: { position: THREE.Vector3; color: string }) {
  return (
    <mesh position={position} raycast={() => null} renderOrder={3}>
      <sphereGeometry args={[0.16, 16, 8]} />
      <meshBasicMaterial color={color} depthTest={false} />
    </mesh>
  )
}

function CalibrationLine({ start, end }: { start: THREE.Vector3; end: THREE.Vector3 }) {
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints([start, end]), [start, end])
  const material = useMemo(() => new THREE.LineBasicMaterial({ color: '#f8fafc', depthTest: false }), [])
  const line = useMemo(() => {
    const object = new THREE.Line(geometry, material)
    object.raycast = () => undefined
    object.renderOrder = 2
    return object
  }, [geometry, material])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  return <primitive object={line} />
}

type CropHandle = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'

const MIN_CROP_SIZE = 0.01
const CROP_HANDLE_VISIBLE_RADIUS_PX = 9
const CROP_HANDLE_INNER_RADIUS_PX = 6
const CROP_HANDLE_HIT_RADIUS_PX = 16

const CROP_HANDLE_LABELS: Record<CropHandle, string> = {
  topLeft: 'Arrastrar esquina superior izquierda',
  topRight: 'Arrastrar esquina superior derecha',
  bottomLeft: 'Arrastrar esquina inferior izquierda',
  bottomRight: 'Arrastrar esquina inferior derecha',
}

/**
 * PlaneGeometry maps local -Y to v=0 (visual bottom) and local +Y to v=1
 * (visual top). Texture.flipY only corrects image sampling; it does not change
 * this crop-coordinate convention. Crop bounds therefore always use
 * vMin=bottom and vMax=top.
 */
function getVisualCropPointFromRay(
  ray: THREE.Ray,
  root: THREE.Group,
  fullWidth: number,
  fullHeight: number,
) {
  root.updateWorldMatrix(true, false)
  const planeOrigin = root.localToWorld(new THREE.Vector3(0, 0, 0))
  const planeNormal = new THREE.Vector3(0, 0, 1).transformDirection(root.matrixWorld)
  const hit = ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, planeOrigin), new THREE.Vector3())
  if (!hit) return null
  const local = root.worldToLocal(hit)
  const rawUvY = THREE.MathUtils.clamp(local.y / fullHeight + 0.5, 0, 1)
  return {
    u: THREE.MathUtils.clamp(local.x / fullWidth + 0.5, 0, 1),
    v: rawUvY,
    rawUvY,
    visualV: rawUvY,
  }
}

function CropEditor({
  crop,
  fullWidth,
  fullHeight,
  offset,
  dragRef,
  rootGroupRef,
  onChange,
  onDraggingChange,
}: {
  crop: ReferenceLayout['crop']
  fullWidth: number
  fullHeight: number
  offset: THREE.Vector3
  dragRef: { current: { handle: CropHandle } | null }
  rootGroupRef: { current: THREE.Group | null }
  onChange: (crop: ReferenceLayout['crop']) => void
  onDraggingChange: (dragging: boolean) => void
}) {
  const { camera, size: viewportSize } = useThree()
  const currentCropRef = useRef(crop)
  currentCropRef.current = crop
  const handleGroupRefs = useRef(new Map<CropHandle, THREE.Group>())
  const [hoveredHandle, setHoveredHandle] = useState<CropHandle | null>(null)
  const [draggingHandle, setDraggingHandle] = useState<CropHandle | null>(null)
  const cropWidth = (crop.uMax - crop.uMin) * fullWidth
  const cropHeight = (crop.vMax - crop.vMin) * fullHeight
  const handlePositions: Record<CropHandle, [number, number, number]> = {
    topLeft: [(crop.uMin - 0.5) * fullWidth, (crop.vMax - 0.5) * fullHeight, 0.14],
    topRight: [(crop.uMax - 0.5) * fullWidth, (crop.vMax - 0.5) * fullHeight, 0.14],
    bottomLeft: [(crop.uMin - 0.5) * fullWidth, (crop.vMin - 0.5) * fullHeight, 0.14],
    bottomRight: [(crop.uMax - 0.5) * fullWidth, (crop.vMin - 0.5) * fullHeight, 0.14],
  }

  useFrame(() => {
    const safeViewportHeight = Math.max(1, viewportSize.height)
    handleGroupRefs.current.forEach((group) => {
      const parentWorldQuaternion = group.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion()
      const cameraWorldQuaternion = camera.getWorldQuaternion(new THREE.Quaternion())
      group.quaternion.copy(parentWorldQuaternion.invert().multiply(cameraWorldQuaternion))
      let worldUnitsPerPixel: number
      if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
        const ortho = camera as THREE.OrthographicCamera
        worldUnitsPerPixel = (ortho.top - ortho.bottom) / Math.max(0.0001, ortho.zoom) / safeViewportHeight
      } else {
        const perspective = camera as THREE.PerspectiveCamera
        const worldPosition = group.getWorldPosition(new THREE.Vector3())
        const distance = Math.max(0.0001, camera.position.distanceTo(worldPosition))
        worldUnitsPerPixel = (2 * distance * Math.tan(THREE.MathUtils.degToRad(perspective.fov) / 2)) / safeViewportHeight
      }
      group.scale.setScalar(worldUnitsPerPixel)
    })
  })

  const eventUv = (event: any) => {
    const root = rootGroupRef.current
    if (!root || !event.ray) return null
    return getVisualCropPointFromRay(event.ray, root, fullWidth, fullHeight)
  }

  const endDrag = (event: any) => {
    if (!dragRef.current) return
    event.stopPropagation()
    event.nativeEvent?.stopImmediatePropagation?.()
    ;(event.target as Element | null)?.releasePointerCapture?.(event.pointerId)
    ;(event.nativeEvent?.target as Element | null)?.releasePointerCapture?.(event.pointerId)
    if (DEBUG_CROP_HANDLES) console.log('pointerUp', dragRef.current.handle)
    dragRef.current = null
    setDraggingHandle(null)
    onDraggingChange(false)
  }

  const beginDrag = (handle: CropHandle) => (event: any) => {
    if ((event.nativeEvent as PointerEvent).button !== 0) return
    event.stopPropagation()
    event.nativeEvent?.stopImmediatePropagation?.()
    event.nativeEvent?.preventDefault?.()
    const uv = eventUv(event)
    if (!uv) return
    ;(event.target as Element | null)?.setPointerCapture?.(event.pointerId)
    ;(event.nativeEvent?.target as Element | null)?.setPointerCapture?.(event.pointerId)
    dragRef.current = { handle }
    setDraggingHandle(handle)
    onDraggingChange(true)
    if (DEBUG_CROP_HANDLES) console.log('handle seleccionado', handle, 'cropDraft inicial', crop)
  }

  const moveDrag = (event: any) => {
    const active = dragRef.current
    if (!active) return
    event.stopPropagation()
    event.nativeEvent?.stopImmediatePropagation?.()
    const uv = eventUv(event)
    if (!uv) return
    const previous = currentCropRef.current
    const next = { ...previous, enabled: true }
    switch (active.handle) {
      case 'topLeft':
        next.uMin = THREE.MathUtils.clamp(uv.u, 0, previous.uMax - MIN_CROP_SIZE)
        next.vMax = THREE.MathUtils.clamp(uv.visualV, previous.vMin + MIN_CROP_SIZE, 1)
        break
      case 'topRight':
        next.uMax = THREE.MathUtils.clamp(uv.u, previous.uMin + MIN_CROP_SIZE, 1)
        next.vMax = THREE.MathUtils.clamp(uv.visualV, previous.vMin + MIN_CROP_SIZE, 1)
        break
      case 'bottomLeft':
        next.uMin = THREE.MathUtils.clamp(uv.u, 0, previous.uMax - MIN_CROP_SIZE)
        next.vMin = THREE.MathUtils.clamp(uv.visualV, 0, previous.vMax - MIN_CROP_SIZE)
        break
      case 'bottomRight':
        next.uMax = THREE.MathUtils.clamp(uv.u, previous.uMin + MIN_CROP_SIZE, 1)
        next.vMin = THREE.MathUtils.clamp(uv.visualV, 0, previous.vMax - MIN_CROP_SIZE)
        break
    }
    if (DEBUG_CROP_VERTICAL) {
      const bottomHandle = active.handle === 'bottomLeft' || active.handle === 'bottomRight'
      console.log(bottomHandle ? {
        rawUvY: uv.rawUvY,
        visualV: uv.visualV,
        activeHandle: active.handle,
        previousBottom: previous.vMin,
        newBottom: next.vMin,
        top: previous.vMax,
        valid: next.vMin < previous.vMax,
      } : {
        rawUvY: uv.rawUvY,
        visualV: uv.visualV,
        activeHandle: active.handle,
        previousTop: previous.vMax,
        newTop: next.vMax,
        bottom: previous.vMin,
        valid: next.vMax > previous.vMin,
      })
    }
    if (DEBUG_CROP_HANDLES) console.log('UV recibida', uv, 'cropDraft actualizado', next)
    onChange(next)
  }

  const overlayMaterial = <meshBasicMaterial color="#020617" transparent opacity={0.58} depthTest={false} depthWrite={false} />
  const leftWidth = crop.uMin * fullWidth
  const rightWidth = (1 - crop.uMax) * fullWidth
  const selectedWidth = Math.max(0, crop.uMax - crop.uMin) * fullWidth
  const bottomHeight = crop.vMin * fullHeight
  const topHeight = (1 - crop.vMax) * fullHeight

  return (
    <group>
      {leftWidth > 0 && <mesh position={[-fullWidth / 2 + leftWidth / 2, 0, 0.1]} renderOrder={5} raycast={() => null}><planeGeometry args={[leftWidth, fullHeight]} />{overlayMaterial}</mesh>}
      {rightWidth > 0 && <mesh position={[fullWidth / 2 - rightWidth / 2, 0, 0.1]} renderOrder={5} raycast={() => null}><planeGeometry args={[rightWidth, fullHeight]} />{overlayMaterial}</mesh>}
      {bottomHeight > 0 && <mesh position={[offset.x, -fullHeight / 2 + bottomHeight / 2, 0.1]} renderOrder={5} raycast={() => null}><planeGeometry args={[selectedWidth, bottomHeight]} />{overlayMaterial}</mesh>}
      {topHeight > 0 && <mesh position={[offset.x, fullHeight / 2 - topHeight / 2, 0.1]} renderOrder={5} raycast={() => null}><planeGeometry args={[selectedWidth, topHeight]} />{overlayMaterial}</mesh>}
      <CropFrame width={cropWidth} height={cropHeight} offset={offset} />
      {(Object.keys(handlePositions) as CropHandle[]).map((handle) => (
        <group
          key={handle}
          ref={(node) => {
            if (node) handleGroupRefs.current.set(handle, node)
            else handleGroupRefs.current.delete(handle)
          }}
          position={handlePositions[handle]}
          scale={0.01}
        >
          <mesh renderOrder={10} raycast={() => null}>
            <circleGeometry args={[CROP_HANDLE_VISIBLE_RADIUS_PX + (draggingHandle === handle ? 2 : hoveredHandle === handle ? 1 : 0), 24]} />
            <meshBasicMaterial color="#f59e0b" depthTest={false} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0, 0.01]} renderOrder={11} raycast={() => null}>
            <circleGeometry args={[CROP_HANDLE_INNER_RADIUS_PX, 24]} />
            <meshBasicMaterial color={draggingHandle === handle ? '#f59e0b' : '#111827'} depthTest={false} depthWrite={false} />
          </mesh>
          <mesh
            position={[0, 0, 0.02]}
            renderOrder={12}
            onPointerDown={beginDrag(handle)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerOver={(event) => {
              event.stopPropagation()
              setHoveredHandle(handle)
              document.body.style.cursor = handle === 'topLeft' || handle === 'bottomRight' ? 'nwse-resize' : 'nesw-resize'
              ;(event.nativeEvent?.target as Element | null)?.setAttribute?.('title', CROP_HANDLE_LABELS[handle])
            }}
            onPointerOut={(event) => {
              setHoveredHandle((current) => current === handle ? null : current)
              ;(event.nativeEvent?.target as Element | null)?.removeAttribute?.('title')
              if (!dragRef.current) document.body.style.cursor = 'default'
            }}
          >
            <circleGeometry args={[CROP_HANDLE_HIT_RADIUS_PX, 24]} />
            <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} colorWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function CropFrame({ width, height, offset }: { width: number; height: number; offset: THREE.Vector3 }) {
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-width / 2, -height / 2, 0.09),
    new THREE.Vector3(width / 2, -height / 2, 0.09),
    new THREE.Vector3(width / 2, height / 2, 0.09),
    new THREE.Vector3(-width / 2, height / 2, 0.09),
    new THREE.Vector3(-width / 2, -height / 2, 0.09),
  ]), [height, width])
  const material = useMemo(() => new THREE.LineBasicMaterial({ color: '#f59e0b', depthTest: false, linewidth: 2 }), [])
  const line = useMemo(() => {
    const object = new THREE.Line(geometry, material)
    object.raycast = () => undefined
    object.renderOrder = 4
    return object
  }, [geometry, material])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  return <primitive object={line} position={offset} />
}

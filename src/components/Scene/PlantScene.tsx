import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { GizmoHelper, GizmoViewport, OrbitControls, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { useSceneStore } from '../../store/sceneStore'
import type { IndustrialAsset } from '../../types/plant'
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
const DEBUG_TRANSFORM = false

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

export function PlantScene() {
  const select = useSceneStore((state) => state.selectObject)
  const focus = useSceneStore((state) => state.focusObject)
  const remove = useSceneStore((state) => state.deleteObject)
  const transformInteractingRef = useRef(false)
  const transformReleaseTimerRef = useRef<number | null>(null)
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)

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

  return (
    <div className="scene" onContextMenu={(event) => event.preventDefault()}>
      <Canvas
        orthographic
        camera={{ position: [14, 12, 14], zoom: 48, near: 0.1, far: 2500 }}
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
  const layout = useSceneStore((state) => state.layout)
  const snap = useSceneStore((state) => state.snap)
  const view = useSceneStore((state) => state.view)
  const focusRequest = useSceneStore((state) => state.focusRequest)
  const select = useSceneStore((state) => state.selectObject)
  const toggleSelection = useSceneStore((state) => state.toggleObjectSelection)
  const update = useSceneStore((state) => state.updateObject)
  const controlsRef = useRef<any>(null)
  const transformRef = useRef<any>(null)
  const multiTransformRef = useRef<any>(null)
  const multiGroupRef = useRef<THREE.Group | null>(null)
  const objectRefs = useRef(new Map<string, THREE.Group>())
  const transformBaseRef = useRef<IndustrialAsset | null>(null)
  const multiTransformBaseRef = useRef<{ center: THREE.Vector3; positions: Map<string, THREE.Vector3> } | null>(null)
  const floorDragRef = useRef<{
    id: string
    plane: THREE.Plane
    offset: THREE.Vector3
  } | null>(null)
  const [targetObject, setTargetObject] = useState<THREE.Group | null>(null)
  const [multiTargetObject, setMultiTargetObject] = useState<THREE.Group | null>(null)
  const { camera } = useThree()
  const colors = sceneColors[view.theme]
  const selectedAssets = useMemo(() => selectedIds.map((id) => objects.find((object) => object.id === id)).filter(Boolean) as IndustrialAsset[], [objects, selectedIds])
  const selectedAsset = selectedId ? objects.find((object) => object.id === selectedId) ?? null : null
  const multiSelection = selectedAssets.length > 1
  const movableSelectedAssets = selectedAssets.filter((asset) => !asset.locked)
  const multiCenter = useMemo(() => combinedSelectionCenter(selectedAssets), [selectedAssets])
  const notifyTransformInteracting = (active: boolean) => {
    if (typeof onTransformInteractingChange === 'function') onTransformInteractingChange(active)
  }
  const transformIsInteracting = () => typeof isTransformInteracting === 'function' && isTransformInteracting()

  const guardedSelect = (id: string | null, additive = false) => {
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
    if (controlsRef.current) controlsRef.current.enabled = enabled
    if (DEBUG_TRANSFORM) console.debug('[TransformControls] orbitControls.enabled', controlsRef.current?.enabled)
  }

  const releaseTransforming = () => {
    notifyTransformInteracting(false)
    setOrbitEnabled(true)
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
    if (!selectedId) {
      setTargetObject(null)
      return
    }
    const exists = objects.some((object) => object.id === selectedId)
    if (!exists) {
      select(null)
      setTargetObject(null)
      return
    }
    const nextTarget = objectRefs.current.get(selectedId) ?? null
    setTargetObject(nextTarget)
    if (DEBUG_TRANSFORM) console.debug('[TransformControls] attach target', { id: selectedId, exists: Boolean(nextTarget), uuid: nextTarget?.uuid })
  }, [selectedId, objects, select])

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

  const hitOnPlane = (event: { ray: THREE.Ray }, plane: THREE.Plane) => {
    const hit = new THREE.Vector3()
    return event.ray.intersectPlane(plane, hit) ? hit : null
  }

  const beginFloorDrag = (asset: IndustrialAsset, event: any) => {
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
      <Floor layout={layout} color={colors.floor} onClearSelection={() => guardedSelect(null)} />
      <gridHelper args={[GRID_SIZE, GRID_DIVISIONS, colors.gridCenter, colors.grid]} position={[0, 0.022, 0]} />
      <axesHelper args={[3]} position={[-10, 0.03, 8]} />
      {objects.map((asset) => (
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
      {selectedAsset && targetObject && !multiSelection && !selectedAsset.locked && editMode !== 'rotate' && (
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
      {multiSelection && multiTargetObject && movableSelectedAssets.length > 0 && editMode === 'move' && (
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
      {selectedAsset && targetObject && !multiSelection && !selectedAsset.locked && editMode === 'rotate' && (
        <YRotationHandle
          asset={selectedAsset}
          snap={snap}
          onRotate={(rotation) => update(selectedAsset.id, snapAsset({ ...selectedAsset, rotation }, snap))}
          setOrbitEnabled={setOrbitEnabled}
          setTransformInteracting={notifyTransformInteracting}
        />
      )}
      {selectedAsset && targetObject && !multiSelection && view.showResizeHandles && editMode === 'scale' && !selectedAsset.locked && !transformIsInteracting() && (
        <ResizeHandles
          asset={selectedAsset}
          snap={snap}
          onResize={(resizeUpdate) => update(selectedAsset.id, snapAsset({ ...selectedAsset, ...resizeUpdate }, snap))}
          setOrbitEnabled={setOrbitEnabled}
        />
      )}
      <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.08} minZoom={18} maxZoom={140} />
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
    event.nativeEvent?.preventDefault()
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

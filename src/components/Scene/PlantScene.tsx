import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { GizmoHelper, GizmoViewport, OrbitControls, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { useSceneStore } from '../../store/sceneStore'
import type { IndustrialAsset } from '../../types/plant'
import { Floor } from './Floor'
import { IndustrialObject } from './IndustrialObject'

const roundTo = (value: number, step: number) => step > 0 ? Math.round(value / step) * step : value
const changed = (a: number, b: number) => Math.abs(a - b) > 0.0005
const finiteOr = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback
const positiveOr = (value: number, fallback: number) => Number.isFinite(value) && value > 0 ? value : fallback

function snapAsset(asset: IndustrialAsset, snap = useSceneStore.getState().snap): IndustrialAsset {
  if (!snap.enabled) return asset
  const gridSize = positiveOr(snap.gridSize, 0.5)
  const rotationStep = (positiveOr(snap.rotationDegrees, 15) * Math.PI) / 180
  const scaleStep = positiveOr(snap.scaleStep, 0.1)
  return {
    ...asset,
    position: {
      x: roundTo(finiteOr(asset.position.x, 0), gridSize),
      y: asset.size.height / 2,
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

export function PlantScene() {
  const select = useSceneStore((state) => state.selectObject)
  const focus = useSceneStore((state) => state.focusObject)
  const remove = useSceneStore((state) => state.deleteObject)
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)

  useEffect(() => {
    const close = () => setMenu(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
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
        camera={{ position: [14, 12, 14], zoom: 48, near: 0.1, far: 300 }}
        dpr={[1, 1.75]}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
        onPointerMissed={() => {
          select(null)
          setMenu(null)
        }}
      >
        <SceneContent onAssetContextMenu={openMenu} />
      </Canvas>
      {menu && (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()}>
          <button onClick={() => menuAction(() => select(menu.id))}>Editar</button>
          <button onClick={() => menuAction(() => focus(menu.id))}>Centrar camara</button>
          <button className="danger" onClick={() => menuAction(() => remove(menu.id))}>Eliminar</button>
        </div>
      )}
      <div className="scene-hint">Arrastrar objeto: mover X/Z - Click derecho: editar/eliminar - Camara libre fuera del arrastre</div>
    </div>
  )
}

function SceneContent({ onAssetContextMenu }: { onAssetContextMenu: (id: string, x: number, y: number) => void }) {
  const objects = useSceneStore((state) => state.objects)
  const selectedId = useSceneStore((state) => state.selectedObjectId)
  const editMode = useSceneStore((state) => state.editMode)
  const layout = useSceneStore((state) => state.layout)
  const snap = useSceneStore((state) => state.snap)
  const view = useSceneStore((state) => state.view)
  const focusRequest = useSceneStore((state) => state.focusRequest)
  const select = useSceneStore((state) => state.selectObject)
  const update = useSceneStore((state) => state.updateObject)
  const controlsRef = useRef<any>(null)
  const { camera } = useThree()
  const gridSize = positiveOr(snap.gridSize, 0.5)
  const gridDivisions = Math.max(2, Math.round(80 / gridSize))

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

  return (
    <>
      <color attach="background" args={['#1b2228']} />
      <ambientLight intensity={2.1} />
      <directionalLight position={[12, 18, 10]} intensity={1.25} />
      <hemisphereLight args={['#d8edf8', '#303942', 1.1]} />
      <Floor layout={layout} onClearSelection={() => select(null)} />
      <gridHelper args={[80, gridDivisions, '#63717c', '#3b4650']} position={[0, 0.022, 0]} />
      <axesHelper args={[3]} position={[-10, 0.03, 8]} />
      {objects.map((asset) => (
        <SceneAsset
          key={asset.id}
          asset={asset}
          selected={selectedId === asset.id}
          onSelect={() => select(asset.id)}
          onChange={(next) => update(asset.id, snapAsset(next))}
          editMode={editMode}
          snap={snap}
          view={view}
          orbitControls={controlsRef}
          onContextMenu={(id, x, y) => onAssetContextMenu(id, x, y)}
        />
      ))}
      <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.08} minZoom={18} maxZoom={140} />
      <GizmoHelper alignment="bottom-right" margin={[72, 72]}><GizmoViewport labelColor="white" axisHeadScale={0.8} /></GizmoHelper>
    </>
  )
}

function SceneAsset({
  asset,
  selected,
  onSelect,
  onChange,
  editMode,
  snap,
  view,
  orbitControls,
  onContextMenu,
}: {
  asset: IndustrialAsset
  selected: boolean
  onSelect: () => void
  onChange: (asset: IndustrialAsset) => void
  editMode: 'move' | 'rotate' | 'scale'
  snap: ReturnType<typeof useSceneStore.getState>['snap']
  view: ReturnType<typeof useSceneStore.getState>['view']
  orbitControls: React.MutableRefObject<any>
  onContextMenu: (id: string, x: number, y: number) => void
}) {
  const objectRef = useRef<THREE.Group | null>(null)
  const transformRef = useRef<any>(null)
  const draggingRef = useRef(false)
  const dragPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const dragOffsetRef = useRef(new THREE.Vector3())
  const [targetObject, setTargetObject] = useState<THREE.Group | null>(null)
  const baseAssetRef = useRef<IndustrialAsset | null>(null)
  const setObjectRef = useCallback((node: THREE.Group | null) => {
    objectRef.current = node
    setTargetObject(node)
  }, [])

  useEffect(() => {
    const controls = transformRef.current
    if (!controls?.traverse) return
    controls.traverse((child: any) => {
      const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : []
      materials.forEach((material: any) => {
        if (typeof material?.opacity === 'number' && material.opacity <= 0.16) {
          material.visible = false
          material.depthWrite = false
          material.needsUpdate = true
        }
      })
    })
  }, [targetObject, editMode])

  useEffect(() => () => {
    if (orbitControls.current) orbitControls.current.enabled = true
  }, [orbitControls])

  const setOrbitEnabled = (enabled: boolean) => {
    if (orbitControls.current) orbitControls.current.enabled = enabled
  }

  const pointerHitOnDragPlane = (event: { ray: THREE.Ray }) => {
    const hit = new THREE.Vector3()
    return event.ray.intersectPlane(dragPlaneRef.current, hit) ? hit : null
  }

  const beginDirectMove = (event: any) => {
    if (event.button !== 0 || editMode !== 'move') return
    event.stopPropagation()
    onSelect()
    draggingRef.current = true
    setOrbitEnabled(false)

    dragPlaneRef.current.set(new THREE.Vector3(0, 1, 0), -asset.position.y)
    const hit = pointerHitOnDragPlane(event)
    if (hit) dragOffsetRef.current.copy(hit).sub(new THREE.Vector3(asset.position.x, asset.position.y, asset.position.z))

    event.target?.setPointerCapture?.(event.pointerId)
  }

  const directMove = (event: any) => {
    if (!draggingRef.current || editMode !== 'move') return
    event.stopPropagation()
    const hit = pointerHitOnDragPlane(event)
    if (!hit) return

    const next = {
      ...asset,
      position: {
        x: finiteOr(hit.x - dragOffsetRef.current.x, asset.position.x),
        y: asset.size.height / 2,
        z: finiteOr(hit.z - dragOffsetRef.current.z, asset.position.z),
      },
    }
    onChange(next)
  }

  const endDirectMove = (event: any) => {
    if (!draggingRef.current) return
    event.stopPropagation()
    draggingRef.current = false
    setOrbitEnabled(true)
    event.target?.releasePointerCapture?.(event.pointerId)
  }

  const openContextMenu = (event: any) => {
    event.stopPropagation()
    event.nativeEvent?.preventDefault()
    onContextMenu(asset.id, event.nativeEvent?.clientX ?? 0, event.nativeEvent?.clientY ?? 0)
  }

  const syncFromObject = (commitScale = false) => {
    const object = objectRef.current
    if (!object) return

    if (editMode === 'scale') {
      if (!commitScale) return
      const base = baseAssetRef.current ?? asset
      const next = {
        ...base,
        size: {
          width: Math.max(0.1, finiteOr(base.size.width * Math.abs(object.scale.x), base.size.width)),
          height: Math.max(0.1, finiteOr(base.size.height * Math.abs(object.scale.y), base.size.height)),
          depth: Math.max(0.1, finiteOr(base.size.depth * Math.abs(object.scale.z), base.size.depth)),
        },
      }
      next.position.y = next.size.height / 2
      object.scale.set(1, 1, 1)
      onChange(next)
      baseAssetRef.current = null
      return
    }

    const next = {
      ...asset,
      position: { x: finiteOr(object.position.x, asset.position.x), y: asset.size.height / 2, z: finiteOr(object.position.z, asset.position.z) },
      rotation: { x: asset.rotation.x, y: finiteOr(object.rotation.y, asset.rotation.y), z: asset.rotation.z },
    }

    const hasChanged =
      changed(next.position.x, asset.position.x) ||
      changed(next.position.z, asset.position.z) ||
      changed(next.rotation.y, asset.rotation.y)

    if (hasChanged) onChange(next)
  }

  const transform = targetObject && editMode !== 'move' ? (
    <TransformControls
      ref={transformRef}
      object={targetObject}
      mode={editMode}
      size={0.82}
      space="world"
      showX={editMode !== 'rotate'}
      showY
      showZ={editMode !== 'rotate'}
      translationSnap={snap.enabled ? positiveOr(snap.gridSize, 0.5) : undefined}
      rotationSnap={snap.enabled ? (positiveOr(snap.rotationDegrees, 15) * Math.PI) / 180 : undefined}
      scaleSnap={snap.enabled ? positiveOr(snap.scaleStep, 0.1) : undefined}
      onObjectChange={() => syncFromObject(false)}
      onMouseDown={() => {
        baseAssetRef.current = structuredClone(asset)
        setOrbitEnabled(false)
      }}
      onMouseUp={() => {
        setOrbitEnabled(true)
        syncFromObject(true)
      }}
    />
  ) : null

  return (
    <>
      <IndustrialObject
        ref={setObjectRef}
        asset={asset}
        selected={selected}
        view={view}
        onSelect={onSelect}
        onPointerDown={beginDirectMove}
        onPointerMove={directMove}
        onPointerUp={endDirectMove}
        onContextMenu={openContextMenu}
      />
      {selected && transform}
    </>
  )
}

import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { DEFAULT_PLANT_LEVELS, LEVEL_0, LEVEL_1, MULTI_LEVEL, type PlantLevelCode } from '../src/config/plantLevels'
import { getIndustrialAssetWorldTransform, getReferenceLayoutStoredPositionFromWorld, getReferenceLayoutWorldTransform } from '../src/services/sceneWorldTransformService'
import type { IndustrialAsset, ReferenceLayout } from '../src/types/plant'

function layoutAtLevel(levelCode: typeof LEVEL_0 | typeof LEVEL_1): ReferenceLayout {
  return {
    levelCode,
    positionMode: 'level-relative',
    layoutPath: 'layout.png',
    fileName: 'layout.png',
    mimeType: 'image/png',
    widthPx: 100,
    heightPx: 50,
    naturalWidth: 100,
    naturalHeight: 50,
    aspectRatio: 2,
    baseWidth: 20,
    baseHeight: 10,
    uniformScale: 1,
    stretchWidth: 1,
    stretchHeight: 1,
    position: { x: 4, y: 0.035, z: -8 },
    rotation: { x: 0.1, y: 0.2, z: 0.3 },
    opacity: 0.4,
    visible: true,
    locked: false,
    lockAspectRatio: true,
    calibration: { calibrated: false },
    crop: { enabled: false, uMin: 0, vMin: 0, uMax: 1, vMax: 1 },
    missing: false,
  }
}

describe('reference layout world transform', () => {
  it('applies the configured level elevation exactly once', () => {
    expect(getReferenceLayoutWorldTransform(layoutAtLevel(LEVEL_0), DEFAULT_PLANT_LEVELS).position.y).toBeCloseTo(0.045, 12)
    expect(getReferenceLayoutWorldTransform(layoutAtLevel(LEVEL_1), DEFAULT_PLANT_LEVELS).position.y).toBeCloseTo(6.045, 12)
  })

  it('does not depend on active or visible level filters', () => {
    const transform = getReferenceLayoutWorldTransform(layoutAtLevel(LEVEL_1), DEFAULT_PLANT_LEVELS)
    expect(transform.rotation).toEqual({ x: -Math.PI / 2 + 0.1, y: 0.2, z: 0.3 })
    expect(transform.scale).toEqual({ x: 1, y: 1, z: 1 })
  })

  it('round-trips layout editing without introducing a vertical offset', () => {
    const layout = layoutAtLevel(LEVEL_1)
    const world = getReferenceLayoutWorldTransform(layout, DEFAULT_PLANT_LEVELS)
    const stored = getReferenceLayoutStoredPositionFromWorld(world.position, layout, DEFAULT_PLANT_LEVELS)
    expect(stored.x).toBe(layout.position.x)
    expect(stored.y).toBeCloseTo(layout.position.y, 12)
    expect(stored.z).toBe(layout.position.z)
  })
})

describe('industrial asset world transform', () => {
  it.each([LEVEL_0, LEVEL_1, MULTI_LEVEL])('treats %s as metadata and preserves the same matrix', (levelCode: PlantLevelCode) => {
    const asset = {
      levelCode,
      position: { x: 12.5, y: 6.75, z: -3.25 },
      rotation: { x: 0.1, y: 1.2, z: -0.4 },
      uniformScale: 1.35,
    } as IndustrialAsset
    const transform = getIndustrialAssetWorldTransform(asset)
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(transform.position.x, transform.position.y, transform.position.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(transform.rotation.x, transform.rotation.y, transform.rotation.z)),
      new THREE.Vector3(transform.scale.x, transform.scale.y, transform.scale.z),
    )
    const expected = new THREE.Matrix4().compose(
      new THREE.Vector3(12.5, 6.75, -3.25),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 1.2, -0.4)),
      new THREE.Vector3(1.35, 1.35, 1.35),
    )

    expect(matrix.elements).toEqual(expected.elements)
  })
})

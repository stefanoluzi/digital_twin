import {
  LEVEL_0,
  LEVEL_1,
  REFERENCE_LAYOUT_Y_OFFSET,
  getLevelElevation,
  type PlantLevelDefinition,
} from '../config/plantLevels'
import type { IndustrialAsset, ReferenceLayout, Vector3Data } from '../types/plant'

export interface SceneWorldTransform {
  position: Vector3Data
  rotation: Vector3Data
  scale: Vector3Data
}

/** Asset transforms are already world-space; levelCode is classification only. */
export function getIndustrialAssetWorldTransform(
  asset: Pick<IndustrialAsset, 'position' | 'rotation' | 'uniformScale'>,
): SceneWorldTransform {
  return {
    position: { ...asset.position },
    rotation: { ...asset.rotation },
    scale: { x: asset.uniformScale, y: asset.uniformScale, z: asset.uniformScale },
  }
}

/** The canonical reference-layout transform shared by every application mode. */
export function getReferenceLayoutWorldTransform(
  layout: ReferenceLayout,
  plantLevels: PlantLevelDefinition[],
): SceneWorldTransform {
  const levelCode = layout.levelCode === LEVEL_0 ? LEVEL_0 : LEVEL_1
  const levelElevation = getLevelElevation(plantLevels, levelCode)

  return {
    position: {
      x: layout.position.x,
      y: levelElevation + layout.position.y + REFERENCE_LAYOUT_Y_OFFSET,
      z: layout.position.z,
    },
    rotation: {
      x: -Math.PI / 2 + layout.rotation.x,
      y: layout.rotation.y,
      z: layout.rotation.z,
    },
    scale: { x: 1, y: 1, z: 1 },
  }
}

export function getReferenceLayoutStoredPositionFromWorld(
  worldPosition: Vector3Data,
  layout: ReferenceLayout,
  plantLevels: PlantLevelDefinition[],
): Vector3Data {
  const levelCode = layout.levelCode === LEVEL_0 ? LEVEL_0 : LEVEL_1
  const levelElevation = getLevelElevation(plantLevels, levelCode)

  return {
    x: worldPosition.x,
    y: worldPosition.y - levelElevation - REFERENCE_LAYOUT_Y_OFFSET,
    z: worldPosition.z,
  }
}

import * as THREE from 'three'
import type { IndustrialAsset } from '../types/plant'
import type { VisualPreset, VisualTheme } from './visualTheme'

export type IndustrialMaterialRole =
  | 'metalStructure'
  | 'machineBody'
  | 'roller'
  | 'shaft'
  | 'motor'
  | 'tank'
  | 'darkMechanical'
  | 'safety'
  | 'concrete'

export interface IndustrialMaterialProfile {
  roughness: number
  metalness: number
  envMapIntensity: number
}

export const INDUSTRIAL_MATERIALS: Record<IndustrialMaterialRole, IndustrialMaterialProfile> = {
  metalStructure: { roughness: 0.72, metalness: 0.28, envMapIntensity: 0.5 },
  machineBody: { roughness: 0.68, metalness: 0.22, envMapIntensity: 0.45 },
  roller: { roughness: 0.5, metalness: 0.56, envMapIntensity: 0.6 },
  shaft: { roughness: 0.44, metalness: 0.64, envMapIntensity: 0.65 },
  motor: { roughness: 0.66, metalness: 0.22, envMapIntensity: 0.45 },
  tank: { roughness: 0.62, metalness: 0.3, envMapIntensity: 0.5 },
  darkMechanical: { roughness: 0.58, metalness: 0.44, envMapIntensity: 0.5 },
  safety: { roughness: 0.74, metalness: 0.12, envMapIntensity: 0.35 },
  concrete: { roughness: 0.94, metalness: 0.02, envMapIntensity: 0.2 },
}

const STRUCTURE_TYPES = new Set(['platform', 'stairs', 'handrail', 'column', 'pipe_rack_simple', 'bancal', 'rail_bed_multi'])
const ROLLER_TYPES = new Set(['roller_table_flat', 'roller_table_biconical', 'cooling_bed'])
const SHAFT_TYPES = new Set(['coupling', 'cardan_shaft', 'transmission_shaft'])
const MOTOR_TYPES = new Set(['electric_motor_horizontal', 'electric_motor_vertical', 'motor_gearbox_parallel', 'piercer_drive'])
const TANK_TYPES = new Set(['tank_horizontal', 'tank_vertical', 'rectangular_pool', 'hydraulic_power_unit'])
const CONCRETE_TYPES = new Set(['foundation', 'concrete_base'])

interface MaterialOriginals {
  roughness: number
  metalness: number
  envMapIntensity: number
}

function materialRole(assetType: IndustrialAsset['type'], material: THREE.MeshStandardMaterial): IndustrialMaterialRole {
  const hsl = { h: 0, s: 0, l: 0 }
  material.color.clone().convertLinearToSRGB().getHSL(hsl)
  if (hsl.s > 0.42 && hsl.h >= 0.09 && hsl.h <= 0.19) return 'safety'
  if (hsl.l < 0.2) return 'darkMechanical'
  if (CONCRETE_TYPES.has(assetType)) return 'concrete'
  if (SHAFT_TYPES.has(assetType)) return 'shaft'
  if (ROLLER_TYPES.has(assetType)) return 'roller'
  if (MOTOR_TYPES.has(assetType)) return 'motor'
  if (TANK_TYPES.has(assetType)) return 'tank'
  if (STRUCTURE_TYPES.has(assetType)) return 'metalStructure'
  return 'machineBody'
}

function meshImportance(mesh: THREE.Mesh) {
  const geometry = mesh.geometry
  if (!geometry.boundingSphere) geometry.computeBoundingSphere()
  const radius = geometry.boundingSphere?.radius ?? 0
  const scale = mesh.getWorldScale(new THREE.Vector3())
  return radius * Math.max(scale.x, scale.y, scale.z)
}

export function applyIndustrialPresentation(
  root: THREE.Object3D,
  assetType: IndustrialAsset['type'],
  preset: VisualPreset,
  theme: VisualTheme,
) {
  const meshes: THREE.Mesh[] = []
  root.updateWorldMatrix(true, true)
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || child.userData.excludeFromAlignmentBounds) return
    meshes.push(child)
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue
      if (!material.userData.industrialOriginals) {
        material.userData.industrialOriginals = {
          roughness: material.roughness,
          metalness: material.metalness,
          envMapIntensity: material.envMapIntensity,
        } satisfies MaterialOriginals
      }
      const original = material.userData.industrialOriginals as MaterialOriginals
      if (preset === 'EDITOR') {
        material.roughness = original.roughness
        material.metalness = original.metalness
        material.envMapIntensity = original.envMapIntensity
      } else {
        const profile = INDUSTRIAL_MATERIALS[materialRole(assetType, material)]
        material.roughness = profile.roughness
        material.metalness = profile.metalness
        material.envMapIntensity = profile.envMapIntensity
      }
      material.needsUpdate = true
    }
  })

  const casters = preset === 'DIGITAL_TWIN'
    ? new Set(meshes
      .filter((mesh) => {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        return materials.some((material) => material.visible && material.opacity > 0.25 && !('wireframe' in material && material.wireframe))
      })
      .sort((left, right) => meshImportance(right) - meshImportance(left))
      .slice(0, theme.shadows.maxCastersPerAsset))
    : null

  for (const mesh of meshes) {
    if (mesh.userData.industrialOriginalCastShadow === undefined) mesh.userData.industrialOriginalCastShadow = mesh.castShadow
    if (mesh.userData.industrialOriginalReceiveShadow === undefined) mesh.userData.industrialOriginalReceiveShadow = mesh.receiveShadow
    mesh.castShadow = preset === 'DIGITAL_TWIN' ? Boolean(casters?.has(mesh)) : Boolean(mesh.userData.industrialOriginalCastShadow)
    mesh.receiveShadow = preset === 'DIGITAL_TWIN' ? true : Boolean(mesh.userData.industrialOriginalReceiveShadow)
  }
}

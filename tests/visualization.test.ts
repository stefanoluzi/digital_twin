import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { applyIndustrialPresentation, INDUSTRIAL_MATERIALS } from '../src/visualization/industrialMaterials'
import { DIGITAL_TWIN_THEME, EDITOR_VISUAL_THEME, getVisualTheme } from '../src/visualization/visualTheme'
import { getAreaBoundingBox, getLabelLOD, getScenePresentationLevel, shouldShowLabel } from '../src/visualization/presentationLOD'
import type { IndustrialAsset } from '../src/types/plant'

function asset(id: string, areaCode: IndustrialAsset['areaCode'], type: IndustrialAsset['type'] = 'box'): IndustrialAsset {
  return {
    id,
    name: id,
    type,
    area: areaCode,
    areaCode,
    levelCode: 'LEVEL_1',
    system: '',
    position: { x: 10, y: 6.5, z: -4 },
    rotation: { x: 0, y: 0, z: 0 },
    size: { width: 4, height: 2, depth: 6 },
    uniformScale: 2,
    params: {},
    color: '#607d8b',
    criticality: '',
    locked: false,
    tags: [],
    description: '',
    dataSources: { plcTag: '', sapEquipmentId: '', grafanaUrl: '', powerBiUrl: '', documentsUrl: '', photosUrl: '', failureHistory: '' },
  }
}

describe('visualization presets', () => {
  it('keeps Digital Twin presentation centralized and Editor conservative', () => {
    expect(getVisualTheme('DIGITAL_TWIN')).toBe(DIGITAL_TWIN_THEME)
    expect(DIGITAL_TWIN_THEME.background).not.toBe('#ffffff')
    expect(DIGITAL_TWIN_THEME.shadows.enabled).toBe(true)
    expect(DIGITAL_TWIN_THEME.renderer.toneMapping).toBe('ACES')
    expect(EDITOR_VISUAL_THEME.shadows.enabled).toBe(false)
    expect(Object.keys(INDUSTRIAL_MATERIALS)).toEqual(expect.arrayContaining([
      'metalStructure', 'machineBody', 'roller', 'shaft', 'motor', 'tank', 'darkMechanical', 'safety', 'concrete',
    ]))
  })

  it('preserves manual color and restores original material settings in Editor', () => {
    const originalColor = '#2d7180'
    const material = new THREE.MeshStandardMaterial({ color: originalColor, roughness: 0.81, metalness: 0.07 })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), material)
    mesh.castShadow = false
    mesh.receiveShadow = false
    const root = new THREE.Group()
    root.add(mesh)

    applyIndustrialPresentation(root, 'electric_motor_horizontal', 'DIGITAL_TWIN', DIGITAL_TWIN_THEME)
    expect(material.color.getHexString()).toBe(originalColor.slice(1))
    expect(material.roughness).toBe(INDUSTRIAL_MATERIALS.motor.roughness)
    expect(material.metalness).toBe(INDUSTRIAL_MATERIALS.motor.metalness)
    expect(mesh.castShadow).toBe(true)
    expect(mesh.receiveShadow).toBe(true)

    applyIndustrialPresentation(root, 'electric_motor_horizontal', 'EDITOR', EDITOR_VISUAL_THEME)
    expect(material.color.getHexString()).toBe(originalColor.slice(1))
    expect(material.roughness).toBe(0.81)
    expect(material.metalness).toBe(0.07)
    expect(mesh.castShadow).toBe(false)
    expect(mesh.receiveShadow).toBe(false)

    mesh.geometry.dispose()
    material.dispose()
  })

  it('maps camera scale to centralized presentation and label LOD levels', () => {
    expect(getScenePresentationLevel({ orthographicZoom: 4 })).toBe('OVERVIEW')
    expect(getScenePresentationLevel({ orthographicZoom: 30 })).toBe('AREA')
    expect(getScenePresentationLevel({ orthographicZoom: 90 })).toBe('DETAIL')
    expect(getLabelLOD('OVERVIEW')).toBe('IMPORTANT')
    expect(getLabelLOD('AREA')).toBe('NEARBY')
    expect(getLabelLOD('DETAIL')).toBe('ALL')
  })

  it('keeps selected, hovered and alert labels while suppressing repetitive labels from afar', () => {
    const normal = asset('MOTOR_001', 'HG', 'electric_motor_horizontal')
    const repeated = asset('CADENA_FORADOS_COPY_2', 'HG', 'chain_bed')
    expect(shouldShowLabel({ asset: normal, labelLOD: 'IMPORTANT', labelsEnabled: true })).toBe(false)
    expect(shouldShowLabel({ asset: normal, labelLOD: 'IMPORTANT', labelsEnabled: false, selected: true })).toBe(true)
    expect(shouldShowLabel({ asset: normal, labelLOD: 'IMPORTANT', labelsEnabled: false, hovered: true })).toBe(true)
    expect(shouldShowLabel({ asset: normal, labelLOD: 'IMPORTANT', labelsEnabled: true, maintenanceStatus: 'OVERDUE' })).toBe(true)
    expect(shouldShowLabel({ asset: repeated, labelLOD: 'NEARBY', labelsEnabled: true, focusedAreaCode: 'HG' })).toBe(false)
    expect(shouldShowLabel({ asset: normal, labelLOD: 'NEARBY', labelsEnabled: true, focusedAreaCode: 'HG' })).toBe(true)
    expect(shouldShowLabel({ asset: normal, labelLOD: 'ALL', labelsEnabled: true, focusedAreaCode: 'COBA' })).toBe(false)
  })

  it('computes area bounds without mutating asset transforms', () => {
    const first = asset('A', 'HG')
    const second = { ...asset('B', 'COBA'), position: { x: 100, y: 2, z: 100 } }
    const originalPosition = { ...first.position }
    const bounds = getAreaBoundingBox([first, second], 'HG')
    expect(bounds).toEqual({
      min: { x: 6, y: 4.5, z: -10 },
      max: { x: 14, y: 8.5, z: 2 },
      center: { x: 10, y: 6.5, z: -4 },
      size: { x: 8, y: 4, z: 12 },
      count: 1,
    })
    expect(first.position).toEqual(originalPosition)
  })
})

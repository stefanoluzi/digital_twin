import { describe, expect, it } from 'vitest'
import { normalizeMaintenanceData } from '../src/maintenance/data/maintenanceNormalizer'
import { normalizeProjectFile } from '../src/services/projectSerializer'

describe('legacy normalization', () => {
  it('normaliza datos inexistentes como dominio vacío', () => {
    expect(normalizeMaintenanceData(undefined)).toEqual({ equipment: [], subassemblies: [], plans: [], events: [] })
  })
  it('migra una sesión schema v1 sin mantenimiento', () => {
    const project = normalizeProjectFile({ format: 'LACO3D_PROJECT', schemaVersion: 1, appVersion: '0.1.0', project: { id: 'p', name: 'Legacy', description: '', createdAt: '', updatedAt: '' }, scene: { objects: [], referenceLayout: null, viewSettings: {}, snapSettings: {}, camera: { type: 'orthographic', position: { x: 1, y: 1, z: 1 }, target: { x: 0, y: 0, z: 0 } } } })
    expect(project.schemaVersion).toBe(2)
    expect(project.maintenance.events).toEqual([])
  })
  it('conserva ambos dominios al normalizar schema v2', () => {
    const project = normalizeProjectFile({ format: 'LACO3D_PROJECT', schemaVersion: 2, appVersion: '0.1.0', project: { id: 'p2', name: 'Twin', description: '', createdAt: '', updatedAt: '' }, scene: { objects: [{ id: 'ASSET-1' }], referenceLayout: null, viewSettings: {}, snapSettings: {}, camera: { type: 'orthographic', position: { x: 1, y: 1, z: 1 }, target: { x: 0, y: 0, z: 0 } } }, maintenance: { equipment: [{ id: 'EQ-1', assetId: 'ASSET-1', name: 'Equipo', active: true, source: 'LOCAL', createdAt: '' }], subassemblies: [], plans: [], events: [] } })
    expect(project.scene.objects[0].id).toBe('ASSET-1')
    expect(project.maintenance.equipment[0].assetId).toBe('ASSET-1')
  })
})

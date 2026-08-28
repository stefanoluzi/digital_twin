import { describe, expect, it } from 'vitest'
import { normalizeMaintenanceData } from '../src/maintenance/data/maintenanceNormalizer'
import { normalizeProjectFile } from '../src/services/projectSerializer'
import { createEmptyLcoCouplingData } from '../src/maintenance/domain/lcoCouplings'

describe('legacy normalization', () => {
  it('normaliza datos inexistentes como dominio vacío', () => {
    expect(normalizeMaintenanceData(undefined)).toEqual({ equipment: [], subassemblies: [], plans: [], events: [], units: [], lcoCouplings: createEmptyLcoCouplingData() })
  })
  it('migra una sesión schema v1 sin mantenimiento', () => {
    const project = normalizeProjectFile({ format: 'LACO3D_PROJECT', schemaVersion: 1, appVersion: '0.1.0', project: { id: 'p', name: 'Legacy', description: '', createdAt: '', updatedAt: '' }, scene: { objects: [], referenceLayout: null, viewSettings: {}, snapSettings: {}, camera: { type: 'orthographic', position: { x: 1, y: 1, z: 1 }, target: { x: 0, y: 0, z: 0 } } } })
    expect(project.schemaVersion).toBe(4)
    expect(project.maintenance.events).toEqual([])
    expect(project.maintenance.units).toEqual([])
  })
  it('conserva ambos dominios al normalizar schema v2', () => {
    const project = normalizeProjectFile({ format: 'LACO3D_PROJECT', schemaVersion: 2, appVersion: '0.1.0', project: { id: 'p2', name: 'Twin', description: '', createdAt: '', updatedAt: '' }, scene: { objects: [{ id: 'ASSET-1' }], referenceLayout: null, viewSettings: {}, snapSettings: {}, camera: { type: 'orthographic', position: { x: 1, y: 1, z: 1 }, target: { x: 0, y: 0, z: 0 } } }, maintenance: { equipment: [{ id: 'EQ-1', assetId: 'ASSET-1', name: 'Equipo', active: true, source: 'LOCAL', createdAt: '' }], subassemblies: [], plans: [], events: [] } })
    expect(project.scene.objects[0].id).toBe('ASSET-1')
    expect(project.schemaVersion).toBe(4)
    expect(project.maintenance.equipment[0].assetId).toBe('ASSET-1')
    expect(project.maintenance.units).toEqual([])
  })
  it('migra trackingMode faltante a REPLACEMENT y agrega el módulo LCO vacío', () => { const data = normalizeMaintenanceData({ subassemblies: [{ id: 'S', equipmentId: 'E', name: 'Posición' }], units: [] }); expect(data.subassemblies[0].trackingMode).toBe('REPLACEMENT'); expect(data.units).toEqual([]); expect(data.lcoCouplings).toEqual(createEmptyLcoCouplingData()) })
  it('migra schema v3 a v4 sin degradar subassemblies', () => {
    const project = normalizeProjectFile({ format: 'LACO3D_PROJECT', schemaVersion: 3, appVersion: '0.1.0', project: { id: 'p3', name: 'V3', description: '', createdAt: '', updatedAt: '' }, scene: { objects: [], referenceLayout: null, viewSettings: {}, snapSettings: {}, camera: { type: 'orthographic', position: { x: 1, y: 1, z: 1 }, target: { x: 0, y: 0, z: 0 } } }, maintenance: { equipment: [], subassemblies: [{ id: 'S3', equipmentId: 'E3', name: 'Serial futura', trackingMode: 'SERIALIZED' }], plans: [], events: [], units: [{ reserved: true }] } })
    expect(project.schemaVersion).toBe(4); expect(project.maintenance.subassemblies[0].trackingMode).toBe('SERIALIZED'); expect(project.maintenance.units).toEqual([{ reserved: true }]); expect(project.maintenance.lcoCouplings.events).toEqual([])
  })
})

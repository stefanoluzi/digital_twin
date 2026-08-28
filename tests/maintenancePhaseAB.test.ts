import { describe, expect, it } from 'vitest'
import { applyAssetDeletePolicy, assertNoDuplicateMaintenanceIds, findDuplicateMaintenanceIds, findOrphanMaintenanceRelations, renameMaintenanceAsset } from '../src/maintenance/domain/maintenanceIntegrity'
import { getReplacementKpis } from '../src/maintenance/domain/maintenanceSelectors'
import { searchMaintenance } from '../src/maintenance/domain/maintenanceSearch'
import { toOperationalReplacementStatus } from '../src/maintenance/domain/maintenanceStatusEngine'
import type { MaintenanceData } from '../src/maintenance/domain/maintenanceTypes'
import type { IndustrialAsset } from '../src/types/plant'
import { deleteAssetWithMaintenancePolicy, renameAssetAndRelinkMaintenance } from '../src/services/assetMaintenanceCommands'
import { useMaintenanceStore } from '../src/maintenance/store/maintenanceStore'
import { useSceneStore } from '../src/store/sceneStore'
import { createEmptyLcoCouplingData } from '../src/maintenance/domain/lcoCouplings'

const data: MaintenanceData = {
  equipment: [{ id: 'EQ-1', assetId: 'ASSET-1', name: 'Motor principal', active: true, source: 'LOCAL', createdAt: '' }],
  subassemblies: [
    { id: 'POS-1', equipmentId: 'EQ-1', name: 'Rodamiento lado motor', description: '', sapId: 'SAP-100', active: true, criticality: 'A', trackingMode: 'REPLACEMENT', source: 'LOCAL', createdAt: '' },
    { id: 'POS-2', equipmentId: 'EQ-1', name: 'Acople', description: '', sapId: '', active: true, criticality: 'B', trackingMode: 'REPLACEMENT', source: 'LOCAL', createdAt: '' },
  ],
  plans: [{ id: 'PLAN-1', subassemblyId: 'POS-1', name: 'Vida', intervalValue: 10, intervalUnit: 'DAYS', warningDays: 3, criticalDays: 1, active: true, source: 'LOCAL', createdAt: '' }],
  events: [{ id: 'EV-1', subassemblyId: 'POS-1', type: 'REPLACEMENT', date: '2026-01-01', notes: '', workOrder: 'OT-7788', source: 'LOCAL', createdAt: '' }],
  units: [],
  lcoCouplings: createEmptyLcoCouplingData(),
}
const asset = { id: 'ASSET-1', name: 'Motor de laminador', areaCode: 'PIERCER', levelCode: 'LEVEL_1' } as IndustrialAsset
const seedSceneAsset = (id: string) => useSceneStore.getState().loadScene([{
  id,
  name: id,
  type: 'box',
  position: { x: 1, y: 1, z: 1 },
  rotation: { x: 0, y: 0, z: 0 },
  size: { width: 1, height: 1, depth: 1 },
  uniformScale: 1,
} as IndustrialAsset])

describe('integridad asset-maintenance', () => {
  it('rename conserva IDs y todas las relaciones', () => { const next = renameMaintenanceAsset(data, 'ASSET-1', 'MOTOR-9'); expect(next.equipment[0]).toMatchObject({ id: 'EQ-1', assetId: 'MOTOR-9' }); expect(next.subassemblies).toEqual(data.subassemblies); expect(next.plans).toEqual(data.plans); expect(next.events).toEqual(data.events) })
  it('undo/redo del rename también relinka Maintenance', () => { seedSceneAsset('MTR_001'); const linked = { ...data, equipment: [{ ...data.equipment[0], assetId: 'MTR_001' }] }; const scene = useSceneStore.getState(); useMaintenanceStore.getState().loadMaintenance(linked); scene.clearHistory(); scene.selectOnly('MTR_001'); expect(renameAssetAndRelinkMaintenance('MTR_001', 'MTR_UNDO')).toBe(true); expect(useMaintenanceStore.getState().equipment[0].assetId).toBe('MTR_UNDO'); expect(scene.undo()).toBe(true); expect(useMaintenanceStore.getState().equipment[0].assetId).toBe('MTR_001'); expect(scene.redo()).toBe(true); expect(useMaintenanceStore.getState().equipment[0].assetId).toBe('MTR_UNDO'); scene.undo(); scene.clearHistory(); useMaintenanceStore.getState().resetMaintenance() })
  it('delete policy conserva huérfano o elimina la cascada', () => { expect(applyAssetDeletePolicy(data, 'ASSET-1', 'KEEP_ORPHAN')).toEqual(data); const deleted = applyAssetDeletePolicy(data, 'ASSET-1', 'DELETE_MAINTENANCE'); expect(deleted).toEqual({ equipment: [], subassemblies: [], plans: [], events: [], units: [], lcoCouplings: createEmptyLcoCouplingData() }) })
  it('undo/redo del delete en cascada restaura ambas partes', () => { seedSceneAsset('MTR_001'); const linked = { ...data, equipment: [{ ...data.equipment[0], assetId: 'MTR_001' }] }; const scene = useSceneStore.getState(); useMaintenanceStore.getState().loadMaintenance(linked); scene.clearHistory(); expect(deleteAssetWithMaintenancePolicy('MTR_001', 'DELETE_MAINTENANCE')).toBe(true); expect(useSceneStore.getState().objects.some((item) => item.id === 'MTR_001')).toBe(false); expect(useMaintenanceStore.getState().equipment).toHaveLength(0); expect(useSceneStore.getState().undo()).toBe(true); expect(useSceneStore.getState().objects.some((item) => item.id === 'MTR_001')).toBe(true); expect(useMaintenanceStore.getState().equipment[0].assetId).toBe('MTR_001'); expect(useSceneStore.getState().redo()).toBe(true); expect(useMaintenanceStore.getState().equipment).toHaveLength(0); useSceneStore.getState().resetProject(); useMaintenanceStore.getState().resetMaintenance() })
  it('detecta cada relación huérfana sin eliminarla', () => { const orphaned: MaintenanceData = { ...data, equipment: [{ ...data.equipment[0], assetId: 'MISSING' }], subassemblies: [...data.subassemblies, { ...data.subassemblies[0], id: 'POS-X', equipmentId: 'EQ-X' }], plans: [...data.plans, { ...data.plans[0], id: 'PLAN-X', subassemblyId: 'POS-X-MISSING' }], events: [...data.events, { ...data.events[0], id: 'EV-X', subassemblyId: 'POS-X-MISSING' }] }; const result = findOrphanMaintenanceRelations(orphaned, ['ASSET-1']); expect(result.equipmentWithoutAsset).toEqual(['EQ-1']); expect(result.subassembliesWithoutEquipment).toEqual(['POS-X']); expect(result.plansWithoutSubassembly).toEqual(['PLAN-X']); expect(result.eventsWithoutSubassemblyOrEquipment).toContain('EV-X') })
  it('rechaza IDs y vínculos asset duplicados', () => { const duplicate = { ...data, equipment: [...data.equipment, { ...data.equipment[0] }], subassemblies: [...data.subassemblies, { ...data.subassemblies[0] }], plans: [...data.plans, { ...data.plans[0] }], events: [...data.events, { ...data.events[0] }] }; const result = findDuplicateMaintenanceIds(duplicate); expect(result.equipmentIds).toEqual(['EQ-1']); expect(result.equipmentAssetIds).toEqual(['ASSET-1']); expect(result.subassemblyIds).toEqual(['POS-1']); expect(result.planIds).toEqual(['PLAN-1']); expect(result.eventIds).toEqual(['EV-1']); expect(() => assertNoDuplicateMaintenanceIds(duplicate)).toThrow(/duplicados/) })
})

describe('proyección de recambios', () => {
  it('mapea estados internos a estados operativos', () => { expect(['OK', 'WARNING', 'CRITICAL', 'OVERDUE', 'NO_PLAN', 'NO_HISTORY', 'INACTIVE'].map((status) => toOperationalReplacementStatus(status as any))).toEqual(['CURRENT', 'DUE_SOON', 'DUE_SOON', 'OVERDUE', 'NO_DATA', 'NO_DATA', 'INACTIVE']) })
  it('los KPIs cuentan posiciones y separan equipos con vencidos', () => { const kpis = getReplacementKpis(data, '2026-01-20'); expect(kpis.OVERDUE).toBe(1); expect(kpis.NO_DATA).toBe(1); expect(kpis.equipmentWithOverdueCount).toBe(1) })
  it('busca por asset, posición, SAP y orden de trabajo', () => { expect(searchMaintenance(data, [asset], 'laminador').equipment).toHaveLength(1); expect(searchMaintenance(data, [asset], 'POS-1').functionalPositions).toHaveLength(1); expect(searchMaintenance(data, [asset], 'SAP-100').functionalPositions).toHaveLength(1); expect(searchMaintenance(data, [asset], 'OT-7788').events).toHaveLength(1) })
})

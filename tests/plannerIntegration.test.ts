import { describe, expect, it } from 'vitest'
import { createDefaultPlannerData, normalizePlannerData } from '../src/planner/data/plannerNormalizer'
import { MemoryPlannerRepository } from '../src/planner/repositories/PlannerRepository'
import {
  createPlannerBackup,
  parsePlannerBackup,
  plannerBackupFileName,
  serializePlannerBackup,
} from '../src/planner/services/plannerBackupService'
import {
  MAINTENANCE_DB_NAME,
  MAINTENANCE_DB_VERSION,
  PLANNER_STATE_STORE,
} from '../src/maintenance/repositories/maintenanceIndexedDb'

describe('integración del Planner de mantenimiento', () => {
  it('comparte la base versionada de Maintenance sin mezclar los registros LCO', () => {
    expect(MAINTENANCE_DB_NAME).toBe('LACO1_MAINTENANCE')
    expect(MAINTENANCE_DB_VERSION).toBe(2)
    expect(PLANNER_STATE_STORE).toBe('plannerState')
  })

  it('respeta proyectos intencionalmente vacíos y normaliza tareas legacy', () => {
    const normalized = normalizePlannerData({
      projectInfo: { id: ' P-1 ', name: ' Plan anual ', line: ' LACO ', startDate: '2026-09-09', createdAt: 'hoy' },
      paradas: [],
      tasks: [{
        id: ' T-1 ', title: '', paradaId: '', startDayOffset: -4, durationDays: 0,
        criticality: 'desconocida', dailyRequirements: { 0: [], invalido: 'x' },
      }],
    })

    expect(normalized.projectInfo).toMatchObject({ id: 'P-1', name: 'Plan anual', line: 'LACO' })
    expect(normalized.paradas).toEqual([])
    expect(normalized.tasks).toHaveLength(1)
    expect(normalized.tasks[0]).toMatchObject({
      id: 'T-1', title: 'Tarea sin nombre', paradaId: 'parada-rex-1',
      startDayOffset: 0, durationDays: 1, criticality: 'Media',
    })
    expect(normalized.tasks[0].dailyRequirements).toEqual({ 0: [] })
  })

  it('persiste copias aisladas mediante el mismo patrón de repositorio del proyecto madre', async () => {
    const repository = new MemoryPlannerRepository()
    const source = createDefaultPlannerData()
    source.projectInfo.name = 'Plan integrado'
    await repository.replaceAll(source)
    source.projectInfo.name = 'Mutado afuera'

    const loaded = await repository.load()
    expect(loaded?.projectInfo.name).toBe('Plan integrado')
    if (loaded) loaded.projectInfo.name = 'Mutado al leer'
    expect((await repository.load())?.projectInfo.name).toBe('Plan integrado')
  })

  it('exporta e importa respaldos versionados y mantiene compatibilidad con el JSON anterior', () => {
    const data = createDefaultPlannerData()
    data.projectInfo.name = 'REX 2026'
    const exportedAt = '2026-09-09T12:00:00.000Z'
    const backup = createPlannerBackup(data, exportedAt)
    const restored = parsePlannerBackup(serializePlannerBackup(data, exportedAt))
    const legacy = parsePlannerBackup(JSON.stringify(data))
    const canonical = normalizePlannerData(data)

    expect(backup).toMatchObject({ format: 'LACO_MAINTENANCE_PLANNER_BACKUP', schemaVersion: 1, exportedAt })
    expect(restored).toEqual(canonical)
    expect(legacy).toEqual(canonical)
    expect(plannerBackupFileName(data, new Date('2026-09-09T12:00:00.000Z'))).toBe('Planner_REX_2026_2026-09-09.planner.json')
  })

  it('rechaza respaldos de otro módulo o de una versión futura', () => {
    expect(() => parsePlannerBackup({ format: 'OTRO', schemaVersion: 1, projectInfo: {}, tasks: [], paradas: [] })).toThrow(/no compatible/i)
    expect(() => parsePlannerBackup({ format: 'LACO_MAINTENANCE_PLANNER_BACKUP', schemaVersion: 99, projectInfo: {}, tasks: [], paradas: [] })).toThrow(/no compatible/i)
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import {
  createEmptyLcoCouplingData,
  createLcoCouplingId,
  type CouplingInspectionEvent,
  type CouplingReplacementEvent,
  type LcoCouplingModuleData,
  type LcoPhotoAttachment,
} from '../src/maintenance/domain/lcoCouplings'
import {
  classifyInspectionAge,
  getDaysSinceLastInspection,
  getLcoInspectionAgeState,
  getLcoInspectionAgeStates,
  getLcoInspectionAgeSummary,
} from '../src/maintenance/domain/lcoCouplingSelectors'
import { MemoryLcoCouplingsRepository } from '../src/maintenance/repositories/LcoCouplingsRepository'
import { getLcoBackupStats, parseLcoBackup, serializeLcoBackup } from '../src/maintenance/services/lcoBackupService'
import { initializeLcoPersistence, resetLcoPersistenceForTests } from '../src/maintenance/services/lcoPersistenceService'
import { useMaintenanceStore } from '../src/maintenance/store/maintenanceStore'

const emptyPhoto: LcoPhotoAttachment = {
  id: 'PHOTO-1',
  fileName: 'control.png',
  mimeType: 'image/png',
  dataUrl: 'data:image/png;base64,aG9sYQ==',
  createdAt: '2026-08-01T10:00:00.000Z',
  caption: 'Vista lado reductor',
}

function inspection(id: string, date: string, couplingId: string, attachments: LcoPhotoAttachment[] = []): CouplingInspectionEvent {
  return { id, type: 'INSPECTION', date, createdAt: `${date}T10:00:00.000Z`, inspector: 'Inspector', observations: '', attachments, readings: [{ couplingId, wearLevel: 3, note: '', attachments: [] }] }
}

function replacement(id: string, date: string, couplingId: string): CouplingReplacementEvent {
  return { id, type: 'COUPLING_REPLACEMENT', date, createdAt: `${date}T12:00:00.000Z`, couplingId, reason: 'Preventivo', sapWorkOrder: 'OT-1', notes: '', wearAtRemoval: 3, attachments: [] }
}

function withEvents(...events: LcoCouplingModuleData['events']): LcoCouplingModuleData {
  return { ...createEmptyLcoCouplingData(), events }
}

afterEach(() => {
  resetLcoPersistenceForTests()
  useMaintenanceStore.setState({ lcoCouplings: createEmptyLcoCouplingData(), lcoStorageStatus: 'IDLE', lcoStorageError: '', lcoLegacyCandidate: null })
})

describe('seguimiento de antigüedad LCO', () => {
  it('clasifica los límites configurables 30/60/90 sin depender del desgaste', () => {
    const thresholds = { recentDays: 30, dueDays: 60, oldDays: 90 }
    expect([null, 30, 31, 60, 61, 90, 91].map((days) => classifyInspectionAge(days, thresholds))).toEqual([
      'NEVER_INSPECTED', 'RECENT', 'DUE', 'DUE', 'OLD', 'OLD', 'VERY_OLD',
    ])
  })

  it('inicia sin proyecto con los 32 acoplamientos como nunca inspeccionados', () => {
    expect(getLcoInspectionAgeSummary(createEmptyLcoCouplingData(), '2026-08-27')).toEqual({ total: 32, neverInspected: 32, veryOld: 0, old: 0, due: 0, recent: 0 })
  })

  it('ordena primero los nunca inspeccionados y luego del control más antiguo al más reciente', () => {
    const oldId = createLcoCouplingId(1, 'UPPER', 'GEARBOX')
    const recentId = createLcoCouplingId(1, 'UPPER', 'STAND')
    const data = withEvents(inspection('I-OLD', '2026-05-01', oldId), inspection('I-RECENT', '2026-08-20', recentId))
    const rows = getLcoInspectionAgeStates(data, '2026-08-27')
    expect(rows.slice(0, 30).every((row) => row.status === 'NEVER_INSPECTED')).toBe(true)
    expect(rows.slice(30).map((row) => row.couplingId)).toEqual([oldId, recentId])
  })

  it('mantiene la fecha real del último control aunque después exista un recambio', () => {
    const couplingId = createLcoCouplingId(2, 'LOWER', 'STAND')
    const data = withEvents(inspection('I-1', '2026-07-01', couplingId), replacement('R-1', '2026-08-01', couplingId))
    expect(getDaysSinceLastInspection(data, couplingId, '2026-08-27')).toBe(57)
    expect(getLcoInspectionAgeState(data, couplingId, '2026-08-27')).toMatchObject({ lastInspectionDate: '2026-07-01', daysSinceLastInspection: 57, status: 'DUE' })
  })

  it('recalcula correctamente después de editar o eliminar una inspección', () => {
    const couplingId = createLcoCouplingId(3, 'UPPER', 'GEARBOX')
    const original = inspection('I-1', '2026-05-01', couplingId)
    expect(getLcoInspectionAgeState(withEvents(original), couplingId, '2026-08-27').status).toBe('VERY_OLD')
    expect(getLcoInspectionAgeState(withEvents({ ...original, date: '2026-08-20' }), couplingId, '2026-08-27').status).toBe('RECENT')
    expect(getLcoInspectionAgeState(createEmptyLcoCouplingData(), couplingId, '2026-08-27').status).toBe('NEVER_INSPECTED')
  })
})

describe('repositorio y respaldo independiente', () => {
  it('recupera y persiste automáticamente el historial legacy cuando IndexedDB está vacío', async () => {
    const repository = new MemoryLcoCouplingsRepository()
    const couplingId = createLcoCouplingId(1, 'UPPER', 'GEARBOX')
    const legacy = withEvents(inspection('I-LEGACY', '2026-08-01', couplingId), replacement('R-LEGACY', '2026-08-20', couplingId))
    useMaintenanceStore.setState({ lcoCouplings: legacy, lcoStorageStatus: 'IDLE', lcoLegacyCandidate: null })
    await initializeLcoPersistence(repository)
    expect(useMaintenanceStore.getState().lcoCouplings.events.map((event) => event.id)).toEqual(['I-LEGACY', 'R-LEGACY'])
    expect((await repository.load()).events.map((event) => event.id)).toEqual(['I-LEGACY', 'R-LEGACY'])
    expect(useMaintenanceStore.getState().lcoCouplings.migratedLegacyFingerprints).toHaveLength(1)
  })

  it('no elimina del próximo guardado un historial legacy pendiente de confirmación', async () => {
    const currentId = createLcoCouplingId(2, 'UPPER', 'GEARBOX')
    const legacyId = createLcoCouplingId(2, 'LOWER', 'STAND')
    const repository = new MemoryLcoCouplingsRepository()
    await repository.replaceAll(withEvents(inspection('I-DB', '2026-08-10', currentId)))
    useMaintenanceStore.setState({ lcoCouplings: withEvents(inspection('I-LEGACY', '2026-07-01', legacyId)), lcoStorageStatus: 'IDLE', lcoLegacyCandidate: null })
    await initializeLcoPersistence(repository)
    expect(useMaintenanceStore.getState().lcoLegacyCandidate?.events[0].id).toBe('I-LEGACY')
    expect(useMaintenanceStore.getState().exportMaintenance().lcoCouplings.events[0].id).toBe('I-LEGACY')
  })

  it('guarda, actualiza y elimina eventos con metadatos de fotos', async () => {
    const repository = new MemoryLcoCouplingsRepository()
    const couplingId = createLcoCouplingId(4, 'LOWER', 'GEARBOX')
    const readingPhoto = { ...emptyPhoto, id: 'PHOTO-2', caption: 'Detalle' }
    const event = { ...inspection('I-1', '2026-08-01', couplingId, [emptyPhoto]), readings: [{ couplingId, wearLevel: 4 as const, note: '', attachments: [readingPhoto] }] }
    await repository.saveInspection(event)
    expect((await repository.load()).events).toHaveLength(1)
    const attachments = await repository.getAttachments()
    expect(attachments.map((item) => [item.id, item.eventId, item.readingId ?? null, item.blob.type])).toEqual([
      ['PHOTO-1', 'I-1', null, 'image/png'], ['PHOTO-2', 'I-1', couplingId, 'image/png'],
    ])
    await repository.updateInspection({ ...event, inspector: 'Inspector editado' })
    expect(((await repository.getEvents())[0] as CouplingInspectionEvent).inspector).toBe('Inspector editado')
    await repository.deleteInspection('I-1')
    expect(await repository.getEvents()).toEqual([])
  })

  it('exporta e importa un backup portable conservando eventos, fotos y configuración', () => {
    const couplingId = createLcoCouplingId(5, 'UPPER', 'STAND')
    const data = { ...withEvents(inspection('I-1', '2026-08-01', couplingId, [emptyPhoto]), replacement('R-1', '2026-08-20', couplingId)), inspectionAgeThresholds: { recentDays: 20, dueDays: 50, oldDays: 80 } }
    const restored = parseLcoBackup(serializeLcoBackup(data, '2026-08-27T12:00:00.000Z'))
    expect(restored.inspectionAgeThresholds).toEqual(data.inspectionAgeThresholds)
    expect(restored.events.map((event) => [event.id, event.type])).toEqual([['I-1', 'INSPECTION'], ['R-1', 'COUPLING_REPLACEMENT']])
    expect(restored.events[0].attachments).toEqual([emptyPhoto])
    expect(getLcoBackupStats(restored)).toEqual({ inspections: 1, replacements: 1, photos: 1 })
  })

  it('no vuelve a incluir los datos LCO independientes dentro de un proyecto .laco3d', () => {
    const couplingId = createLcoCouplingId(6, 'UPPER', 'GEARBOX')
    const independent = withEvents(inspection('I-LOCAL', '2026-08-01', couplingId))
    useMaintenanceStore.setState({ lcoCouplings: independent, lcoStorageStatus: 'SAVED' })
    expect(useMaintenanceStore.getState().exportMaintenance().lcoCouplings.events).toEqual([])
    expect(useMaintenanceStore.getState().lcoCouplings.events).toHaveLength(1)
  })
})

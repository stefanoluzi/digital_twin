import { beforeEach, describe, expect, it } from 'vitest'
import {
  createDefaultLcoCouplingTopology,
  createEmptyLcoCouplingData,
  createLcoCouplingId,
  type CouplingInspectionEvent,
  type CouplingReplacementEvent,
  type ExtensionShaftReplacementEvent,
  type LcoCouplingModuleData,
  type LcoPhotoAttachment,
} from '../src/maintenance/domain/lcoCouplings'
import { getLcoCouplingState, getLcoInspectionAgeState } from '../src/maintenance/domain/lcoCouplingSelectors'
import { getLcoHistoryRows, getLcoOperationalSide, getRecentLcoActivity } from '../src/maintenance/domain/lcoHistorySelectors'
import { useMaintenanceStore } from '../src/maintenance/store/maintenanceStore'
import { normalizeProjectFile } from '../src/services/projectSerializer'
import { parseProjectFile, serializeProject } from '../src/services/projectFileService'

const red = createLcoCouplingId(6, 'LOWER', 'GEARBOX')
const stand = createLcoCouplingId(6, 'LOWER', 'STAND')
const photo: LcoPhotoAttachment = { id: 'P1', fileName: 'desgaste.jpg', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,AA==', createdAt: '2026-08-27T08:00:00.000Z', caption: 'Acoplamiento retirado' }
const inspection = (id: string, date: string, readings: CouplingInspectionEvent['readings'], attachments: LcoPhotoAttachment[] = [], createdAt = `${date}T08:00:00.000Z`): CouplingInspectionEvent => ({ id, type: 'INSPECTION', date, createdAt, inspector: 'Juan Pérez', observations: 'Control LCO', readings, attachments })
const replacement = (id: string, date: string, couplingId: string, attachments: LcoPhotoAttachment[] = []): CouplingReplacementEvent => ({ id, type: 'COUPLING_REPLACEMENT', date, createdAt: `${date}T09:00:00.000Z`, couplingId, reason: 'Desgaste', sapWorkOrder: '40012789', notes: '', wearAtRemoval: 5, attachments })
const shaftReplacement = (id: string, date: string): ExtensionShaftReplacementEvent => ({ id, type: 'SHAFT_REPLACEMENT', date, createdAt: `${date}T10:00:00.000Z`, cageNumber: 3, shaftPosition: 'UPPER', reason: '', sapWorkOrder: '40012755', notes: '', attachments: [photo] })
const withEvents = (...events: LcoCouplingModuleData['events']): LcoCouplingModuleData => ({ ...createEmptyLcoCouplingData(), events })
const maintenance = (lcoCouplings: LcoCouplingModuleData) => ({ equipment: [], subassemblies: [], plans: [], events: [], units: [], lcoCouplings })

beforeEach(() => useMaintenanceStore.getState().resetMaintenance())

describe('historial y actividad derivados de eventos LCO', () => {
  it('normaliza inspecciones múltiples por reading y mantiene un cambio de alunga como una fila', () => {
    const data = withEvents(inspection('I1', '2026-08-27', [{ couplingId: red, wearLevel: 4, note: 'Reductor' }, { couplingId: stand, wearLevel: 5, note: 'Jaula', attachments: [photo] }], [photo]), shaftReplacement('S1', '2026-08-26'))
    const rows = getLcoHistoryRows(data)
    expect(rows).toHaveLength(3)
    expect(rows.filter((row) => row.parentEventId === 'I1')).toHaveLength(2)
    expect(rows.filter((row) => row.type === 'SHAFT_REPLACEMENT')).toHaveLength(1)
    expect(rows.find((row) => row.type === 'SHAFT_REPLACEMENT')?.wearLevel).toBeNull()
    expect(rows.find((row) => row.couplingId === stand)?.photos).toHaveLength(2)
  })

  it('actividad reciente usa las mismas filas y las ordena de más nueva a más antigua', () => {
    const data = withEvents(inspection('I1', '2026-08-20', [{ couplingId: red, wearLevel: 3, note: '' }]), replacement('R1', '2026-08-24', stand), inspection('I2', '2026-08-27', [{ couplingId: stand, wearLevel: 5, note: '' }]))
    expect(getRecentLcoActivity(data, 2).map((row) => row.parentEventId)).toEqual(['I2', 'R1'])
  })
})

describe('edición y eliminación sobre el evento original', () => {
  it('editar un reading recalcula inmediatamente el wear actual', () => {
    const event = inspection('I1', '2026-08-27', [{ couplingId: stand, wearLevel: 5, note: '', attachments: [photo] }], [photo])
    useMaintenanceStore.getState().loadMaintenance(maintenance(withEvents(event)))
    useMaintenanceStore.getState().replaceLcoEvent({ ...event, readings: [{ ...event.readings[0], wearLevel: 4 }] })
    const data = useMaintenanceStore.getState().lcoCouplings
    expect(getLcoCouplingState(data, stand, '2026-08-27').currentWearLevel).toBe(4)
    expect((data.events[0] as CouplingInspectionEvent).readings[0].attachments).toEqual([photo])
    expect(data.events[0].updatedAt).toBeTruthy()
  })

  it('editar la fecha recalcula inmediatamente último control y franja de antigüedad', () => {
    const event = inspection('I_DATE', '2026-08-27', [{ couplingId: stand, wearLevel: 3, note: '' }])
    useMaintenanceStore.getState().loadMaintenance(maintenance(withEvents(event)))
    useMaintenanceStore.getState().replaceLcoEvent({ ...event, date: '2026-05-01' })
    const data = useMaintenanceStore.getState().lcoCouplings
    const state = getLcoInspectionAgeState(data, stand, '2026-08-28')
    expect(state.lastInspectionDate).toBe('2026-05-01')
    expect(state.daysSinceLastInspection).toBe(119)
    expect(state.status).toBe('VERY_OLD')
  })

  it('eliminar un reading conserva los demás y elimina el padre sólo cuando queda vacío', () => {
    const event = inspection('I1', '2026-08-27', [{ couplingId: red, wearLevel: 4, note: '' }, { couplingId: stand, wearLevel: 5, note: '' }])
    useMaintenanceStore.getState().loadMaintenance(maintenance(withEvents(event)))
    useMaintenanceStore.getState().deleteLcoEvent('I1', stand)
    expect((useMaintenanceStore.getState().lcoCouplings.events[0] as CouplingInspectionEvent).readings.map((reading) => reading.couplingId)).toEqual([red])
    useMaintenanceStore.getState().deleteLcoEvent('I1', red)
    expect(useMaintenanceStore.getState().lcoCouplings.events).toHaveLength(0)
  })

  it('al eliminar la inspección más reciente vuelve al evento válido anterior', () => {
    useMaintenanceStore.getState().loadMaintenance(maintenance(withEvents(inspection('I0', '2026-08-20', [{ couplingId: stand, wearLevel: 2, note: '' }]), inspection('I1', '2026-08-27', [{ couplingId: stand, wearLevel: 5, note: '' }]))))
    useMaintenanceStore.getState().deleteLcoEvent('I1', stand)
    expect(getLcoCouplingState(useMaintenanceStore.getState().lcoCouplings, stand, '2026-08-27').currentWearLevel).toBe(2)
  })

  it('permite editar OT y quitar adjuntos de un recambio', () => {
    const event = replacement('R1', '2026-08-24', stand, [photo])
    useMaintenanceStore.getState().loadMaintenance(maintenance(withEvents(event)))
    useMaintenanceStore.getState().replaceLcoEvent({ ...event, sapWorkOrder: '40099999', attachments: [] })
    const edited = useMaintenanceStore.getState().lcoCouplings.events[0] as CouplingReplacementEvent
    expect(edited.sapWorkOrder).toBe('40099999')
    expect(edited.attachments).toEqual([])
  })
})

describe('persistencia fotográfica y convención espacial', () => {
  it('save/open conserva fotos generales y específicas como DataURL', () => {
    const lcoCouplings = withEvents(inspection('I1', '2026-08-27', [{ couplingId: stand, wearLevel: 5, note: '', attachments: [photo] }], [photo]))
    const raw = { format: 'LACO3D_PROJECT', schemaVersion: 4, appVersion: '0.1.0', project: { id: 'p', name: 'Fotos', description: '', createdAt: '', updatedAt: '' }, scene: { objects: [], referenceLayout: null, viewSettings: {}, snapSettings: {}, camera: { type: 'orthographic', position: { x: 1, y: 1, z: 1 }, target: { x: 0, y: 0, z: 0 } } }, maintenance: maintenance(lcoCouplings) }
    const reopened = parseProjectFile(serializeProject(normalizeProjectFile(raw)))
    const event = reopened.maintenance.lcoCouplings.events[0] as CouplingInspectionEvent
    expect(event.attachments[0]).toEqual(photo)
    expect(event.readings[0].attachments?.[0]).toEqual(photo)
  })

  it('mantiene 32 couplings y asigna impares al SUR y pares al NORTE', () => {
    expect(createDefaultLcoCouplingTopology().couplings).toHaveLength(32)
    expect([1, 3, 5, 7].every((number) => getLcoOperationalSide(number as 1 | 3 | 5 | 7) === 'SOUTH')).toBe(true)
    expect([2, 4, 6, 8].every((number) => getLcoOperationalSide(number as 2 | 4 | 6 | 8) === 'NORTH')).toBe(true)
  })
})

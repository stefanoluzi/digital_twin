import { describe, expect, it } from 'vitest'
import {
  createDefaultLcoCouplingTopology,
  createEmptyLcoCouplingData,
  createLcoCouplingId,
  createLcoShaftId,
  COUPLING_WEAR_LEVELS,
  getCouplingsForCage,
  getCouplingsForShaft,
  LCO_NORTH_CAGES,
  LCO_SOUTH_CAGES,
  type CouplingInspectionEvent,
  type CouplingReplacementEvent,
  type ExtensionShaftReplacementEvent,
  type LcoCouplingModuleData,
  type LcoPhotoAttachment,
} from '../src/maintenance/domain/lcoCouplings'
import { getLcoCouplingHistory, getLcoCouplingState, getLcoCouplingSummary, getLcoShaftState } from '../src/maintenance/domain/lcoCouplingSelectors'
import {
  buildLcoInspectionReadings,
  getInspectionProgress,
  matchesLcoFilter,
  setCageSelected,
  setShaftSelected,
} from '../src/apps/maintenance/lcoCouplingUx'
import { normalizeProjectFile } from '../src/services/projectSerializer'
import { parseProjectFile, serializeProject } from '../src/services/projectFileService'

const base = { attachments: [] as LcoPhotoAttachment[] }
const inspected = (id: string, date: string, readings: CouplingInspectionEvent['readings'], createdAt = `${date}T10:00:00.000Z`): CouplingInspectionEvent => ({ ...base, id, type: 'INSPECTION', date, createdAt, inspector: 'Técnico', observations: '', readings })
const couplingReplacement = (id: string, date: string, couplingId: string, createdAt = `${date}T12:00:00.000Z`): CouplingReplacementEvent => ({ ...base, id, type: 'COUPLING_REPLACEMENT', date, createdAt, couplingId, reason: '', sapWorkOrder: '', notes: '', wearAtRemoval: null })
const shaftReplacement = (id: string, date: string, cageNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, shaftPosition: 'UPPER' | 'LOWER', createdAt = `${date}T12:00:00.000Z`): ExtensionShaftReplacementEvent => ({ ...base, id, type: 'SHAFT_REPLACEMENT', date, createdAt, cageNumber, shaftPosition, reason: '', sapWorkOrder: '', notes: '' })
const withEvents = (...events: LcoCouplingModuleData['events']): LcoCouplingModuleData => ({ ...createEmptyLcoCouplingData(), events })

describe('topología física LCO', () => {
  it('genera exactamente 8 jaulas, 16 alungas y 32 acoplamientos', () => {
    const topology = createDefaultLcoCouplingTopology()
    expect(topology.cages).toHaveLength(8)
    expect(topology.shafts).toHaveLength(16)
    expect(topology.couplings).toHaveLength(32)
    expect(new Set(topology.couplings.map((coupling) => coupling.id)).size).toBe(32)
  })

  it('ubica pares al NORTE, impares al SUR y dos extremos por alunga', () => {
    const topology = createDefaultLcoCouplingTopology()
    expect(LCO_NORTH_CAGES).toEqual([2, 4, 6, 8])
    expect(LCO_SOUTH_CAGES).toEqual([1, 3, 5, 7])
    expect(topology.cages.filter((cage) => cage.cageNumber % 2 === 0).every((cage) => cage.side === 'NORTH')).toBe(true)
    expect(topology.cages.filter((cage) => cage.cageNumber % 2 === 1).every((cage) => cage.side === 'SOUTH')).toBe(true)
    expect(topology.shafts.every((shaft) => shaft.couplingIds.length === 2 && getCouplingsForShaft(shaft.cageNumber, shaft.position).length === 2)).toBe(true)
    expect(createLcoShaftId(3, 'UPPER')).toBe('J3_SUP')
  })

  it('las alungas no tienen desgaste y el wear de acoplamiento queda limitado a 1–5', () => {
    const topology = createDefaultLcoCouplingTopology()
    expect(topology.shafts.every((shaft) => !('wearLevel' in shaft))).toBe(true)
    expect(COUPLING_WEAR_LEVELS).toEqual([1, 2, 3, 4, 5])
  })
})

describe('derivación por eventos LCO', () => {
  const j1SupRed = createLcoCouplingId(1, 'UPPER', 'GEARBOX')
  const j1SupStand = createLcoCouplingId(1, 'UPPER', 'STAND')
  const j1InfRed = createLcoCouplingId(1, 'LOWER', 'GEARBOX')

  it('una inspección parcial actualiza solamente los readings incluidos', () => {
    const data = withEvents(inspected('I1', '2026-08-01', [{ couplingId: j1SupRed, wearLevel: 2, note: '' }]))
    expect(getLcoCouplingState(data, j1SupRed, '2026-08-10')).toMatchObject({ currentWearLevel: 2, wearSource: 'INSPECTION' })
    expect(getLcoCouplingState(data, j1SupStand, '2026-08-10')).toMatchObject({ currentWearLevel: null, lastInspection: null })
  })

  it('un recambio individual afecta exactamente un coupling y no crea inspección falsa', () => {
    const data = withEvents(
      inspected('I1', '2026-07-01', [{ couplingId: j1SupRed, wearLevel: 4, note: '' }, { couplingId: j1SupStand, wearLevel: 3, note: '' }]),
      couplingReplacement('R1', '2026-08-01', j1SupStand),
    )
    expect(getLcoCouplingState(data, j1SupStand, '2026-08-10')).toMatchObject({ currentWearLevel: 1, wearSource: 'REPLACEMENT' })
    expect(getLcoCouplingState(data, j1SupRed, '2026-08-10')).toMatchObject({ currentWearLevel: 4, wearSource: 'INSPECTION' })
    const replacementOnly = getLcoCouplingState(withEvents(couplingReplacement('R2', '2026-08-02', j1InfRed)), j1InfRed, '2026-08-10')
    expect(replacementOnly.lastInspection).toBeNull()
    expect(replacementOnly.currentWearLevel).toBe(1)
  })

  it('un cambio de alunga afecta sólo sus dos extremos', () => {
    const event = shaftReplacement('S1', '2026-08-01', 1, 'UPPER')
    const data = withEvents(event)
    expect(getLcoCouplingState(data, j1SupRed, '2026-08-10')).toMatchObject({ wearSource: 'REPLACEMENT', currentWearLevel: 1, lastInspection: null })
    expect(getLcoCouplingState(data, j1SupStand, '2026-08-10')).toMatchObject({ wearSource: 'REPLACEMENT', currentWearLevel: 1, lastInspection: null })
    expect(getLcoCouplingState(data, j1InfRed, '2026-08-10').wearSource).toBe('NONE')
    expect('wearLevel' in event).toBe(false)
    expect(getLcoCouplingHistory(data, j1SupRed)[0]).toMatchObject({ type: 'SHAFT_REPLACEMENT', wearLevel: null })
  })

  it('reproduce el caso J2 y deja sólo la alunga inferior con ambos couplings N', () => {
    const ids = {
      supRed: createLcoCouplingId(2, 'UPPER', 'GEARBOX'),
      supStand: createLcoCouplingId(2, 'UPPER', 'STAND'),
      infRed: createLcoCouplingId(2, 'LOWER', 'GEARBOX'),
      infStand: createLcoCouplingId(2, 'LOWER', 'STAND'),
    }
    const before = inspected('I-J2', '2026-08-20', [
      { couplingId: ids.supRed, wearLevel: 2, note: '' },
      { couplingId: ids.supStand, wearLevel: 2, note: '' },
      { couplingId: ids.infRed, wearLevel: 2, note: '' },
      { couplingId: ids.infStand, wearLevel: 3, note: '' },
    ])
    const data = withEvents(before, shaftReplacement('S-J2-INF', '2026-08-27', 2, 'LOWER'))
    expect([ids.supRed, ids.supStand].map((id) => getLcoCouplingState(data, id, '2026-08-27').currentWearLevel)).toEqual([2, 2])
    const replacementStates = [ids.infRed, ids.infStand].map((id) => getLcoCouplingState(data, id, '2026-08-27'))
    expect(replacementStates.map((state) => state.wearSource)).toEqual(['REPLACEMENT', 'REPLACEMENT'])
    expect(replacementStates.every((state) => matchesLcoFilter(state, 'NO_INSPECTION'))).toBe(true)
    expect(getLcoCouplingSummary(data, '2026-08-27').withoutInspection).toBe(30)
  })

  it('el resumen cuenta únicamente los 32 acoplamientos, incluso con recambios de alunga', () => {
    const data = withEvents(shaftReplacement('S1', '2026-08-01', 1, 'UPPER'))
    expect(getLcoCouplingSummary(data, '2026-08-10')).toMatchObject({ total: 32, critical: 0, worn: 0 })
  })

  it('una inspección posterior al recambio vuelve a ser la fuente del wear actual', () => {
    const data = withEvents(couplingReplacement('R1', '2026-05-01', j1SupRed), inspected('I2', '2026-08-03', [{ couplingId: j1SupRed, wearLevel: 3, note: 'Juego perceptible' }]))
    expect(getLcoCouplingState(data, j1SupRed, '2026-08-10')).toMatchObject({ currentWearLevel: 3, wearSource: 'INSPECTION' })
  })

  it('ordena el historial de más reciente a más antiguo', () => {
    const data = withEvents(inspected('I1', '2026-05-01', [{ couplingId: j1SupRed, wearLevel: 2, note: '' }]), couplingReplacement('R1', '2026-06-01', j1SupRed), inspected('I2', '2026-08-01', [{ couplingId: j1SupRed, wearLevel: 3, note: '' }]))
    expect(getLcoCouplingHistory(data, j1SupRed).map((entry) => entry.eventId)).toEqual(['I2', 'R1', 'I1'])
  })
})

describe('flujo operacional de inspección LCO', () => {
  const j3SupRed = createLcoCouplingId(3, 'UPPER', 'GEARBOX')
  const j3SupStand = createLcoCouplingId(3, 'UPPER', 'STAND')

  it('seleccionar una alunga marca exactamente sus dos extremos', () => {
    const selected = setShaftSelected({}, 3, 'UPPER', true)
    expect(Object.entries(selected).filter(([, value]) => value).map(([id]) => id)).toEqual([j3SupRed, j3SupStand])
  })

  it('seleccionar una jaula marca exactamente sus cuatro acoplamientos', () => {
    const selected = setCageSelected({}, 6, true)
    expect(Object.values(selected).filter(Boolean)).toHaveLength(4)
    expect(getCouplingsForCage(6).every((coupling) => selected[coupling.id])).toBe(true)
  })

  it('bloquea guardar si existe una selección sin desgaste', () => {
    const selected = setShaftSelected({}, 3, 'UPPER', true)
    const progress = getInspectionProgress(selected, { [j3SupRed]: 2 })
    expect(progress).toMatchObject({ selectedCount: 2, evaluatedCount: 1, canSave: false })
  })

  it('construye readings sólo para posiciones seleccionadas y evaluadas', () => {
    const selected = setShaftSelected({}, 3, 'UPPER', true)
    const readings = buildLcoInspectionReadings(selected, { [j3SupRed]: 2, [j3SupStand]: 3, [createLcoCouplingId(4, 'UPPER', 'GEARBOX')]: 5 }, {}, {})
    expect(readings.map((reading) => [reading.couplingId, reading.wearLevel])).toEqual([[j3SupRed, 2], [j3SupStand, 3]])
  })

  it('el historial de alunga conserva eventos de ambos extremos y deduplica sólo el cambio completo', () => {
    const data = withEvents(
      inspected('I1', '2026-05-01', [{ couplingId: j3SupRed, wearLevel: 3, note: 'Reductor' }, { couplingId: j3SupStand, wearLevel: 4, note: 'Jaula' }]),
      couplingReplacement('R1', '2026-06-01', j3SupStand),
      shaftReplacement('S1', '2026-07-01', 3, 'UPPER'),
    )
    const history = getLcoShaftState(data, 3, 'UPPER', '2026-08-01').history
    expect(history).toHaveLength(4)
    expect(history.filter((entry) => entry.type === 'INSPECTION')).toHaveLength(2)
    expect(history.filter((entry) => entry.type === 'SHAFT_REPLACEMENT')).toHaveLength(1)
    expect(history.find((entry) => entry.type === 'SHAFT_REPLACEMENT')?.wearLevel).toBeNull()
  })

  it('aplicar un filtro no muta ni altera el estado derivado', () => {
    const data = withEvents(inspected('I1', '2026-05-01', [{ couplingId: j3SupRed, wearLevel: 4, note: '' }]))
    const before = getLcoCouplingState(data, j3SupRed, '2026-08-01')
    expect(matchesLcoFilter(before, 'WORN')).toBe(true)
    expect(getLcoCouplingState(data, j3SupRed, '2026-08-01')).toEqual(before)
    expect(data.events).toHaveLength(1)
  })
})

describe('migración y persistencia de sesión LCO', () => {
  const rawProject = (schemaVersion: number, maintenance?: unknown) => ({ format: 'LACO3D_PROJECT', schemaVersion, appVersion: '0.1.0', project: { id: 'p', name: 'LCO', description: '', createdAt: '', updatedAt: '' }, scene: { objects: [], referenceLayout: null, viewSettings: {}, snapSettings: {}, camera: { type: 'orthographic', position: { x: 1, y: 1, z: 1 }, target: { x: 0, y: 0, z: 0 } } }, maintenance })

  it('abre sesiones legacy sin eventos de acoplamientos', () => {
    const project = normalizeProjectFile(rawProject(3, { equipment: [], subassemblies: [], plans: [], events: [], units: [] }))
    expect(project.schemaVersion).toBe(4)
    expect(project.maintenance.lcoCouplings).toEqual(createEmptyLcoCouplingData())
  })

  it('save/open conserva los eventos especializados', () => {
    const couplingId = createLcoCouplingId(3, 'UPPER', 'GEARBOX')
    const project = normalizeProjectFile(rawProject(4, { equipment: [], subassemblies: [], plans: [], events: [], units: [], lcoCouplings: withEvents(inspected('I1', '2026-08-03', [{ couplingId, wearLevel: 4, note: 'Desgaste marcado' }])) }))
    const reopened = parseProjectFile(serializeProject(project))
    expect(reopened.maintenance.lcoCouplings.events).toHaveLength(1)
    expect(getLcoCouplingState(reopened.maintenance.lcoCouplings, couplingId, '2026-08-10').currentWearLevel).toBe(4)
  })
})

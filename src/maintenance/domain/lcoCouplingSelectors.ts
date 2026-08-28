import { differenceInCalendarDays } from './maintenanceDateService'
import {
  createDefaultLcoCouplingTopology,
  getCouplingsForShaft,
  getLcoCouplingById,
  type CouplingInspectionEvent,
  type CouplingReplacementEvent,
  type CouplingWearLevel,
  type ExtensionShaftReplacementEvent,
  type LcoCouplingEvent,
  type LcoCouplingModuleData,
  type LcoPhotoAttachment,
  type LcoShaftPosition,
  type LcoCageNumber,
  type InspectionAgeThresholds,
} from './lcoCouplings'

export type CouplingWearSource = 'INSPECTION' | 'REPLACEMENT' | 'NONE'
export type InspectionFreshness = 'FRESH' | 'STALE' | 'VERY_STALE' | 'NO_INSPECTION'
export type InspectionAgeStatus = 'RECENT' | 'DUE' | 'OLD' | 'VERY_OLD' | 'NEVER_INSPECTED'

export interface LcoInspectionAgeState {
  couplingId: string
  lastInspectionDate: string | null
  daysSinceLastInspection: number | null
  status: InspectionAgeStatus
}

export interface LcoCouplingState {
  couplingId: string
  currentWearLevel: CouplingWearLevel | null
  wearSource: CouplingWearSource
  lastInspection: { event: CouplingInspectionEvent; wearLevel: CouplingWearLevel; note: string; conditionCode?: CouplingInspectionEvent['readings'][number]['conditionCode']; attachments: LcoPhotoAttachment[] } | null
  lastReplacement: CouplingReplacementEvent | ExtensionShaftReplacementEvent | null
  freshness: InspectionFreshness
  daysSinceInspection: number | null
  photoCount: number
}

export interface LcoCouplingHistoryEntry {
  eventId: string
  couplingId: string
  date: string
  createdAt: string
  type: LcoCouplingEvent['type']
  wearLevel: CouplingWearLevel | null
  title: string
  note: string
  sapWorkOrder: string
  attachments: LcoPhotoAttachment[]
}

export interface LcoShaftState {
  cageNumber: LcoCageNumber
  shaftPosition: LcoShaftPosition
  couplings: LcoCouplingState[]
  lastShaftReplacement: ExtensionShaftReplacementEvent | null
  history: LcoCouplingHistoryEntry[]
}

function eventKey(event: Pick<LcoCouplingEvent, 'date' | 'createdAt' | 'id'>) {
  return `${event.date}|${event.createdAt}|${event.id}`
}

function newest<T extends LcoCouplingEvent>(events: T[]) {
  return events.slice().sort((a, b) => eventKey(b).localeCompare(eventKey(a)))[0] ?? null
}

function replacementAffectsCoupling(event: CouplingReplacementEvent | ExtensionShaftReplacementEvent, couplingId: string) {
  if (event.type === 'COUPLING_REPLACEMENT') return event.couplingId === couplingId
  const coupling = getLcoCouplingById(couplingId)
  return Boolean(coupling && coupling.cageNumber === event.cageNumber && coupling.shaftPosition === event.shaftPosition)
}

export function getLcoCouplingState(data: LcoCouplingModuleData, couplingId: string, referenceDate: string): LcoCouplingState {
  const inspections = data.events.flatMap((event) => {
    if (event.type !== 'INSPECTION') return []
    const reading = event.readings.find((item) => item.couplingId === couplingId)
    return reading ? [{ event, wearLevel: reading.wearLevel, note: reading.note, conditionCode: reading.conditionCode, attachments: [...event.attachments, ...(reading.attachments ?? [])] }] : []
  }).sort((a, b) => eventKey(b.event).localeCompare(eventKey(a.event)))
  const lastInspection = inspections[0] ?? null
  const replacements = data.events.filter((event): event is CouplingReplacementEvent | ExtensionShaftReplacementEvent => event.type === 'COUPLING_REPLACEMENT' || event.type === 'SHAFT_REPLACEMENT').filter((event) => replacementAffectsCoupling(event, couplingId))
  const lastReplacement = newest(replacements)
  const replacementIsNewest = Boolean(lastReplacement && (!lastInspection || eventKey(lastReplacement) > eventKey(lastInspection.event)))
  const daysSinceInspection = lastInspection ? differenceInCalendarDays(referenceDate, lastInspection.event.date) : null
  const thresholds = data.inspectionFreshnessThresholds
  const freshness: InspectionFreshness = daysSinceInspection === null
    ? 'NO_INSPECTION'
    : daysSinceInspection > thresholds.veryStaleDays
      ? 'VERY_STALE'
      : daysSinceInspection > thresholds.staleDays
        ? 'STALE'
        : 'FRESH'
  const photoCount = data.events.reduce((count, event) => {
    if (event.type === 'INSPECTION') {
      const reading = event.readings.find((item) => item.couplingId === couplingId)
      return reading ? count + event.attachments.length + (reading.attachments?.length ?? 0) : count
    }
    return replacementAffectsCoupling(event, couplingId) ? count + event.attachments.length : count
  }, 0)
  return {
    couplingId,
    currentWearLevel: replacementIsNewest ? 1 : lastInspection?.wearLevel ?? null,
    wearSource: replacementIsNewest ? 'REPLACEMENT' : lastInspection ? 'INSPECTION' : 'NONE',
    lastInspection,
    lastReplacement,
    freshness,
    daysSinceInspection,
    photoCount,
  }
}

export function getLastInspectionDate(data: LcoCouplingModuleData, couplingId: string) {
  return data.events
    .filter((event): event is CouplingInspectionEvent => event.type === 'INSPECTION' && event.readings.some((reading) => reading.couplingId === couplingId))
    .sort((a, b) => eventKey(b).localeCompare(eventKey(a)))[0]?.date ?? null
}

export function getDaysSinceLastInspection(data: LcoCouplingModuleData, couplingId: string, referenceDate: string) {
  const date = getLastInspectionDate(data, couplingId)
  return date ? differenceInCalendarDays(referenceDate, date) : null
}

export function classifyInspectionAge(days: number | null, thresholds: InspectionAgeThresholds): InspectionAgeStatus {
  if (days === null) return 'NEVER_INSPECTED'
  if (days <= thresholds.recentDays) return 'RECENT'
  if (days <= thresholds.dueDays) return 'DUE'
  if (days <= thresholds.oldDays) return 'OLD'
  return 'VERY_OLD'
}

export function getLcoInspectionAgeState(data: LcoCouplingModuleData, couplingId: string, referenceDate: string): LcoInspectionAgeState {
  const lastInspectionDate = getLastInspectionDate(data, couplingId)
  const daysSinceLastInspection = lastInspectionDate ? differenceInCalendarDays(referenceDate, lastInspectionDate) : null
  return { couplingId, lastInspectionDate, daysSinceLastInspection, status: classifyInspectionAge(daysSinceLastInspection, data.inspectionAgeThresholds) }
}

export function getLcoInspectionAgeStates(data: LcoCouplingModuleData, referenceDate: string) {
  return createDefaultLcoCouplingTopology().couplings
    .map((coupling) => getLcoInspectionAgeState(data, coupling.id, referenceDate))
    .sort((a, b) => inspectionAgePriority(b) - inspectionAgePriority(a) || a.couplingId.localeCompare(b.couplingId))
}

export function getLcoInspectionAgeSummary(data: LcoCouplingModuleData, referenceDate: string) {
  const states = getLcoInspectionAgeStates(data, referenceDate)
  return {
    total: states.length,
    neverInspected: states.filter((state) => state.status === 'NEVER_INSPECTED').length,
    veryOld: states.filter((state) => state.status === 'VERY_OLD').length,
    old: states.filter((state) => state.status === 'OLD').length,
    due: states.filter((state) => state.status === 'DUE').length,
    recent: states.filter((state) => state.status === 'RECENT').length,
  }
}

function inspectionAgePriority(state: LcoInspectionAgeState) {
  return state.daysSinceLastInspection === null ? Number.MAX_SAFE_INTEGER : state.daysSinceLastInspection
}

export function getLcoCouplingHistory(data: LcoCouplingModuleData, couplingId: string): LcoCouplingHistoryEntry[] {
  return data.events.flatMap((event): LcoCouplingHistoryEntry[] => {
    if (event.type === 'INSPECTION') {
      const reading = event.readings.find((item) => item.couplingId === couplingId)
      return reading ? [{ eventId: event.id, couplingId, date: event.date, createdAt: event.createdAt, type: event.type, wearLevel: reading.wearLevel, title: `Inspección ${reading.wearLevel}/5`, note: reading.note || event.observations, sapWorkOrder: '', attachments: [...event.attachments, ...(reading.attachments ?? [])] }] : []
    }
    if (event.type === 'COUPLING_REPLACEMENT' && event.couplingId === couplingId) return [{ eventId: event.id, couplingId, date: event.date, createdAt: event.createdAt, type: event.type, wearLevel: 1, title: 'Cambio de acoplamiento', note: event.notes || event.reason, sapWorkOrder: event.sapWorkOrder, attachments: event.attachments }]
    if (event.type === 'SHAFT_REPLACEMENT' && replacementAffectsCoupling(event, couplingId)) return [{ eventId: event.id, couplingId, date: event.date, createdAt: event.createdAt, type: event.type, wearLevel: null, title: 'Cambio de alunga completa', note: event.notes || event.reason, sapWorkOrder: event.sapWorkOrder, attachments: event.attachments }]
    return []
  }).sort((a, b) => `${b.date}|${b.createdAt}|${b.eventId}`.localeCompare(`${a.date}|${a.createdAt}|${a.eventId}`))
}

export function getLcoShaftState(data: LcoCouplingModuleData, cageNumber: LcoCageNumber, shaftPosition: LcoShaftPosition, referenceDate: string): LcoShaftState {
  const couplings = getCouplingsForShaft(cageNumber, shaftPosition).map((coupling) => getLcoCouplingState(data, coupling.id, referenceDate))
  const lastShaftReplacement = newest(data.events.filter((event): event is ExtensionShaftReplacementEvent => event.type === 'SHAFT_REPLACEMENT' && event.cageNumber === cageNumber && event.shaftPosition === shaftPosition))
  const couplingIds = new Set(couplings.map((coupling) => coupling.couplingId))
  const history = [...couplingIds]
    .flatMap((couplingId) => getLcoCouplingHistory(data, couplingId))
    .filter((entry, index, entries) => entry.type !== 'SHAFT_REPLACEMENT' || entries.findIndex((candidate) => candidate.eventId === entry.eventId && candidate.type === entry.type) === index)
    .map((entry) => {
      if (entry.type === 'SHAFT_REPLACEMENT') return entry
      const side = getLcoCouplingById(entry.couplingId)?.side === 'GEARBOX' ? 'Reductor' : 'Jaula'
      return { ...entry, title: `${entry.title} · Lado ${side}` }
    })
    .sort((a, b) => `${b.date}|${b.createdAt}|${b.eventId}|${b.couplingId}`.localeCompare(`${a.date}|${a.createdAt}|${a.eventId}|${a.couplingId}`))
  return { cageNumber, shaftPosition, couplings, lastShaftReplacement, history }
}

export function getLcoCouplingSummary(data: LcoCouplingModuleData, referenceDate: string) {
  const states = createDefaultLcoCouplingTopology().couplings.map((coupling) => getLcoCouplingState(data, coupling.id, referenceDate))
  return {
    total: states.length,
    critical: states.filter((state) => state.currentWearLevel === 5).length,
    worn: states.filter((state) => state.currentWearLevel === 4).length,
    withoutInspection: states.filter((state) => state.wearSource !== 'INSPECTION').length,
    stale: states.filter((state) => state.freshness === 'STALE' || state.freshness === 'VERY_STALE').length,
  }
}

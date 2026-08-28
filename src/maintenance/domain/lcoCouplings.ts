export type LcoCageNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export type LcoCageSide = 'NORTH' | 'SOUTH'
export type LcoShaftPosition = 'UPPER' | 'LOWER'
export type LcoCouplingSide = 'GEARBOX' | 'STAND'
export type CouplingWearLevel = 1 | 2 | 3 | 4 | 5
export type CouplingConditionCode = 'NORMAL' | 'JUEGO' | 'DESGASTE_DIENTES' | 'MARCAS' | 'FISURA' | 'LUBRICACION' | 'OTRO'

export interface LcoPhotoAttachment {
  id: string
  fileName: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  dataUrl: string
  createdAt: string
  caption: string
}

export interface LcoCage {
  id: `J${LcoCageNumber}`
  cageNumber: LcoCageNumber
  side: LcoCageSide
}

export interface LcoExtensionShaft {
  id: string
  cageNumber: LcoCageNumber
  position: LcoShaftPosition
  couplingIds: [string, string]
}

export interface LcoCoupling {
  id: string
  cageNumber: LcoCageNumber
  shaftPosition: LcoShaftPosition
  side: LcoCouplingSide
}

export interface LcoCouplingTopology {
  cages: LcoCage[]
  shafts: LcoExtensionShaft[]
  couplings: LcoCoupling[]
}

interface LcoEventBase {
  id: string
  date: string
  createdAt: string
  updatedAt?: string
  attachments: LcoPhotoAttachment[]
}

export interface CouplingInspectionReading {
  couplingId: string
  wearLevel: CouplingWearLevel
  note: string
  conditionCode?: CouplingConditionCode
  attachments?: LcoPhotoAttachment[]
}

export interface CouplingInspectionEvent extends LcoEventBase {
  type: 'INSPECTION'
  inspector: string
  observations: string
  readings: CouplingInspectionReading[]
}

export interface CouplingReplacementEvent extends LcoEventBase {
  type: 'COUPLING_REPLACEMENT'
  couplingId: string
  inspector?: string
  reason: string
  sapWorkOrder: string
  notes: string
  wearAtRemoval: CouplingWearLevel | null
}

export interface ExtensionShaftReplacementEvent extends LcoEventBase {
  type: 'SHAFT_REPLACEMENT'
  cageNumber: LcoCageNumber
  shaftPosition: LcoShaftPosition
  inspector?: string
  reason: string
  sapWorkOrder: string
  notes: string
}

export type LcoCouplingEvent = CouplingInspectionEvent | CouplingReplacementEvent | ExtensionShaftReplacementEvent

export interface InspectionFreshnessThresholds {
  staleDays: number
  veryStaleDays: number
}

export interface InspectionAgeThresholds {
  recentDays: number
  dueDays: number
  oldDays: number
}

export interface LcoCouplingModuleData {
  events: LcoCouplingEvent[]
  cageAssetIds: Partial<Record<LcoCage['id'], string>>
  inspectionFreshnessThresholds: InspectionFreshnessThresholds
  inspectionAgeThresholds: InspectionAgeThresholds
  migratedLegacyFingerprints: string[]
}

export const DEFAULT_INSPECTION_FRESHNESS_THRESHOLDS: InspectionFreshnessThresholds = {
  staleDays: 90,
  veryStaleDays: 180,
}

export const DEFAULT_INSPECTION_AGE_THRESHOLDS: InspectionAgeThresholds = {
  recentDays: 30,
  dueDays: 60,
  oldDays: 90,
}

export const LCO_CAGE_NUMBERS: LcoCageNumber[] = [1, 2, 3, 4, 5, 6, 7, 8]
export const LCO_NORTH_CAGES: LcoCageNumber[] = [2, 4, 6, 8]
export const LCO_SOUTH_CAGES: LcoCageNumber[] = [1, 3, 5, 7]
export const LCO_SHAFT_POSITIONS: LcoShaftPosition[] = ['UPPER', 'LOWER']
export const LCO_COUPLING_SIDES: LcoCouplingSide[] = ['GEARBOX', 'STAND']
export const COUPLING_WEAR_LEVELS: CouplingWearLevel[] = [1, 2, 3, 4, 5]
export const COUPLING_CONDITION_CODES: CouplingConditionCode[] = ['NORMAL', 'JUEGO', 'DESGASTE_DIENTES', 'MARCAS', 'FISURA', 'LUBRICACION', 'OTRO']

export const couplingWearLabels: Record<CouplingWearLevel, string> = {
  1: 'Nuevo / muy bueno',
  2: 'Bueno',
  3: 'Regular',
  4: 'Desgastado',
  5: 'Crítico',
}

export function createLcoCageId(cageNumber: LcoCageNumber): LcoCage['id'] {
  return `J${cageNumber}`
}

export function createLcoShaftId(cageNumber: LcoCageNumber, position: LcoShaftPosition) {
  return `${createLcoCageId(cageNumber)}_${position === 'UPPER' ? 'SUP' : 'INF'}`
}

export function createLcoCouplingId(cageNumber: LcoCageNumber, position: LcoShaftPosition, side: LcoCouplingSide) {
  return `${createLcoShaftId(cageNumber, position)}_${side === 'GEARBOX' ? 'RED' : 'JAU'}`
}

export function createDefaultLcoCouplingTopology(): LcoCouplingTopology {
  const cages = LCO_CAGE_NUMBERS.map((cageNumber): LcoCage => ({
    id: createLcoCageId(cageNumber),
    cageNumber,
    side: cageNumber % 2 === 0 ? 'NORTH' : 'SOUTH',
  }))
  const shafts = LCO_CAGE_NUMBERS.flatMap((cageNumber) => LCO_SHAFT_POSITIONS.map((position): LcoExtensionShaft => ({
    id: createLcoShaftId(cageNumber, position),
    cageNumber,
    position,
    couplingIds: LCO_COUPLING_SIDES.map((side) => createLcoCouplingId(cageNumber, position, side)) as [string, string],
  })))
  const couplings = LCO_CAGE_NUMBERS.flatMap((cageNumber) => LCO_SHAFT_POSITIONS.flatMap((shaftPosition) => LCO_COUPLING_SIDES.map((side): LcoCoupling => ({
    id: createLcoCouplingId(cageNumber, shaftPosition, side),
    cageNumber,
    shaftPosition,
    side,
  }))))
  return { cages, shafts, couplings }
}

export function createEmptyLcoCouplingData(): LcoCouplingModuleData {
  return {
    events: [],
    cageAssetIds: {},
    inspectionFreshnessThresholds: { ...DEFAULT_INSPECTION_FRESHNESS_THRESHOLDS },
    inspectionAgeThresholds: { ...DEFAULT_INSPECTION_AGE_THRESHOLDS },
    migratedLegacyFingerprints: [],
  }
}

const topology = createDefaultLcoCouplingTopology()
const couplingIds = new Set(topology.couplings.map((coupling) => coupling.id))

export function isLcoCageNumber(value: unknown): value is LcoCageNumber {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 8
}

export function isLcoShaftPosition(value: unknown): value is LcoShaftPosition {
  return value === 'UPPER' || value === 'LOWER'
}

export function isCouplingWearLevel(value: unknown): value is CouplingWearLevel {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5
}

export function isLcoCouplingId(value: unknown): value is string {
  return typeof value === 'string' && couplingIds.has(value)
}

export function getLcoCouplingById(id: string) {
  return topology.couplings.find((coupling) => coupling.id === id)
}

export function getLcoShaftById(id: string) {
  return topology.shafts.find((shaft) => shaft.id === id)
}

export function getCouplingsForShaft(cageNumber: LcoCageNumber, shaftPosition: LcoShaftPosition) {
  return topology.couplings.filter((coupling) => coupling.cageNumber === cageNumber && coupling.shaftPosition === shaftPosition)
}

export function getCouplingsForCage(cageNumber: LcoCageNumber) {
  return topology.couplings.filter((coupling) => coupling.cageNumber === cageNumber)
}

import { parseDateOnly, todayDateOnly } from '../domain/maintenanceDateService'
import { EMPTY_MAINTENANCE_DATA, type MaintenanceData, type MaintenanceEventType, type MaintenanceIntervalUnit, type MaintenanceSource, type TrackingMode } from '../domain/maintenanceTypes'
import { normalizeLcoCouplingData } from './lcoCouplingNormalizer'

const sources = new Set<MaintenanceSource>(['LOCAL', 'SAP', 'PLC', 'API', 'IMPORTED'])
const eventTypes = new Set<MaintenanceEventType>(['INSPECTION', 'LUBRICATION', 'ADJUSTMENT', 'REPAIR', 'REPLACEMENT', 'OVERHAUL', 'FAILURE', 'NOTE'])
const intervalUnits = new Set<MaintenanceIntervalUnit>(['DAYS', 'WEEKS', 'MONTHS', 'YEARS'])
const trackingModes = new Set<TrackingMode>(['REPLACEMENT', 'SERIALIZED'])
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback
const bool = (value: unknown, fallback = true) => typeof value === 'boolean' ? value : fallback
const source = (value: unknown): MaintenanceSource => sources.has(value as MaintenanceSource) ? value as MaintenanceSource : 'IMPORTED'
const createdAt = (value: unknown) => text(value, new Date().toISOString())

export function normalizeMaintenanceData(value: unknown): MaintenanceData {
  if (!value || typeof value !== 'object') return structuredClone(EMPTY_MAINTENANCE_DATA)
  const raw = value as Partial<Record<keyof MaintenanceData, unknown>>
  const array = (item: unknown): any[] => Array.isArray(item) ? item.filter((entry) => entry && typeof entry === 'object') : []
  return {
    equipment: array(raw.equipment).map((item) => ({ id: text(item.id), assetId: text(item.assetId), name: text(item.name, 'Equipo'), active: bool(item.active), source: source(item.source), createdAt: createdAt(item.createdAt) })).filter((item) => item.id && item.assetId),
    subassemblies: array(raw.subassemblies).map((item) => ({ id: text(item.id), equipmentId: text(item.equipmentId), name: text(item.name, 'Posicion funcional'), description: text(item.description), sapId: text(item.sapId), active: bool(item.active), criticality: ['A', 'B', 'C', 'D'].includes(item.criticality) ? item.criticality : '', trackingMode: trackingModes.has(item.trackingMode) ? item.trackingMode : 'REPLACEMENT', source: source(item.source), createdAt: createdAt(item.createdAt) })).filter((item) => item.id && item.equipmentId),
    plans: array(raw.plans).map((item) => ({ id: text(item.id), subassemblyId: text(item.subassemblyId), name: text(item.name, 'Plan preventivo'), intervalValue: Math.max(1, Math.trunc(Number(item.intervalValue) || 1)), intervalUnit: intervalUnits.has(item.intervalUnit) ? item.intervalUnit : 'MONTHS', warningDays: Math.max(0, Math.trunc(Number(item.warningDays) || 30)), criticalDays: Math.max(0, Math.trunc(Number(item.criticalDays) || 7)), active: bool(item.active), source: source(item.source), createdAt: createdAt(item.createdAt) })).filter((item) => item.id && item.subassemblyId),
    events: array(raw.events).map((item) => ({ id: text(item.id), subassemblyId: text(item.subassemblyId), type: eventTypes.has(item.type) ? item.type : 'NOTE', date: parseDateOnly(text(item.date)) ? text(item.date) : todayDateOnly(), notes: text(item.notes), workOrder: text(item.workOrder), source: source(item.source), createdAt: createdAt(item.createdAt) })).filter((item) => item.id && item.subassemblyId),
    units: array(raw.units).map((item) => structuredClone(item)),
    lcoCouplings: normalizeLcoCouplingData(raw.lcoCouplings),
  }
}

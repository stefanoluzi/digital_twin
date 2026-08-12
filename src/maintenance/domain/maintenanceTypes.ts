export type MaintenanceSource = 'LOCAL' | 'SAP' | 'PLC' | 'API' | 'IMPORTED'
export type MaintenanceEventType = 'INSPECTION' | 'LUBRICATION' | 'ADJUSTMENT' | 'REPAIR' | 'REPLACEMENT' | 'OVERHAUL' | 'FAILURE' | 'NOTE'
export type MaintenanceIntervalUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS'
export type MaintenanceStatus = 'OK' | 'WARNING' | 'CRITICAL' | 'OVERDUE' | 'NO_PLAN' | 'NO_HISTORY' | 'INACTIVE'
export type OperationalReplacementStatus = 'CURRENT' | 'DUE_SOON' | 'OVERDUE' | 'NO_DATA' | 'INACTIVE'
export type TrackingMode = 'REPLACEMENT' | 'SERIALIZED'

export interface Equipment {
  id: string
  assetId: string
  name: string
  active: boolean
  source: MaintenanceSource
  createdAt: string
}

export interface Subassembly {
  id: string
  equipmentId: string
  name: string
  description: string
  sapId: string
  active: boolean
  criticality: 'A' | 'B' | 'C' | 'D' | ''
  trackingMode: TrackingMode
  source: MaintenanceSource
  createdAt: string
}

export interface MaintenancePlan {
  id: string
  subassemblyId: string
  name: string
  intervalValue: number
  intervalUnit: MaintenanceIntervalUnit
  warningDays: number
  criticalDays: number
  active: boolean
  source: MaintenanceSource
  createdAt: string
}

export interface MaintenanceEvent {
  id: string
  subassemblyId: string
  type: MaintenanceEventType
  date: string
  notes: string
  workOrder: string
  source: MaintenanceSource
  createdAt: string
}

export interface MaintenanceData {
  equipment: Equipment[]
  subassemblies: Subassembly[]
  plans: MaintenancePlan[]
  events: MaintenanceEvent[]
  /** Reserved for the next serialized-units phase. No unit behavior is implemented in schema v3. */
  units: unknown[]
}

export interface SubassemblyMaintenanceState {
  subassemblyId: string
  status: MaintenanceStatus
  lastEventDate: string | null
  nextDueDate: string | null
  daysRemaining: number | null
  daysOverdue: number
  operationalStatus: OperationalReplacementStatus
}

export interface EquipmentMaintenanceSummary {
  equipmentId: string
  status: MaintenanceStatus
  attentionScore: number
  total: number
  counts: Record<MaintenanceStatus, number>
  nearestDueDate: string | null
}

export const EMPTY_MAINTENANCE_DATA: MaintenanceData = {
  equipment: [], subassemblies: [], plans: [], events: [], units: [],
}

export const MAINTENANCE_STATUSES: MaintenanceStatus[] = ['OVERDUE', 'CRITICAL', 'WARNING', 'OK', 'NO_PLAN', 'NO_HISTORY', 'INACTIVE']

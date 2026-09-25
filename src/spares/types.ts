import type { PlantAreaCode } from '../config/areas'

export type SpareUnitStatus = 'WAREHOUSE' | 'MACHINE_SIDE' | 'INSTALLED' | 'IN_REPAIR' | 'ON_ORDER'
export type SpareRole = 'ADMIN' | 'SUPERVISOR'

export interface GmbResponsible {
  id: string
  name: string
  active: boolean
}

export interface SpareArea {
  /** El código central de planta es también el ID estable del área. */
  id: PlantAreaCode
  code: PlantAreaCode
  name: string
  responsibleGmbId?: string
  /** Solo para resolver conflictos encontrados al migrar datos antiguos. */
  migrationCandidateIds?: string[]
}

export interface SpareEquipment {
  id: string
  area: PlantAreaCode
  name: string
}

export interface SpareType {
  id: string
  sapNumber: string
  name: string
  description: string
  categoryId: string
  area: PlantAreaCode
  compatibleEquipmentIds: string[]
  drawingNumber: string
  drawingPdf?: string
  drawingPdfName?: string
  referencePhoto?: string
  comments: string
  createdAt: string
  updatedAt: string
  /** Inicio del período actual sin respaldo; null cuando está cubierto. */
  uncoveredAt?: string | null
}

export interface PhysicalSpareUnit {
  id: string
  spareTypeId: string
  status: SpareUnitStatus
  statusSince: string
  comment: string
  location: string
  installedEquipmentId?: string
  installationDate?: string
  sapNotice?: string
  repairStartDate?: string
  solp?: string
  purchaseOrder?: string
  eta?: string
  photo?: string
}

export interface SpareHistoryEvent {
  id: string
  unitId: string
  spareTypeId: string
  timestamp: string
  user: string
  previousStatus?: SpareUnitStatus
  nextStatus: SpareUnitStatus
  equipmentId?: string
  comment: string
  snapshot: Partial<PhysicalSpareUnit>
}

export interface CriticalSparesConfig {
  areas: SpareArea[]
  categories: { id: string; name: string }[]
  equipment: SpareEquipment[]
  responsibles: GmbResponsible[]
  users: { id: string; name: string; role: SpareRole }[]
  currentUserId: string
}

export interface CriticalSparesData {
  schemaVersion: 2
  spareTypes: SpareType[]
  units: PhysicalSpareUnit[]
  history: SpareHistoryEvent[]
  config: CriticalSparesConfig
}

export type SparesView = 'DASHBOARD' | 'SPARES' | 'TRACKING' | 'HISTORY' | 'CONFIG'

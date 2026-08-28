import rawCatalog from './globalMaintenanceTasks.json'
import type { PlantAreaCode } from '../../config/areas'

export type GlobalTaskKind = 'REPLACEMENT' | 'REPAIR' | 'INSPECTION' | 'PROCUREMENT' | 'OTHER'
export type GlobalTaskCriticality = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNSPECIFIED'
export type CampaignStatus = 'DONE' | 'PLANNED' | 'NOT_DONE' | 'UNRECORDED' | 'UNKNOWN'

export interface GlobalMaintenanceCampaign {
  id: string
  label: string
  kind: 'REX' | 'BO'
  period: string | null
}

export interface GlobalMaintenanceTask {
  id: string
  sourceRow: number
  line: string
  sectorCode: string
  areaCode: PlantAreaCode
  specialty: string
  name: string
  kind: GlobalTaskKind
  referenceWorkOrder: string
  impacts: string[]
  frequencyYears: number | null
  frequencySource: string
  interventionDays: number | null
  criticality: GlobalTaskCriticality
  workforce: {
    mechanicalContractors: number | null
    electricalContractors: number | null
    totalContractors: number | null
    contractorHours: number | null
  }
  costsUsd: {
    mro: number | null
    contractorLabor: number | null
    services: number | null
    ownLabor: number | null
    total: number | null
  }
  campaigns: Partial<Record<string, CampaignStatus>>
  campaignRaw: Partial<Record<string, string>>
  associatedPlan: string
  controlData: string
  justification: string
  documentationAvailable: boolean
  sourceWarnings: string[]
}

export interface GlobalMaintenanceCatalog {
  metadata: {
    sourceFile: string
    sheet: string
    sourceRows: number
    validTasks: number
    excludedRowsWithoutTask: number
    unlinkedPlanIds: string[]
  }
  campaigns: GlobalMaintenanceCampaign[]
  tasks: GlobalMaintenanceTask[]
}

export const GLOBAL_MAINTENANCE_CATALOG = rawCatalog as GlobalMaintenanceCatalog

export const globalTaskKindLabels: Record<GlobalTaskKind, string> = {
  REPLACEMENT: 'Cambio / recambio',
  REPAIR: 'Reparación',
  INSPECTION: 'Control / inspección',
  PROCUREMENT: 'Compra / fabricación',
  OTHER: 'Otra tarea',
}

export const globalTaskCriticalityLabels: Record<GlobalTaskCriticality, string> = {
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
  UNSPECIFIED: 'Sin definir',
}

export const campaignStatusLabels: Record<CampaignStatus, string> = {
  DONE: 'Ejecutada',
  PLANNED: 'Planificada',
  NOT_DONE: 'No ejecutada',
  UNRECORDED: 'Sin registro',
  UNKNOWN: 'Dato a revisar',
}

export interface GlobalTaskHistorySummary {
  doneCount: number
  plannedCount: number
  latestDone: GlobalMaintenanceCampaign | null
  hasUnknown: boolean
}

export function getGlobalTaskCampaignStatus(task: GlobalMaintenanceTask, campaignId: string): CampaignStatus {
  return task.campaigns[campaignId] ?? 'UNRECORDED'
}

export function getGlobalTaskHistorySummary(task: GlobalMaintenanceTask): GlobalTaskHistorySummary {
  const done = GLOBAL_MAINTENANCE_CATALOG.campaigns.filter((campaign) => getGlobalTaskCampaignStatus(task, campaign.id) === 'DONE')
  const plannedCount = GLOBAL_MAINTENANCE_CATALOG.campaigns.filter((campaign) => getGlobalTaskCampaignStatus(task, campaign.id) === 'PLANNED').length
  const latestDone = done.reduce<GlobalMaintenanceCampaign | null>((latest, campaign) => {
    if (!latest) return campaign
    if (!latest.period) return campaign.period ? campaign : latest
    if (!campaign.period) return latest
    return campaign.period > latest.period ? campaign : latest
  }, null)
  return {
    doneCount: done.length,
    plannedCount,
    latestDone,
    hasUnknown: GLOBAL_MAINTENANCE_CATALOG.campaigns.some((campaign) => getGlobalTaskCampaignStatus(task, campaign.id) === 'UNKNOWN'),
  }
}

export function getGlobalCatalogSummary() {
  const tasks = GLOBAL_MAINTENANCE_CATALOG.tasks
  return {
    total: tasks.length,
    replacements: tasks.filter((task) => task.kind === 'REPLACEMENT').length,
    repairs: tasks.filter((task) => task.kind === 'REPAIR').length,
    highCriticality: tasks.filter((task) => task.criticality === 'HIGH').length,
    withExecution: tasks.filter((task) => getGlobalTaskHistorySummary(task).doneCount > 0).length,
    withPlannedCampaign: tasks.filter((task) => getGlobalTaskHistorySummary(task).plannedCount > 0).length,
    totalCostUsd: tasks.reduce((sum, task) => sum + (task.costsUsd.total ?? 0), 0),
  }
}

export function compareGlobalTasks(a: GlobalMaintenanceTask, b: GlobalMaintenanceTask) {
  const sectorA = a.sectorCode === 'TRANSVERSAL' ? Number.MAX_SAFE_INTEGER : Number.parseInt(a.sectorCode, 10)
  const sectorB = b.sectorCode === 'TRANSVERSAL' ? Number.MAX_SAFE_INTEGER : Number.parseInt(b.sectorCode, 10)
  if (sectorA !== sectorB) return sectorA - sectorB
  const criticalityOrder: Record<GlobalTaskCriticality, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, UNSPECIFIED: 3 }
  return criticalityOrder[a.criticality] - criticalityOrder[b.criticality] || a.name.localeCompare(b.name, 'es')
}

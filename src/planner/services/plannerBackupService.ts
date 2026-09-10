import { normalizePlannerData } from '../data/plannerNormalizer'
import type { PlannerModuleData } from '../types'

export const PLANNER_BACKUP_SCHEMA_VERSION = 1

export interface PlannerBackupFile extends PlannerModuleData {
  format: 'LACO_MAINTENANCE_PLANNER_BACKUP'
  schemaVersion: number
  exportedAt: string
}

export function createPlannerBackup(data: PlannerModuleData, exportedAt = new Date().toISOString()): PlannerBackupFile {
  return { format: 'LACO_MAINTENANCE_PLANNER_BACKUP', schemaVersion: PLANNER_BACKUP_SCHEMA_VERSION, exportedAt, ...normalizePlannerData(data) }
}

export function serializePlannerBackup(data: PlannerModuleData, exportedAt?: string) {
  return JSON.stringify(createPlannerBackup(data, exportedAt), null, 2)
}

export function parsePlannerBackup(value: string | unknown): PlannerModuleData {
  const raw = typeof value === 'string' ? JSON.parse(value) : value
  if (!raw || typeof raw !== 'object') throw new Error('El respaldo del Planner no es válido.')
  const backup = raw as Partial<PlannerBackupFile>
  if ('format' in backup && (backup.format !== 'LACO_MAINTENANCE_PLANNER_BACKUP' || backup.schemaVersion !== PLANNER_BACKUP_SCHEMA_VERSION)) throw new Error('Formato o versión de respaldo del Planner no compatible.')
  if (!backup.projectInfo || !Array.isArray(backup.tasks) || !Array.isArray(backup.paradas)) throw new Error('El respaldo no contiene un proyecto, tareas y paradas válidos.')
  return normalizePlannerData(backup)
}

export function plannerBackupFileName(data: PlannerModuleData, date = new Date()) {
  const projectName = data.projectInfo.name.trim().replace(/[^a-z0-9áéíóúñ]+/gi, '_').replace(/^_+|_+$/g, '') || 'Mantenimiento_General'
  return `Planner_${projectName}_${date.toISOString().slice(0, 10)}.planner.json`
}

import { normalizeLcoCouplingData } from '../data/lcoCouplingNormalizer'
import type { LcoCouplingModuleData } from '../domain/lcoCouplings'

export const LCO_BACKUP_SCHEMA_VERSION = 1

export interface LcoBackupFile {
  format: 'LCO_COUPLINGS_BACKUP'
  schemaVersion: number
  exportedAt: string
  config: Omit<LcoCouplingModuleData, 'events'>
  events: LcoCouplingModuleData['events']
}

export function createLcoBackup(data: LcoCouplingModuleData, exportedAt = new Date().toISOString()): LcoBackupFile {
  const normalized = normalizeLcoCouplingData(data)
  const { events, ...config } = normalized
  return { format: 'LCO_COUPLINGS_BACKUP', schemaVersion: LCO_BACKUP_SCHEMA_VERSION, exportedAt, config, events }
}

export function serializeLcoBackup(data: LcoCouplingModuleData, exportedAt?: string) {
  return JSON.stringify(createLcoBackup(data, exportedAt))
}

export function parseLcoBackup(value: string | unknown): LcoCouplingModuleData {
  const raw = typeof value === 'string' ? JSON.parse(value) : value
  if (!raw || typeof raw !== 'object') throw new Error('El respaldo LCO no es válido.')
  const backup = raw as Partial<LcoBackupFile>
  if (backup.format !== 'LCO_COUPLINGS_BACKUP' || backup.schemaVersion !== LCO_BACKUP_SCHEMA_VERSION || !Array.isArray(backup.events) || !backup.config || typeof backup.config !== 'object') throw new Error('Formato o versión de respaldo LCO no compatible.')
  const data = normalizeLcoCouplingData({ ...backup.config, events: backup.events })
  if (data.events.length !== backup.events.length) throw new Error('El respaldo contiene eventos o identificadores inválidos.')
  return data
}

export function getLcoBackupStats(data: LcoCouplingModuleData) {
  return {
    inspections: data.events.filter((event) => event.type === 'INSPECTION').length,
    replacements: data.events.filter((event) => event.type !== 'INSPECTION').length,
    photos: data.events.reduce((total, event) => total + event.attachments.length + (event.type === 'INSPECTION' ? event.readings.reduce((sum, reading) => sum + (reading.attachments?.length ?? 0), 0) : 0), 0),
  }
}

export function lcoBackupFileName(date = new Date()) {
  return `LCO_Couplings_Backup_${date.toISOString().slice(0, 10)}.lcocouplings`
}

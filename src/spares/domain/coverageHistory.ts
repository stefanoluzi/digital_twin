import type { CriticalSparesData } from '../types'
import { coverageSummary } from './spareSelectors'
import { coverageByArea, coverageByGmb } from './dashboardSelectors'

export const SIN_AVANCE_WARNING_DAYS = 14
export const SIN_AVANCE_CRITICAL_DAYS = 30
export const HISTORY_PERIODS = ['7', '30', '90', '180', '365', 'ALL', 'CUSTOM'] as const
export type HistoryPeriod = typeof HISTORY_PERIODS[number]
export type CoverageMetrics = ReturnType<typeof coverageSummary>
export interface CoverageGroup extends CoverageMetrics {
  dimension: 'AREA' | 'GMB'; key: string; name: string
  responsibleId: string | null; responsibleName: string | null; areaIds: string[]
  trackedSince: string | null; lastImprovedAt: string | null
}
export interface CoveragePoint extends CoverageMetrics {
  id: number; capturedAt: string; groups: CoverageGroup[]
}
export interface CoverageHistoryResponse {
  availableSince: string | null; from: string; until: string; points: CoveragePoint[]
  baseline: CoveragePoint | null; current: CoveragePoint | null; thirtyDaysAgo: CoveragePoint | null
  warningDays: number; criticalDays: number
}

/** Same selectors as the Dashboard, without its temporary screen filters. */
export function captureCoverage(data: CriticalSparesData) {
  const global = coverageSummary(data)
  const groups = [
    ...coverageByArea(data, 'operational').map((row) => ({ ...row, dimension: 'AREA' as const,
      key: row.id, responsibleId: data.config.areas.find((area) => area.id === row.id)?.responsibleGmbId || null,
      responsibleName: row.responsible, areaIds: [row.id] })),
    ...coverageByGmb(data).map((row) => ({ ...row, dimension: 'GMB' as const, key: row.id,
      responsibleId: row.id, responsibleName: row.name, areaIds: [...row.areas].sort() })),
  ].map((row) => ({ dimension: row.dimension, key: row.key, name: row.name,
    responsibleId: row.responsibleId, responsibleName: row.responsibleName, areaIds: row.areaIds,
    total: row.total, covered: row.covered, uncovered: row.uncovered, percent: row.percent,
    repair: row.repair, purchase: row.purchase,
  })).sort((a, b) => `${a.dimension}:${a.key}`.localeCompare(`${b.dimension}:${b.key}`))
  return { ...global, groups }
}

const DAY = 86400000
export function historyRange(period: HistoryPeriod, from?: string, until?: string, now = new Date()) {
  let end = now
  let start: Date
  if (period === 'CUSTOM') {
    const civil = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
    if (!civil(from) || !civil(until)) throw new Error('Indicá fechas válidas de inicio y fin.')
    start = new Date(`${from}T00:00:00.000Z`)
    end = new Date(Math.min(now.getTime(), Date.parse(`${until}T23:59:59.999Z`)))
  } else start = period === 'ALL' ? new Date(0) : new Date(end.getTime() - Number(period) * DAY)
  if (!Number.isFinite(start.getTime()) || start > end) throw new Error('El inicio debe ser anterior al fin y no estar en el futuro.')
  return { from: start.toISOString(), until: end.toISOString() }
}

export function coverageChange(before?: CoverageMetrics | null, after?: CoverageMetrics | null) {
  return before?.total && after?.total ? after.percent - before.percent : null
}
export function groupProgress(current: CoverageGroup, previous: CoverageGroup | undefined, now: string,
  warningDays = SIN_AVANCE_WARNING_DAYS, criticalDays = SIN_AVANCE_CRITICAL_DAYS) {
  const change = coverageChange(previous, current)
  const since = current.lastImprovedAt || current.trackedSince
  const days = since && current.total ? Math.max(0, Math.floor((Date.parse(now) - Date.parse(since)) / DAY)) : null
  const status = !current.total ? 'Sin datos' : !current.uncovered ? 'Cubierto' : change !== null && change < 0 ? 'Retroceso'
    : days !== null && days >= criticalDays ? 'Sin avance crítico' : days !== null && days >= warningDays ? 'Sin avance'
    : change !== null && change > 0 ? 'Avanzando' : 'En observación'
  return { change, days, status, stagnant: status === 'Sin avance' || status === 'Sin avance crítico' }
}

import { Router } from 'express'
import type { Prisma, PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'
import { captureCoverage, HISTORY_PERIODS, historyRange, SIN_AVANCE_CRITICAL_DAYS, SIN_AVANCE_WARNING_DAYS, type HistoryPeriod } from '../src/spares/domain/coverageHistory'
import type { CriticalSparesData } from '../src/spares/types'
import { ApiError } from './errors'

/** Caller holds the Revision lock. A snapshot and its triggering write commit together. */
export async function recordCoverage(tx: Prisma.TransactionClient, data: CriticalSparesData, revision: number, now = new Date()) {
  const metrics = captureCoverage(data)
  const signature = createHash('sha256').update(JSON.stringify(metrics)).digest('hex')
  const previous = await tx.coverageSnapshot.findFirst({ orderBy: { id: 'desc' }, include: { groups: true } })
  if (previous?.signature === signature) return previous
  const { groups, ...global } = metrics
  return tx.coverageSnapshot.create({ data: { ...global, revision, capturedAt: now, signature,
    groups: { create: groups.map((group) => {
      const old = previous?.groups.find((item) => item.dimension === group.dimension && item.key === group.key)
      const continuous = old && old.total > 0 && group.total > 0
      return { ...group, trackedSince: group.total ? (continuous ? old.trackedSince : now) : null,
        lastImprovedAt: continuous ? (group.percent > old.percent ? now : old.lastImprovedAt) : null }
    }) },
  } })
}

export function coverageHistoryRouter(db: PrismaClient) {
  const router = Router()
  router.get('/', async (req, res) => {
    const period = String(req.query.period || '30')
    if (!HISTORY_PERIODS.includes(period as HistoryPeriod)) throw new ApiError(422, 'Período inválido')
    let range
    try { range = historyRange(period as HistoryPeriod, String(req.query.from || ''), String(req.query.until || '')) }
    catch (error) { throw new ApiError(422, (error as Error).message) }
    const result = await db.$transaction(async (tx) => {
      const latest = (date: Date) => tx.coverageSnapshot.findFirst({ where: { capturedAt: { lte: date } }, orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }], include: { groups: true } })
      const [first, baseline, current, thirtyDaysAgo, points] = await Promise.all([
        tx.coverageSnapshot.findFirst({ orderBy: [{ capturedAt: 'asc' }, { id: 'asc' }], select: { capturedAt: true } }),
        latest(new Date(range.from)), latest(new Date(range.until)),
        latest(new Date(Date.parse(range.until) - 30 * 86400000)),
        tx.coverageSnapshot.findMany({ where: { capturedAt: { gt: new Date(range.from), lte: new Date(range.until) } }, orderBy: [{ capturedAt: 'asc' }, { id: 'asc' }], include: { groups: true } }),
      ])
      return { availableSince: first?.capturedAt || null, ...range, baseline, current, thirtyDaysAgo, points,
        warningDays: SIN_AVANCE_WARNING_DAYS, criticalDays: SIN_AVANCE_CRITICAL_DAYS }
    }, { isolationLevel: 'RepeatableRead' })
    res.json(result)
  })
  return router
}

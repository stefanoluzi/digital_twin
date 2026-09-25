import type { RepairRequest, RepairItem, RepairBlock, RepairEvent, BlockOwner } from './types'
export const day = (date: string) => date.slice(0, 10)
import { systemDay, monthEnd, fiscalMonths } from './calendar'
export const today = systemDay
export const plantDeadline = (request: RepairRequest) => request.requiredDate ? day(request.requiredDate) : monthEnd(request.targetMonth)

export const daysBetween = (from: string, to: string) => Math.max(0, Math.floor((Date.parse(day(to)) - Date.parse(day(from))) / 86400000))
export const difference = (from: string, to: string) => Math.round((Date.parse(day(to)) - Date.parse(day(from))) / 86400000)
export const monthSequence = (start: string, count = 12) => Array.from({ length: count }, (_, index) => { const date = new Date(`${start.slice(0, 7)}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + index); return date.toISOString().slice(0, 7) })
export function itemMetrics(item: RepairItem, request: RepairRequest, asOf = today(), warningDays = 7) {
  const first = item.commitments[0]?.date || null
  const committed = item.commitments[item.commitments.length - 1]?.date || null
  const open = !['DELIVERED', 'CANCELLED'].includes(item.status)
  const actual = item.delivery?.deliveredAt
  const workshopLate = item.status !== 'CANCELLED' && !!committed && difference(committed, actual || asOf) > 0
  const deadline = plantDeadline(request)
  const plantLate = item.status !== 'CANCELLED' && difference(deadline, actual || asOf) > 0
  const commitmentMismatch = !!committed && day(committed) > deadline
  const criticalDate = request.criticalDueDate || deadline
  const near = difference(asOf, criticalDate) <= warningDays
  return { first, committed, open, workshopLate, plantLate, commitmentMismatch,
    overdue: open && (workshopLate || plantLate), lateDays: Math.max(0, difference(deadline, actual || asOf), committed ? difference(committed, actual || asOf) : 0),
    criticalRisk: open && request.criticality === 'CRITICAL' && (near || workshopLate || plantLate || commitmentMismatch || item.status === 'BLOCKED'),
    activeBlocks: item.blocks.filter((block) => !block.resolvedAt),
    originalDeviation: actual && first ? difference(first, actual) : null,
    currentDeviation: actual && committed ? difference(committed, actual) : null,
    plantDeviation: actual ? difference(deadline, actual) : null,
  }
}
export function blockedDays(block: RepairBlock, asOf = today()) { return daysBetween(block.startedAt, block.resolvedAt && day(block.resolvedAt) < asOf ? block.resolvedAt : asOf) }
export function requestMetrics(request: RepairRequest, asOf = today(), warningDays = 7) {
  const items = request.items.map((item) => itemMetrics(item, request, asOf, warningDays))
  const delivered = request.items.filter((item) => item.status === 'DELIVERED').length
  const counts = Object.fromEntries(['PENDING', 'IN_PROGRESS', 'BLOCKED', 'DELIVERED', 'CANCELLED'].map((status) => [status, request.items.filter((item) => item.status === status).length]))
  const blocks = items.flatMap((item) => item.activeBlocks)
  const overdue = items.some((item) => item.overdue)
  const criticalRisk = items.some((item) => item.criticalRisk)
  const priority = !items.some((item) => item.open) ? 6 : request.criticality === 'CRITICAL' && overdue ? 0 : criticalRisk ? 1 : overdue ? 2 : blocks.some((b) => b.owner === 'PLANT') ? 3 : blocks.some((b) => b.owner === 'WORKSHOP') ? 4 : items.some((item) => item.open && item.commitmentMismatch) ? 5 : 6
  const tone = overdue ? 'late' : counts.BLOCKED ? 'blocked' : delivered === request.quantity ? 'delivered' : counts.IN_PROGRESS ? 'progress' : 'planned'
  return { items, delivered, counts, blocks, overdue, criticalRisk, priority, tone, active: items.some((item) => item.open), pending: items.filter((item) => item.open).length, lateDays: Math.max(0, ...items.filter((item) => item.open).map((item) => item.lateDays)) }
}
export function dashboardMetrics(requests: RepairRequest[], asOf = today(), warningDays = 7) {
  const metrics = requests.map((request) => requestMetrics(request, asOf, warningDays))
  return { active: metrics.filter((m) => m.active).length, inProgress: metrics.filter((m) => m.counts.IN_PROGRESS).length, blocked: metrics.filter((m) => m.counts.BLOCKED).length, overdue: metrics.filter((m) => m.overdue).length, critical: metrics.filter((m) => m.criticalRisk).length, plant: metrics.filter((m) => m.blocks.some((b) => b.owner === 'PLANT')).length, deliveredMonth: requests.flatMap((r) => r.items).filter((item) => item.delivery && item.delivery.deliveredAt.slice(0, 7) === asOf.slice(0, 7) && day(item.delivery.deliveredAt) <= asOf).length }
}
/** Recorded knowledge, not a rewrite using today's catalogs/status. */
export function stateAt(events: RepairEvent[], instant: string): RepairRequest[] {
  const latest = new Map<string, RepairRequest>()
  for (const event of [...events].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id - b.id)) if (event.recordedAt <= instant) latest.set(event.requestId, event.snapshot)
  // Read legacy snapshots without rewriting the append-only audit trail.
  return [...latest.values()].map((r) => ({ ...r, items: r.items.map((i) => ({ ...i, status: String(i.status) === 'PLANNED' ? 'PENDING' : i.status })) }))
}
export function historicalMetrics(requests: RepairRequest[], from: string, until: string) {
  const records = requests.flatMap((request) => request.items.map((item) => ({ request, item, m: itemMetrics(item, request, until) })))
  const deliveries = records.filter(({ item }) => item.delivery && day(item.delivery.deliveredAt) >= from && day(item.delivery.deliveredAt) <= until)
  const comparable = deliveries.filter(({ m }) => m.currentDeviation !== null)
  const delays = comparable.map(({ m }) => Math.max(0, m.currentDeviation!)).sort((a, b) => a - b)
  const middle = Math.floor(delays.length / 2)
  const byOwner: Partial<Record<BlockOwner, number>> = {}
  for (const { item } of records) for (const block of item.blocks) {
    const start = day(block.startedAt) > from ? day(block.startedAt) : from
    const end = block.resolvedAt && day(block.resolvedAt) < until ? day(block.resolvedAt) : until
    byOwner[block.owner] = (byOwner[block.owner] || 0) + daysBetween(start, end)
  }
  const onTime = comparable.filter(({ m }) => m.currentDeviation! <= 0).length
  const originalOnTime = comparable.filter(({ m }) => m.originalDeviation !== null && m.originalDeviation <= 0).length
  const plannedItems = records.filter(({ request }) => request.targetMonth.slice(0, 7) >= from.slice(0, 7) && request.targetMonth.slice(0, 7) <= until.slice(0, 7))
  const planDelivered = plannedItems.filter(({ item }) => item.delivery && day(item.delivery.deliveredAt) <= until).length
  return { planned: plannedItems.length, delivered: deliveries.length, comparable: comparable.length, onTime, originalOnTime, percent: comparable.length ? Math.round(onTime / comparable.length * 100) : null, originalPercent: comparable.length ? Math.round(originalOnTime / comparable.length * 100) : null, meanLate: delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length * 10) / 10 : null, medianLate: delays.length ? delays.length % 2 ? delays[middle] : (delays[middle - 1] + delays[middle]) / 2 : null, reschedules: records.reduce((n, { item }) => n + item.commitments.filter((c) => c.sequence > 1 && day(c.recordedAt) >= from && day(c.recordedAt) <= until).length, 0), byOwner,
    planDelivered, planPercent: plannedItems.length ? Math.round(planDelivered / plannedItems.length * 100) : null,
    overdueWithNonWorkshopBlocks: deliveries.filter(({ item, m }) => m.workshopLate && item.blocks.some((b) => b.owner !== 'WORKSHOP')).length }
}
export function legacyQuantity(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null
  if (/^x$/i.test(String(value).trim())) return 1
  const amount = typeof value === 'number' || /^\d+$/.test(String(value).trim()) ? Number(value) : NaN
  if (!Number.isInteger(amount) || amount < 1 || amount > 1000) throw new Error(`Cantidad legacy no reconocida: ${String(value)}`)
  return amount
}

/** Plan fulfilment to date: future units never enter the denominator. Cancelled
 * units stay in the original plan; they are not fabricated deliveries. */
export function exerciseMetrics(requests: RepairRequest[], year: number, asOf = today()) {
  const months = fiscalMonths(year)
  const cohort = requests.filter((r) => months.includes(r.targetMonth.slice(0, 7)))
  const units = cohort.flatMap((r) => r.items.map((item) => ({ r, item, metrics: itemMetrics(item, r, asOf) })))
  const due = units.filter(({ r }) => plantDeadline(r) <= asOf)
  const fulfilled = due.filter(({ item }) => item.delivery && day(item.delivery.deliveredAt) <= asOf).length
  return { planned: units.length, delivered: units.filter(({ item }) => item.delivery && day(item.delivery.deliveredAt) <= asOf).length,
    due: due.length, fulfilled, percent: due.length ? Math.round(fulfilled / due.length * 100) : null,
    overdue: units.filter(({ metrics }) => metrics.overdue).length,
    blocked: units.filter(({ item }) => item.status === 'BLOCKED').length,
    critical: units.filter(({ r, metrics }) => r.criticality === 'CRITICAL' && metrics.open).length }
}

import { systemDay } from '../repairs/calendar'
import type { RexExecution, RexState, RexTask } from './types'

export function addMonths(day: string, months: number) {
  const date = new Date(`${day.slice(0, 10)}T00:00:00Z`)
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months + 1, 0))
  return new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), Math.min(date.getUTCDate(), end.getUTCDate()))).toISOString().slice(0, 10)
}
export function deriveStatus(items: { quantity: number | string; completed: number | string; required: boolean }[]) {
  const required = items.filter((i) => i.required)
  const target = required.length ? required : items
  if (target.length && target.every((i) => Number(i.completed) >= Number(i.quantity))) return 'COMPLETED'
  return items.some((i) => Number(i.completed) > 0) ? 'PARTIAL' : 'NOT_PERFORMED'
}
export function executionLabel(execution: RexExecution | undefined, state: RexState) {
  if (!execution) return 'Sin historial'
  return execution.performedAt ? new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(execution.performedAt)) : state.events.find((e) => e.id === execution.eventId)?.name || 'Sin fecha exacta'
}
/** A resolution is explicitly later than its origin, even when the origin has no exact date. */
export function compareExecutions(a: RexExecution, b: RexExecution, state: RexState) {
  const resolves = (later: RexExecution, earlier: RexExecution) => later.resolutions?.some((r) => state.pending.some((p) => p.id === r.pendingId && p.executionId === earlier.id))
  if (resolves(a, b)) return -1
  if (resolves(b, a)) return 1
  return (a.performedAt && b.performedAt ? b.performedAt.localeCompare(a.performedAt) : b.createdAt.localeCompare(a.createdAt)) || b.id.localeCompare(a.id)
}
export function taskMetrics(task: RexTask, state: RexState, today = systemDay()) {
  const history = state.executions.filter((e) => e.taskId === task.id)
  const byDate = (a: RexExecution, b: RexExecution) => compareExecutions(a, b, state)
  const complete = history.filter((e) => e.intent === 'FULL_TASK' && e.status === 'COMPLETED').sort(byDate)
  // Unknown dates cannot safely be ordered relative to known dates. Be conservative.
  const uncertain = complete.some((e) => !e.performedAt)
  const lastComplete = (uncertain ? complete.find((e) => !e.performedAt) : complete[0])
  const lastIntervention = history.filter((e) => e.items.some((i) => Number(i.completed) > 0)).sort(byDate)[0]
  const due = !uncertain && lastComplete?.performedAt && task.frequencyType === 'PERIODIC' && task.intervalMonths ? addMonths(lastComplete.performedAt, task.intervalMonths) : null
  const days = due ? Math.round((Date.parse(due) - Date.parse(today)) / 86400000) : null
  const cycle = !complete.length ? lastIntervention ? 'NO_COMPLETE' : 'NO_HISTORY' : task.frequencyType !== 'PERIODIC' ? 'NO_FREQUENCY' : !due ? 'UNCERTAIN' : days! < 0 ? 'OVERDUE' : days! <= 90 ? 'UPCOMING' : 'CURRENT'
  const open = state.pending.filter((p) => p.taskId === task.id && Number(p.remaining) > 0)
  return { lastComplete, lastIntervention, due, cycle, open, partial: history.some((e) => e.status === 'PARTIAL'), status: open.length ? 'PARTIAL_PENDING' : cycle }
}

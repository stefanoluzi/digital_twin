import { fiscalMonths } from './calendar'
import { monthSequence, plantDeadline, requestMetrics } from './domain'
import type { RepairRequest, RepairStatus } from './types'

export const meetingFilters = [['ALL', 'Todas'], ['OVERDUE', 'Vencidas'], ['MONTH', 'Vencen este mes'], ['NEXT', 'Próximo mes'], ['CRITICAL', 'Críticas abiertas']] as const
export type MeetingFilter = typeof meetingFilters[number][0]
export type StateFilter = RepairStatus | 'OVERDUE'
export function toggleFilter<T extends string>(selected: T[], value: T, modifiers: { ctrlKey?: boolean; metaKey?: boolean } = {}): T[] {
  if (!modifiers.ctrlKey && !modifiers.metaKey) return [value]
  return selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]
}
/** Empty selection is Todas; ALL never coexists with another predicate. */
export function toggleMeetingFilter(selected: MeetingFilter[], value: MeetingFilter, modifiers: { ctrlKey?: boolean; metaKey?: boolean } = {}) {
  return value === 'ALL' ? [] : toggleFilter(selected.filter((item) => item !== 'ALL'), value, modifiers)
}
export function matchesStateFilters(r: RepairRequest, selected: StateFilter[], today: string) {
  return !selected.length || selected.some((status) => status === 'OVERDUE' ? requestMetrics(r, today).overdue : r.items.some((item) => item.status === status))
}
export function matchesMeetingFilter(r: RepairRequest, filter: MeetingFilter, today: string) {
  if (filter === 'ALL') return true
  if (!requestMetrics(r, today).active) return false
  const deadline = plantDeadline(r)
  if (filter === 'OVERDUE') return deadline < today
  if (filter === 'MONTH') return deadline.slice(0, 7) === today.slice(0, 7)
  if (filter === 'NEXT') return deadline.slice(0, 7) === monthSequence(today, 2)[1]
  return r.criticality === 'CRITICAL'
}
export function meetingSelection(requests: RepairRequest[], year: number, today: string, filter: MeetingFilter | MeetingFilter[]) {
  const selected = (Array.isArray(filter) ? filter : [filter]).filter((key) => key !== 'ALL')
  const cohort = [...new Map(requests.filter((r) => fiscalMonths(year).includes(r.targetMonth.slice(0, 7))).map((r) => [r.id, r])).values()]
  const counts = Object.fromEntries(meetingFilters.map(([key]) => [key, cohort.filter((r) => matchesMeetingFilter(r, key, today)).length])) as Record<MeetingFilter, number>
  const visible = cohort.filter((r) => !selected.length || selected.some((key) => matchesMeetingFilter(r, key, today)))
  if (selected.includes('OVERDUE') || selected.includes('MONTH')) {
    const rank = { CRITICAL: 0, HIGH: 1, NORMAL: 2 }
    visible.sort((a, b) => rank[a.criticality] - rank[b.criticality] || plantDeadline(a).localeCompare(plantDeadline(b)))
  }
  return { visible, counts }
}
export function repairSearchText(r: RepairRequest) {
  return [r.equipment.repairProfile?.idrep, r.equipment.name, r.notes, r.criticalReason, r.workshop, ...r.items.flatMap((i) => i.blocks.map((b) => `${b.description} ${b.comment}`))].join(' ').toLocaleLowerCase()
}

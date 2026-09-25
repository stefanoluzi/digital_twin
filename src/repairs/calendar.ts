/** One business calendar, shared by API and UI. Civil dates remain YYYY-MM-DD. */
export const REPAIR_LOCALE = 'es-AR'
export const REPAIR_TIME_ZONE = 'America/Argentina/Buenos_Aires'
export function systemDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat(REPAIR_LOCALE, { timeZone: REPAIR_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => parts.find((p) => p.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export const fiscalYear = (date = systemDay()) => Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 7 ? 1 : 0)
export const fiscalLabel = (year: number) => `Ejercicio ${year}/${String(year + 1).slice(-2)}`
export const fiscalMonths = (year: number) => Array.from({ length: 12 }, (_, i) => `${year + (i >= 6 ? 1 : 0)}-${String((i + 6) % 12 + 1).padStart(2, '0')}`)
export const fiscalOptions = (current: number, selected: number) => Array.from({ length: Math.max(current + 5, selected + 1) - Math.min(current - 5, selected - 1) + 1 }, (_, i) => Math.min(current - 5, selected - 1) + i)
export const civilDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`)
export function businessDayEnd(date: string) {
  const offset = new Intl.DateTimeFormat('en', { timeZone: REPAIR_TIME_ZONE, timeZoneName: 'longOffset' }).formatToParts(civilDate(date)).find((p) => p.type === 'timeZoneName')!.value.replace('GMT', '') || 'Z'
  return new Date(`${date}T23:59:59.999${offset}`).toISOString()
}
export const monthEnd = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10)
export const formatRepairDate = (value?: string | null) => value ? new Intl.DateTimeFormat(REPAIR_LOCALE, { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(civilDate(value)) : '—'
export const monthLabel = (month: string, long = false) => new Intl.DateTimeFormat(REPAIR_LOCALE, { timeZone: 'UTC', month: long ? 'long' : 'short', year: long ? 'numeric' : '2-digit' }).format(civilDate(`${month.slice(0, 7)}-01`))
export const weekdayLabels = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(REPAIR_LOCALE, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + i))).slice(0, 2))
export const monthPhase = (month: string, asOf = systemDay()) => month < asOf.slice(0, 7) ? 'closed' : month === asOf.slice(0, 7) ? 'current' : 'future'
export const phaseLabels = { closed: 'Cerrado', current: 'En curso', future: 'Pendiente' }
export const dateInMonth = (date: string | null | undefined, month: string) => !date || date.slice(0, 7) === month.slice(0, 7)
export const calendarDays = (month: string) => { const first = civilDate(`${month}-01`); return { offset: (first.getUTCDay() + 6) % 7, count: Number(monthEnd(month).slice(-2)) } }

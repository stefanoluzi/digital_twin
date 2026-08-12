const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function parseDateOnly(value: string): Date | null {
  if (!DATE_ONLY.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null
}

export function formatDateOnly(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function todayDateOnly(): string {
  const now = new Date()
  return formatDateOnly(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

export function addMaintenanceInterval(dateOnly: string, amount: number, unit: 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS'): string | null {
  const source = parseDateOnly(dateOnly)
  if (!source || !Number.isFinite(amount)) return null
  const count = Math.max(0, Math.trunc(amount))
  if (unit === 'DAYS' || unit === 'WEEKS') {
    source.setUTCDate(source.getUTCDate() + count * (unit === 'WEEKS' ? 7 : 1))
    return formatDateOnly(source)
  }
  const originalDay = source.getUTCDate()
  const targetMonth = source.getUTCMonth() + (unit === 'MONTHS' ? count : count * 12)
  const targetYear = source.getUTCFullYear() + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  source.setUTCFullYear(targetYear, normalizedMonth, Math.min(originalDay, daysInMonth(targetYear, normalizedMonth)))
  return formatDateOnly(source)
}

export function differenceInCalendarDays(later: string, earlier: string): number | null {
  const end = parseDateOnly(later)
  const start = parseDateOnly(earlier)
  return end && start ? Math.round((end.getTime() - start.getTime()) / 86_400_000) : null
}

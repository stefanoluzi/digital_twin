import { describe, expect, it } from 'vitest'
import { businessDayEnd, calendarDays, dateInMonth, fiscalLabel, fiscalMonths, fiscalOptions, fiscalYear, formatRepairDate, monthEnd, monthLabel, monthPhase, systemDay, weekdayLabels } from '../src/repairs/calendar'

describe('Calendario central Reparaciones Taller', () => {
  it('corte del histórico incluye la noche argentina posterior a medianoche UTC', () => expect(businessDayEnd('2026-09-24')).toBe('2026-09-25T02:59:59.999Z'))
  it.each([['2026-06-30', 2025], ['2026-07-01', 2026], ['2026-09-24', 2026], ['2037-01-05', 2036], ['2037-07-01', 2037]])('ejercicio de %s = %i', (date, year) => expect(fiscalYear(date)).toBe(year))
  it('selector permite avanzar y retroceder fuera de los años iniciales', () => { expect(fiscalOptions(2026, 2040)).toContain(2041); expect(fiscalOptions(2026, 2000)).toContain(1999); expect(fiscalLabel(2026)).toBe('Ejercicio 2026/27') })
  it('12 meses Julio a Junio sin hardcodear año', () => { expect(fiscalMonths(2030)).toEqual(['2030-07','2030-08','2030-09','2030-10','2030-11','2030-12','2031-01','2031-02','2031-03','2031-04','2031-05','2031-06']) })
  it('fecha real de negocio cambia automáticamente en el límite de julio', () => { expect(fiscalYear(systemDay(new Date('2030-07-01T02:59:59Z')))).toBe(2029); expect(fiscalYear(systemDay(new Date('2030-07-01T03:00:00Z')))).toBe(2030) })
  it('es-AR, lunes primero y meses en español', () => { expect(formatRepairDate('2026-09-24')).toBe('24/09/2026'); expect(monthLabel('2026-09', true)).toBe('septiembre de 2026'); expect(weekdayLabels).toEqual(['lu','ma','mi','ju','vi','sá','do']); expect(calendarDays('2027-03').offset).toBe(0) })
  it('mes seleccionado gobierna calendario, fecha opcional y validación', () => { expect(dateInMonth(null, '2027-03')).toBe(true); expect(dateInMonth('2027-03-15', '2027-03')).toBe(true); expect(dateInMonth('2027-04-15', '2027-03')).toBe(false); expect(monthEnd('2028-02')).toBe('2028-02-29') })
  it('distingue cerrado, hoy y futuro sin simular incumplimiento', () => { expect(monthPhase('2026-08', '2026-09-24')).toBe('closed'); expect(monthPhase('2026-09', '2026-09-24')).toBe('current'); expect(monthPhase('2027-03', '2026-09-24')).toBe('future') })
})

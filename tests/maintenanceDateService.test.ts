import { describe, expect, it } from 'vitest'
import { addMaintenanceInterval, differenceInCalendarDays, parseDateOnly } from '../src/maintenance/domain/maintenanceDateService'

describe('maintenanceDateService', () => {
  it('mantiene fechas date-only y rechaza fechas imposibles', () => {
    expect(parseDateOnly('2026-02-29')).toBeNull()
    expect(parseDateOnly('2028-02-29')).not.toBeNull()
  })
  it('ajusta fin de mes y año bisiesto', () => {
    expect(addMaintenanceInterval('2026-01-31', 1, 'MONTHS')).toBe('2026-02-28')
    expect(addMaintenanceInterval('2028-01-31', 1, 'MONTHS')).toBe('2028-02-29')
    expect(addMaintenanceInterval('2028-02-29', 1, 'YEARS')).toBe('2029-02-28')
  })
  it('calcula diferencias sin depender de la zona horaria', () => {
    expect(differenceInCalendarDays('2026-03-01', '2026-02-28')).toBe(1)
  })
})

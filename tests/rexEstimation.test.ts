import { describe, expect, it } from 'vitest'
import { calculateEstimate } from '../src/rex/estimation'

const config = { hoursPerDay: '9', hourlyRate: '25', currency: 'USD' }
const inputs = { durationDays: '3', mechanical: '12', electrical: '1', mro: '30000', services: '5000', ownLabor: '1500' }
describe('Estimación decimal REX', () => {
  it('ejemplo obligatorio: 351 HH, 8775 MOA y 45275 total', () => {
    expect(calculateEstimate(inputs, config)).toMatchObject({ people: '13', hoursPerPerson: '27', manHours: '351', contractorLabor: '8775.00', total: '45275.00' })
  })
  it('recalcula al cambiar MEC de 12 a 14', () => {
    expect(calculateEstimate({ ...inputs, mechanical: '14' }, config)).toMatchObject({ people: '15', manHours: '405', contractorLabor: '10125.00', total: '46625.00' })
  })
  it('admite coma decimal y redondea dinero sin float', () => {
    expect(calculateEstimate({ ...inputs, durationDays: '2,5' }, config).manHours).toBe('292.5')
    expect(calculateEstimate({ ...inputs, durationDays: '0.001', mechanical: '1', electrical: '0', mro: '0.1', services: '0.2', ownLabor: '0' }, { ...config, hoursPerDay: '1', hourlyRate: '5' })).toMatchObject({ contractorLabor: '0.01', total: '0.31' })
  })
  it('rechaza valores inválidos y exige tarifa explícita', () => {
    for (const bad of [{ durationDays: '-1' }, { durationDays: '0' }, { mechanical: '1.5' }, { mro: '-1' }, { services: 'NaN' }]) expect(() => calculateEstimate({ ...inputs, ...bad }, config)).toThrow()
    expect(() => calculateEstimate(inputs, { ...config, hourlyRate: null })).toThrow()
    expect(() => calculateEstimate(inputs, { ...config, hoursPerDay: '25' })).toThrow()
  })
})

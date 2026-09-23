import { describe, expect, it } from 'vitest'
import { canonicalLco, validateLcoData, validateLcoEvent } from '../src/maintenance/domain/lcoValidation'
import { createEmptyLcoCouplingData } from '../src/maintenance/domain/lcoCouplings'
import { parseLcoBackup } from '../src/maintenance/services/lcoBackupService'

const event = { id: 'I1', type: 'INSPECTION', date: '2026-09-23', createdAt: '2026-09-23T10:00:00Z', inspector: '', observations: '', attachments: [], readings: [{ couplingId: 'J1_SUP_RED', wearLevel: 3, note: '' }] }
describe('Validación LCO sin normalización destructiva', () => {
  it('acepta datos vacíos y preserva eventos válidos', () => {
    expect(validateLcoData(createEmptyLcoCouplingData()).events).toEqual([])
    expect(validateLcoEvent(event)).toEqual(event)
  })
  it('rechaza fechas inválidas, posiciones, desgaste y lecturas duplicadas', () => {
    for (const invalid of [{ ...event, date: '2026-02-30' }, { ...event, readings: [{ couplingId: 'unknown', wearLevel: 3, note: '' }] }, { ...event, readings: [{ ...event.readings[0], wearLevel: 6 }] }, { ...event, readings: [...event.readings, ...event.readings] }]) expect(() => validateLcoEvent(invalid)).toThrow()
  })
  it('respaldo inválido no pierde lecturas ni reemplaza fecha por hoy', () => {
    const { events: _events, ...config } = createEmptyLcoCouplingData()
    expect(() => parseLcoBackup({ format: 'LCO_COUPLINGS_BACKUP', schemaVersion: 1, config, events: [{ ...event, readings: [...event.readings, { couplingId: 'bad', wearLevel: 2, note: '' }] }] })).toThrow()
  })
  it('hash canónico ignora orden de claves pero no contenido', () => {
    expect(canonicalLco({ a: 1, b: 2 })).toBe(canonicalLco({ b: 2, a: 1 }))
    expect(canonicalLco({ a: 1 })).not.toBe(canonicalLco({ a: 2 }))
  })
})

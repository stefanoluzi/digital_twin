import { describe, expect, it } from 'vitest'
import { createDemoSparesData } from '../src/spares/data/demoSpares'
import { parseBackup, validateSparesData } from '../src/spares/domain/sparesValidation'

const backup = () => ({ format: 'LACO1_CRITICAL_SPARES', version: 2, data: createDemoSparesData() })
describe('Validación de migración centralizada', () => {
  it('preserva IDs, unidades, historial y todos los campos de v2', () => {
    const value = backup()
    value.data.spareTypes[0].drawingPdf = 'data:application/pdf;base64,JVBERg=='
    value.data.spareTypes[0].referencePhoto = 'data:image/png;base64,aGVsbG8='
    expect(parseBackup(value)).toEqual(value.data)
  })
  it('rechaza snapshots corruptos sin sustituirlos por datos demo', () => {
    expect(() => parseBackup({ ...backup(), data: {} })).toThrow()
    expect(() => validateSparesData(null)).toThrow()
    expect(() => parseBackup({ ...backup(), version: 10 })).toThrow()
  })
  it('rechaza IDs duplicados, referencias inválidas y GMB inactivos', () => {
    const data = createDemoSparesData()
    data.spareTypes.push(data.spareTypes[0])
    expect(() => validateSparesData(data)).toThrow('ID duplicado')
    data.spareTypes.pop()
    data.spareTypes[0].compatibleEquipmentIds.push('missing')
    expect(() => validateSparesData(data)).toThrow('inexistente')
    data.spareTypes[0].compatibleEquipmentIds.pop()
    data.config.responsibles[0].active = false
    expect(() => validateSparesData(data)).toThrow('inactivo')
  })
  it('conserva la regla histórica de SAP repetido y exige áreas responsables', () => {
    const data = createDemoSparesData()
    data.spareTypes[1].sapNumber = data.spareTypes[0].sapNumber
    expect(validateSparesData(data).spareTypes).toHaveLength(6)
    data.config.areas.find((area) => area.id === 'LCO')!.responsibleGmbId = undefined
    expect(() => validateSparesData(data)).toThrow('requiere GMB')
  })
  it('conserva eventos de unidades eliminadas y rechaza snapshots de otra unidad', () => {
    const data = createDemoSparesData()
    data.units = []
    expect(validateSparesData(data).history.length).toBeGreaterThan(0)
    data.history[0].snapshot.id = 'wrong'
    expect(() => validateSparesData(data)).toThrow('otra unidad')
  })
  it('migra v1 sin inventar responsables y detecta asignaciones ambiguas', () => {
    const data = createDemoSparesData()
    const { areas, ...config } = data.config
    const spareTypes = data.spareTypes.map((spare) => ({ ...spare, responsibleId: areas.find((area) => area.id === spare.area)?.responsibleGmbId }))
    const value = { format: 'LACO1_CRITICAL_SPARES', version: 1, data: { ...data, schemaVersion: 1, config, spareTypes } }
    expect(parseBackup(value).config.areas.find((area) => area.id === 'LCO')?.responsibleGmbId).toBe('gmb-mecanica')
    spareTypes.find((spare) => spare.id === 'sp-acople-lco')!.responsibleId = 'gmb-hidraulica'
    expect(() => parseBackup(value)).toThrow('ambiguos')
  })
  it('rechaza fechas y estados corruptos y adjuntos ejecutables', () => {
    const data = createDemoSparesData()
    data.units[0].statusSince = '2026-02-31'
    expect(() => validateSparesData(data)).toThrow('Fecha inválida')
    data.units[0].statusSince = '2026-02-01'
    data.spareTypes[0].drawingPdf = 'javascript:alert(1)'
    expect(() => validateSparesData(data)).toThrow('PDF inválido')
  })
})

import { describe, expect, it } from 'vitest'
import {
  createEmptyLcoCouplingData,
  createLcoCouplingId,
  type CouplingInspectionEvent,
  type CouplingReplacementEvent,
  type LcoPhotoAttachment,
} from '../src/maintenance/domain/lcoCouplings'
import { buildLcoExcelSheets, lcoExcelBackupFileName } from '../src/maintenance/services/lcoExcelBackupService'

const couplingId = createLcoCouplingId(2, 'UPPER', 'GEARBOX')
const photo: LcoPhotoAttachment = {
  id: 'P-1',
  fileName: 'dientes.jpg',
  mimeType: 'image/jpeg',
  dataUrl: 'data:image/jpeg;base64,CONTENIDO_NO_EXPORTABLE_AL_EXCEL',
  createdAt: '2026-08-28T11:00:00.000Z',
  caption: 'Desgaste de dientes lado reductor',
}
const inspection: CouplingInspectionEvent = {
  id: 'I-1',
  type: 'INSPECTION',
  date: '2026-08-28',
  createdAt: '2026-08-28T11:00:00.000Z',
  inspector: 'Técnico LCO',
  observations: 'Control semanal',
  attachments: [],
  readings: [{ couplingId, wearLevel: 4, note: 'Revisar en próxima parada', conditionCode: 'DESGASTE_DIENTES', attachments: [photo] }],
}
const replacement: CouplingReplacementEvent = {
  id: 'R-1',
  type: 'COUPLING_REPLACEMENT',
  date: '2026-08-01',
  createdAt: '2026-08-01T09:00:00.000Z',
  couplingId,
  inspector: 'Técnico LCO',
  reason: 'Preventivo',
  sapWorkOrder: 'OT-4001',
  notes: 'Recambio programado',
  wearAtRemoval: 5,
  attachments: [],
}

describe('respaldo Excel legible de Acoplamientos LCO', () => {
  const data = { ...createEmptyLcoCouplingData(), events: [replacement, inspection] }
  const sheets = buildLcoExcelSheets(data, '2026-08-30', new Date('2026-08-30T12:00:00.000Z'))

  it('organiza la información en hojas de resumen, estado, historial y fotos', () => {
    expect(sheets.map((sheet) => sheet.sheet)).toEqual(['Resumen', 'Estado actual', 'Historial', 'Fotos'])
    expect(sheets[1].data).toHaveLength(33)
    expect(sheets[2].data).toHaveLength(3)
    expect(sheets[3].data).toHaveLength(2)
  })

  it('expone datos operativos legibles y fechas reales de Excel', () => {
    const stateRow = sheets[1].data.find((row) => row[0] === couplingId)
    expect(stateRow).toBeTruthy()
    expect(stateRow?.[6]).toBe('Desgastado')
    expect(stateRow?.[10]).toBe('Técnico LCO')
    expect(stateRow?.[11]).toBe('Desgaste de dientes')
    expect((stateRow?.[7] as { value: unknown }).value).toBeInstanceOf(Date)
  })

  it('incluye metadatos de fotos sin duplicar el contenido base64 pesado', () => {
    const serializedSheets = JSON.stringify(sheets)
    expect(serializedSheets).toContain('dientes.jpg')
    expect(serializedSheets).toContain('Desgaste de dientes lado reductor')
    expect(serializedSheets).not.toContain('CONTENIDO_NO_EXPORTABLE_AL_EXCEL')
  })

  it('genera un nombre reconocible y fechado para el técnico', () => {
    expect(lcoExcelBackupFileName(new Date('2026-08-30T12:00:00.000Z'))).toBe('LCO_Acoplamientos_Informe_2026-08-30.xlsx')
  })
})

import type { Cell, Sheet } from 'write-excel-file/browser'
import {
  couplingWearLabels,
  createDefaultLcoCouplingTopology,
  type CouplingConditionCode,
  type LcoCouplingModuleData,
  type LcoPhotoAttachment,
} from '../domain/lcoCouplings'
import { getLcoCouplingState, getLcoCouplingSummary, type InspectionFreshness } from '../domain/lcoCouplingSelectors'
import { getLcoHistoryRows, getLcoOperationalSide } from '../domain/lcoHistorySelectors'
import { getLcoBackupStats } from './lcoBackupService'

export type LcoExcelSheet = Sheet<File | Blob | ArrayBuffer>

const COLORS = {
  navy: '#123B5D',
  blue: '#DDEBF7',
  paleBlue: '#EEF5FA',
  orange: '#E67E22',
  paleOrange: '#FCE4D6',
  red: '#C00000',
  paleRed: '#F4CCCC',
  green: '#2E7D32',
  paleGreen: '#E2F0D9',
  gray: '#E7E6E6',
  darkGray: '#595959',
  white: '#FFFFFF',
}

const conditionLabels: Record<CouplingConditionCode, string> = {
  NORMAL: 'Normal',
  JUEGO: 'Juego',
  DESGASTE_DIENTES: 'Desgaste de dientes',
  MARCAS: 'Marcas',
  FISURA: 'Fisura',
  LUBRICACION: 'Lubricación',
  OTRO: 'Otro',
}

const freshnessLabels: Record<InspectionFreshness, string> = {
  FRESH: 'Dato reciente',
  STALE: 'Dato desactualizado',
  VERY_STALE: 'Dato muy desactualizado',
  NO_INSPECTION: 'Sin inspección registrada',
}

const eventTypeLabels = {
  INSPECTION: 'Inspección',
  COUPLING_REPLACEMENT: 'Recambio de acoplamiento',
  SHAFT_REPLACEMENT: 'Recambio de alunga',
} as const

const header = (value: string): Cell => ({
  value,
  type: String,
  fontWeight: 'bold',
  textColor: COLORS.white,
  backgroundColor: COLORS.navy,
  align: 'center',
  alignVertical: 'center',
  wrap: true,
  height: 34,
  borderColor: COLORS.white,
  borderStyle: 'thin',
})

const sectionTitle = (value: string, span = 4): Cell => ({
  value,
  type: String,
  columnSpan: span,
  fontWeight: 'bold',
  textColor: COLORS.white,
  backgroundColor: COLORS.navy,
  fontSize: 12,
  height: 26,
  alignVertical: 'center',
})

const label = (value: string): Cell => ({ value, type: String, fontWeight: 'bold', backgroundColor: COLORS.blue })
const dateCell = (value: string | undefined | null): Cell => {
  const date = value ? parseDate(value) : null
  return date ? { value: date, type: Date, format: 'dd/mm/yyyy', align: 'center' } : '—'
}
const dateTimeCell = (value: string | undefined | null): Cell => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? { value: date, type: Date, format: 'dd/mm/yyyy hh:mm', align: 'center' } : '—'
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
  return Number.isNaN(date.getTime()) ? null : date
}

function statusCell(wearLevel: number | null, isNew: boolean): Cell {
  if (isNew) return { value: 'N', type: String, fontWeight: 'bold', textColor: COLORS.white, backgroundColor: '#0B84D8', align: 'center' }
  if (wearLevel === null) return { value: 'Sin inspección', type: String, backgroundColor: COLORS.gray, align: 'center' }
  const backgroundColor = wearLevel === 5 ? COLORS.red : wearLevel === 4 ? COLORS.orange : wearLevel <= 2 ? COLORS.green : '#BF9000'
  return { value: `${wearLevel}/5`, type: String, fontWeight: 'bold', textColor: COLORS.white, backgroundColor, align: 'center' }
}

function getPhotoRows(data: LcoCouplingModuleData) {
  const rows: Cell[][] = []
  const addPhoto = (photo: LcoPhotoAttachment, event: LcoCouplingModuleData['events'][number], scope: string, couplingId = '') => {
    rows.push([
      dateCell(event.date),
      eventTypeLabels[event.type],
      event.id,
      couplingId,
      scope,
      photo.fileName,
      photo.caption || '—',
      photo.mimeType,
      dateTimeCell(photo.createdAt),
    ])
  }

  data.events.forEach((event) => {
    event.attachments.forEach((photo) => addPhoto(photo, event, 'Evento general'))
    if (event.type === 'INSPECTION') {
      event.readings.forEach((reading) => reading.attachments?.forEach((photo) => addPhoto(photo, event, 'Lectura del acoplamiento', reading.couplingId)))
    }
  })
  return rows
}

export function buildLcoExcelSheets(data: LcoCouplingModuleData, referenceDate: string, exportedAt = new Date()): LcoExcelSheet[] {
  const topology = createDefaultLcoCouplingTopology()
  const summary = getLcoCouplingSummary(data, referenceDate)
  const backupStats = getLcoBackupStats(data)
  const inspected = summary.total - summary.withoutInspection
  const stable = Math.max(0, summary.total - summary.critical - summary.worn - summary.withoutInspection)
  const coverage = summary.total ? Math.round((inspected / summary.total) * 100) : 0
  const summaryData: Cell[][] = [
    [{ value: 'ESTADO DE ACOPLAMIENTOS LCO', type: String, columnSpan: 4, fontWeight: 'bold', fontSize: 18, textColor: COLORS.white, backgroundColor: COLORS.navy, height: 36, alignVertical: 'center' }, null, null, null],
    [{ value: 'Respaldo legible para consulta y auditoría', type: String, columnSpan: 4, fontStyle: 'italic', textColor: COLORS.darkGray }, null, null, null],
    [label('Fecha de generación'), { value: exportedAt, type: Date, format: 'dd/mm/yyyy hh:mm' }, label('Fecha de referencia'), dateCell(referenceDate)],
    [sectionTitle('Resumen del estado', 4), null, null, null],
    [label('Total de acoplamientos'), summary.total, label('Cobertura de inspección'), `${coverage}% (${inspected}/${summary.total})`],
    [label('Críticos 5/5'), summary.critical, label('Desgastados 4/5'), summary.worn],
    [label('Estables 1–3'), stable, label('Sin inspección'), summary.withoutInspection],
    [label('Controles registrados'), backupStats.inspections, label('Recambios registrados'), backupStats.replacements],
    [label('Fotos registradas'), backupStats.photos, label('Datos desactualizados'), summary.stale],
    [sectionTitle('Parámetros de seguimiento', 4), null, null, null],
    [label('Dato desactualizado desde'), `${data.inspectionFreshnessThresholds.staleDays} días`, label('Muy desactualizado desde'), `${data.inspectionFreshnessThresholds.veryStaleDays} días`],
    [label('Control reciente hasta'), `${data.inspectionAgeThresholds.recentDays} días`, label('Control vencido desde'), `${data.inspectionAgeThresholds.oldDays + 1} días`],
    [sectionTitle('Uso del respaldo', 4), null, null, null],
    [{ value: 'Este archivo Excel permite consultar, filtrar e imprimir la información. Para recuperar la aplicación completa, incluidas las imágenes originales, conserve también el archivo .lcocouplings generado por “Guardar respaldo”.', type: String, columnSpan: 4, wrap: true, height: 44, backgroundColor: COLORS.paleOrange }, null, null, null],
  ]

  const currentStateData: Cell[][] = [[
    'ID', 'Jaula', 'Sector', 'Posición', 'Lado', 'Estado', 'Descripción', 'Última inspección', 'Días desde control', 'Antigüedad', 'Inspector', 'Condición', 'Observación', 'Último recambio', 'OT último recambio', 'Fotos',
  ].map(header)]

  topology.couplings.forEach((coupling) => {
    const state = getLcoCouplingState(data, coupling.id, referenceDate)
    const isNew = state.wearSource === 'REPLACEMENT'
    const lastInspection = state.lastInspection
    const lastReplacement = state.lastReplacement
    currentStateData.push([
      coupling.id,
      `J${coupling.cageNumber}`,
      getLcoOperationalSide(coupling.cageNumber) === 'NORTH' ? 'Norte' : 'Sur',
      coupling.shaftPosition === 'UPPER' ? 'Superior' : 'Inferior',
      coupling.side === 'GEARBOX' ? 'Reductor' : 'Jaula',
      statusCell(state.currentWearLevel, isNew),
      isNew ? 'Nuevo por recambio; aún no inspeccionado' : state.currentWearLevel ? couplingWearLabels[state.currentWearLevel] : 'Sin datos',
      dateCell(lastInspection?.event.date),
      state.daysSinceInspection ?? '—',
      freshnessLabels[state.freshness],
      lastInspection?.event.inspector || '—',
      lastInspection?.conditionCode ? conditionLabels[lastInspection.conditionCode] : '—',
      lastInspection?.note || lastInspection?.event.observations || '—',
      dateCell(lastReplacement?.date),
      lastReplacement?.sapWorkOrder || '—',
      state.photoCount,
    ])
  })

  const historyData: Cell[][] = [[
    'Fecha', 'Tipo', 'ID de evento', 'Jaula', 'Sector', 'Posición', 'Lado', 'Elemento', 'Acoplamiento', 'Desgaste', 'Inspector', 'OT / Referencia', 'Observaciones', 'Fotos', 'Creado', 'Modificado',
  ].map(header)]
  getLcoHistoryRows(data).forEach((row) => historyData.push([
    dateCell(row.date),
    eventTypeLabels[row.type],
    row.parentEventId,
    `J${row.cageNumber}`,
    getLcoOperationalSide(row.cageNumber) === 'NORTH' ? 'Norte' : 'Sur',
    row.shaftPosition === 'UPPER' ? 'Superior' : 'Inferior',
    row.couplingSide === 'GEARBOX' ? 'Reductor' : row.couplingSide === 'STAND' ? 'Jaula' : 'Ambos lados',
    row.element,
    row.couplingId || '—',
    row.wearLevel ? statusCell(row.wearLevel, false) : '—',
    row.inspector || '—',
    row.sapWorkOrder || '—',
    row.observations || '—',
    row.photos.length,
    dateTimeCell(row.createdAt),
    dateTimeCell(row.updatedAt),
  ]))

  const photoData: Cell[][] = [[
    'Fecha del evento', 'Tipo de evento', 'ID de evento', 'Acoplamiento', 'Ubicación de la foto', 'Archivo', 'Descripción', 'Formato', 'Fecha de carga',
  ].map(header), ...getPhotoRows(data)]
  if (photoData.length === 1) photoData.push(['—', 'Sin fotos registradas', '—', '—', '—', '—', '—', '—', '—'])

  return [
    { sheet: 'Resumen', data: summaryData, showGridLines: false, zoomScale: 100, columns: [{ width: 29 }, { width: 24 }, { width: 29 }, { width: 34 }] },
    { sheet: 'Estado actual', data: currentStateData, stickyRowsCount: 1, showGridLines: false, zoomScale: 85, columns: [{ width: 17 }, { width: 8 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 31 }, { width: 17 }, { width: 17 }, { width: 27 }, { width: 20 }, { width: 24 }, { width: 42 }, { width: 17 }, { width: 20 }, { width: 9 }] },
    { sheet: 'Historial', data: historyData, stickyRowsCount: 1, showGridLines: false, zoomScale: 80, columns: [{ width: 14 }, { width: 27 }, { width: 22 }, { width: 8 }, { width: 10 }, { width: 12 }, { width: 14 }, { width: 20 }, { width: 18 }, { width: 12 }, { width: 20 }, { width: 19 }, { width: 44 }, { width: 9 }, { width: 20 }, { width: 20 }] },
    { sheet: 'Fotos', data: photoData, stickyRowsCount: 1, showGridLines: false, zoomScale: 90, columns: [{ width: 18 }, { width: 27 }, { width: 22 }, { width: 18 }, { width: 27 }, { width: 32 }, { width: 40 }, { width: 18 }, { width: 20 }] },
  ]
}

export async function exportLcoExcelBackup(data: LcoCouplingModuleData, referenceDate: string, exportedAt = new Date()) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  await writeExcelFile(buildLcoExcelSheets(data, referenceDate, exportedAt), { fontFamily: 'Arial', fontSize: 10 }).toFile(lcoExcelBackupFileName(exportedAt))
}

export function lcoExcelBackupFileName(date = new Date()) {
  return `LCO_Acoplamientos_Informe_${date.toISOString().slice(0, 10)}.xlsx`
}

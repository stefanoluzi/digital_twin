import {
  getLcoCouplingById,
  type CouplingWearLevel,
  type LcoCageNumber,
  type LcoCouplingEvent,
  type LcoCouplingModuleData,
  type LcoCouplingSide,
  type LcoPhotoAttachment,
  type LcoShaftPosition,
} from './lcoCouplings'

export type LcoHistoryRowType = LcoCouplingEvent['type']
export type LcoOperationalSide = 'SOUTH' | 'NORTH'

export interface LcoHistoryRow {
  id: string
  parentEventId: string
  type: LcoHistoryRowType
  date: string
  createdAt: string
  updatedAt?: string
  cageNumber: LcoCageNumber
  shaftPosition: LcoShaftPosition
  couplingSide: LcoCouplingSide | null
  couplingId: string | null
  element: 'Acoplamiento' | 'Alunga completa'
  eventLabel: string
  wearLevel: CouplingWearLevel | null
  sapWorkOrder: string
  inspector: string
  observations: string
  photos: LcoPhotoAttachment[]
  eventPhotos: LcoPhotoAttachment[]
  readingPhotos: LcoPhotoAttachment[]
}

export function getLcoOperationalSide(cageNumber: LcoCageNumber): LcoOperationalSide {
  return cageNumber % 2 === 1 ? 'SOUTH' : 'NORTH'
}

export function getLcoHistoryRows(data: LcoCouplingModuleData): LcoHistoryRow[] {
  return data.events.flatMap((event): LcoHistoryRow[] => {
    if (event.type === 'INSPECTION') {
      return event.readings.flatMap((reading) => {
        const coupling = getLcoCouplingById(reading.couplingId)
        if (!coupling) return []
        const readingPhotos = reading.attachments ?? []
        return [{
          id: `${event.id}:${reading.couplingId}`,
          parentEventId: event.id,
          type: event.type,
          date: event.date,
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
          cageNumber: coupling.cageNumber,
          shaftPosition: coupling.shaftPosition,
          couplingSide: coupling.side,
          couplingId: coupling.id,
          element: 'Acoplamiento',
          eventLabel: 'Inspección',
          wearLevel: reading.wearLevel,
          sapWorkOrder: '',
          inspector: event.inspector,
          observations: reading.note || event.observations,
          photos: [...event.attachments, ...readingPhotos],
          eventPhotos: event.attachments,
          readingPhotos,
        }]
      })
    }
    if (event.type === 'COUPLING_REPLACEMENT') {
      const coupling = getLcoCouplingById(event.couplingId)
      if (!coupling) return []
      return [{
        id: event.id,
        parentEventId: event.id,
        type: event.type,
        date: event.date,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        cageNumber: coupling.cageNumber,
        shaftPosition: coupling.shaftPosition,
        couplingSide: coupling.side,
        couplingId: coupling.id,
        element: 'Acoplamiento',
        eventLabel: 'Cambio de acoplamiento',
        wearLevel: event.wearAtRemoval,
        sapWorkOrder: event.sapWorkOrder,
        inspector: event.inspector ?? '',
        observations: event.notes || event.reason,
        photos: event.attachments,
        eventPhotos: event.attachments,
        readingPhotos: [],
      }]
    }
    return [{
      id: event.id,
      parentEventId: event.id,
      type: event.type,
      date: event.date,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      cageNumber: event.cageNumber,
      shaftPosition: event.shaftPosition,
      couplingSide: null,
      couplingId: null,
      element: 'Alunga completa',
      eventLabel: 'Cambio de alunga',
      wearLevel: null,
      sapWorkOrder: event.sapWorkOrder,
      inspector: event.inspector ?? '',
      observations: event.notes || event.reason,
      photos: event.attachments,
      eventPhotos: event.attachments,
      readingPhotos: [],
    }]
  }).sort((a, b) => rowKey(b).localeCompare(rowKey(a)))
}

export function getRecentLcoActivity(data: LcoCouplingModuleData, limit = 7) {
  return getLcoHistoryRows(data).slice(0, Math.max(0, limit))
}

function rowKey(row: Pick<LcoHistoryRow, 'date' | 'createdAt' | 'id'>) {
  return `${row.date}|${row.createdAt}|${row.id}`
}

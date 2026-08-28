import { parseDateOnly, todayDateOnly } from '../domain/maintenanceDateService'
import {
  LCO_CAGE_NUMBERS,
  COUPLING_CONDITION_CODES,
  DEFAULT_INSPECTION_AGE_THRESHOLDS,
  createEmptyLcoCouplingData,
  createLcoCageId,
  isCouplingWearLevel,
  isLcoCageNumber,
  isLcoCouplingId,
  isLcoShaftPosition,
  type CouplingInspectionEvent,
  type CouplingReplacementEvent,
  type ExtensionShaftReplacementEvent,
  type LcoCouplingEvent,
  type LcoCouplingModuleData,
  type LcoPhotoAttachment,
} from '../domain/lcoCouplings'

const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback
const array = (value: unknown): any[] => Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []

export function normalizeLcoCouplingData(value: unknown): LcoCouplingModuleData {
  if (!value || typeof value !== 'object') return createEmptyLcoCouplingData()
  const raw = value as Record<string, any>
  const staleDays = positiveInteger(raw.inspectionFreshnessThresholds?.staleDays, 90)
  const veryStaleDays = Math.max(staleDays, positiveInteger(raw.inspectionFreshnessThresholds?.veryStaleDays, 180))
  const recentDays = positiveInteger(raw.inspectionAgeThresholds?.recentDays, DEFAULT_INSPECTION_AGE_THRESHOLDS.recentDays)
  const dueDays = Math.max(recentDays + 1, positiveInteger(raw.inspectionAgeThresholds?.dueDays, DEFAULT_INSPECTION_AGE_THRESHOLDS.dueDays))
  const oldDays = Math.max(dueDays + 1, positiveInteger(raw.inspectionAgeThresholds?.oldDays, DEFAULT_INSPECTION_AGE_THRESHOLDS.oldDays))
  const cageAssetIds = Object.fromEntries(LCO_CAGE_NUMBERS.flatMap((cageNumber) => {
    const cageId = createLcoCageId(cageNumber)
    const assetId = text(raw.cageAssetIds?.[cageId]).trim()
    return assetId ? [[cageId, assetId]] : []
  }))
  const events = array(raw.events).map(normalizeEvent).filter((event): event is LcoCouplingEvent => Boolean(event))
  const migratedLegacyFingerprints = Array.isArray(raw.migratedLegacyFingerprints) ? [...new Set(raw.migratedLegacyFingerprints.filter((item: unknown): item is string => typeof item === 'string' && Boolean(item)))] : []
  return { events, cageAssetIds, inspectionFreshnessThresholds: { staleDays, veryStaleDays }, inspectionAgeThresholds: { recentDays, dueDays, oldDays }, migratedLegacyFingerprints }
}

function normalizeEvent(item: any, index: number): LcoCouplingEvent | null {
  const common = {
    id: text(item.id, `LCO_IMPORTED_${index + 1}`),
    date: parseDateOnly(text(item.date)) ? text(item.date) : todayDateOnly(),
    createdAt: text(item.createdAt, new Date().toISOString()),
    ...(text(item.updatedAt) ? { updatedAt: text(item.updatedAt) } : {}),
    attachments: normalizePhotoAttachments(item.attachments),
  }
  if (item.type === 'INSPECTION') {
    const seen = new Set<string>()
    const readings = array(item.readings).flatMap((reading) => {
      if (!isLcoCouplingId(reading.couplingId) || !isCouplingWearLevel(reading.wearLevel) || seen.has(reading.couplingId)) return []
      seen.add(reading.couplingId)
      const conditionCode = COUPLING_CONDITION_CODES.includes(reading.conditionCode) ? reading.conditionCode : undefined
      const attachments = normalizePhotoAttachments(reading.attachments)
      return [{ couplingId: reading.couplingId, wearLevel: reading.wearLevel, note: text(reading.note), ...(conditionCode ? { conditionCode } : {}), ...(attachments.length ? { attachments } : {}) }]
    })
    if (!readings.length) return null
    return { ...common, type: 'INSPECTION', inspector: text(item.inspector), observations: text(item.observations), readings } satisfies CouplingInspectionEvent
  }
  if (item.type === 'COUPLING_REPLACEMENT' && isLcoCouplingId(item.couplingId)) {
    return { ...common, type: 'COUPLING_REPLACEMENT', couplingId: item.couplingId, inspector: text(item.inspector), reason: text(item.reason), sapWorkOrder: text(item.sapWorkOrder), notes: text(item.notes), wearAtRemoval: isCouplingWearLevel(item.wearAtRemoval) ? item.wearAtRemoval : null } satisfies CouplingReplacementEvent
  }
  if (item.type === 'SHAFT_REPLACEMENT' && isLcoCageNumber(item.cageNumber) && isLcoShaftPosition(item.shaftPosition)) {
    return { ...common, type: 'SHAFT_REPLACEMENT', cageNumber: item.cageNumber, shaftPosition: item.shaftPosition, inspector: text(item.inspector), reason: text(item.reason), sapWorkOrder: text(item.sapWorkOrder), notes: text(item.notes) } satisfies ExtensionShaftReplacementEvent
  }
  return null
}

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Math.trunc(Number(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizePhotoAttachments(value: unknown): LcoPhotoAttachment[] {
  return array(value).flatMap((item, index) => {
    const mimeType = item.mimeType
    const dataUrl = text(item.dataUrl)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) || !dataUrl.startsWith(`data:${mimeType};base64,`)) return []
    return [{
      id: text(item.id, `PHOTO_${index + 1}`),
      fileName: text(item.fileName, `foto-${index + 1}`),
      mimeType,
      dataUrl,
      createdAt: text(item.createdAt, new Date().toISOString()),
      caption: text(item.caption),
    } satisfies LcoPhotoAttachment]
  })
}

import {
  createDefaultLcoCouplingTopology,
  getCouplingsForCage,
  getCouplingsForShaft,
  type CouplingConditionCode,
  type CouplingInspectionReading,
  type LcoPhotoAttachment,
  type CouplingWearLevel,
  type LcoCageNumber,
  type LcoShaftPosition,
} from '../../maintenance/domain/lcoCouplings'
import type { LcoCouplingState } from '../../maintenance/domain/lcoCouplingSelectors'

export type LcoFilter = 'ALL' | 'WORN' | 'CRITICAL' | 'NO_INSPECTION' | 'STALE'
export type LcoSelectionMap = Record<string, boolean>
export type LcoWearMap = Record<string, CouplingWearLevel | undefined>

const couplingOrder = createDefaultLcoCouplingTopology().couplings.map((coupling) => coupling.id)

export function setCouplingsSelected(current: LcoSelectionMap, couplingIds: string[], value: boolean): LcoSelectionMap {
  return { ...current, ...Object.fromEntries(couplingIds.map((id) => [id, value])) }
}

export function setShaftSelected(current: LcoSelectionMap, cageNumber: LcoCageNumber, shaftPosition: LcoShaftPosition, value: boolean) {
  return setCouplingsSelected(current, getCouplingsForShaft(cageNumber, shaftPosition).map((coupling) => coupling.id), value)
}

export function setCageSelected(current: LcoSelectionMap, cageNumber: LcoCageNumber, value: boolean) {
  return setCouplingsSelected(current, getCouplingsForCage(cageNumber).map((coupling) => coupling.id), value)
}

export function getInspectionProgress(selected: LcoSelectionMap, wear: LcoWearMap) {
  const selectedIds = couplingOrder.filter((id) => selected[id])
  const evaluatedIds = selectedIds.filter((id) => wear[id] !== undefined)
  return {
    selectedIds,
    evaluatedIds,
    selectedCount: selectedIds.length,
    evaluatedCount: evaluatedIds.length,
    canSave: selectedIds.length > 0 && evaluatedIds.length === selectedIds.length,
  }
}

export function findNextUnevaluatedSelected(currentId: string, selected: LcoSelectionMap, wear: LcoWearMap) {
  const startIndex = Math.max(0, couplingOrder.indexOf(currentId))
  for (let offset = 1; offset <= couplingOrder.length; offset += 1) {
    const id = couplingOrder[(startIndex + offset) % couplingOrder.length]
    if (selected[id] && wear[id] === undefined) return id
  }
  return null
}

export function buildLcoInspectionReadings(
  selected: LcoSelectionMap,
  wear: LcoWearMap,
  notes: Record<string, string>,
  conditionCodes: Record<string, CouplingConditionCode | undefined>,
  readingPhotos: Record<string, LcoPhotoAttachment[]> = {},
): CouplingInspectionReading[] {
  return couplingOrder.flatMap((couplingId) => selected[couplingId] && wear[couplingId] !== undefined
    ? [{ couplingId, wearLevel: wear[couplingId]!, note: notes[couplingId] ?? '', conditionCode: conditionCodes[couplingId], ...(readingPhotos[couplingId]?.length ? { attachments: readingPhotos[couplingId] } : {}) }]
    : [])
}

export function matchesLcoFilter(state: LcoCouplingState, filter: LcoFilter) {
  if (filter === 'ALL') return true
  if (filter === 'WORN') return (state.currentWearLevel ?? 0) >= 4
  if (filter === 'CRITICAL') return state.currentWearLevel === 5
  if (filter === 'NO_INSPECTION') return state.wearSource !== 'INSPECTION'
  return state.freshness === 'STALE' || state.freshness === 'VERY_STALE'
}

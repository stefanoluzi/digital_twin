import { useMaintenanceStore } from '../maintenance/store/maintenanceStore'
import { applyAssetDeletePolicy, assertNoDuplicateMaintenanceIds, renameMaintenanceAsset, summarizeAssetMaintenance, type AssetDeletePolicy } from '../maintenance/domain/maintenanceIntegrity'
import { useSceneStore } from '../store/sceneStore'
import type { MaintenanceData } from '../maintenance/domain/maintenanceTypes'

export function renameAssetAndRelinkMaintenance(oldId: string, newId: string) {
  const scene = useSceneStore.getState()
  const maintenance = useMaintenanceStore.getState()
  const normalizedId = newId.trim().toUpperCase()
  const nextMaintenance = renameMaintenanceAsset(maintenance.exportMaintenance(), oldId, normalizedId)
  assertNoDuplicateMaintenanceIds(nextMaintenance)
  if (!scene.renameObjectId(oldId, normalizedId)) return false
  maintenance.replaceMaintenanceData(nextMaintenance)
  scene.attachHistorySideEffect(
    () => { const store = useMaintenanceStore.getState(); store.replaceMaintenanceData(renameMaintenanceAsset(store.exportMaintenance(), normalizedId, oldId)) },
    () => { const store = useMaintenanceStore.getState(); store.replaceMaintenanceData(renameMaintenanceAsset(store.exportMaintenance(), oldId, normalizedId)) },
  )
  return true
}

export function deleteAssetWithMaintenancePolicy(assetId: string, policy: AssetDeletePolicy) {
  if (policy === 'CANCEL') return false
  const maintenance = useMaintenanceStore.getState()
  const previousMaintenance = maintenance.exportMaintenance()
  const nextMaintenance = applyAssetDeletePolicy(previousMaintenance, assetId, policy)
  const scene = useSceneStore.getState(); scene.deleteObject(assetId)
  if (policy === 'DELETE_MAINTENANCE') maintenance.replaceMaintenanceData(nextMaintenance)
  if (policy === 'DELETE_MAINTENANCE') scene.attachHistorySideEffect(
    () => restoreRemovedMaintenance(previousMaintenance, nextMaintenance),
    () => { const store = useMaintenanceStore.getState(); store.replaceMaintenanceData(applyAssetDeletePolicy(store.exportMaintenance(), assetId, policy)) },
  )
  return true
}

export function deleteAssetsWithMaintenancePolicy(assetIds: string[], policyByAsset: Map<string, AssetDeletePolicy>) {
  const previousMaintenance = useMaintenanceStore.getState().exportMaintenance(); let data = previousMaintenance
  const deletable = assetIds.filter((assetId) => (policyByAsset.get(assetId) ?? 'KEEP_ORPHAN') !== 'CANCEL')
  deletable.forEach((assetId) => { data = applyAssetDeletePolicy(data, assetId, policyByAsset.get(assetId) ?? 'KEEP_ORPHAN') })
  if (!deletable.length) return 0
  const scene = useSceneStore.getState(); scene.deleteObjects(deletable)
  useMaintenanceStore.getState().replaceMaintenanceData(data)
  const cascadeIds = deletable.filter((assetId) => policyByAsset.get(assetId) === 'DELETE_MAINTENANCE')
  if (cascadeIds.length) scene.attachHistorySideEffect(
    () => restoreRemovedMaintenance(previousMaintenance, data),
    () => { const store = useMaintenanceStore.getState(); let next = store.exportMaintenance(); cascadeIds.forEach((assetId) => { next = applyAssetDeletePolicy(next, assetId, 'DELETE_MAINTENANCE') }); store.replaceMaintenanceData(next) },
  )
  return deletable.length
}

export function getAssetMaintenanceDeleteSummary(assetId: string) {
  return summarizeAssetMaintenance(useMaintenanceStore.getState().exportMaintenance(), assetId)
}

function restoreRemovedMaintenance(before: MaintenanceData, after: MaintenanceData) {
  const store = useMaintenanceStore.getState(); const current = store.exportMaintenance()
  const mergeRemoved = <T extends { id: string }>(currentItems: T[], beforeItems: T[], afterItems: T[]) => {
    const afterIds = new Set(afterItems.map((item) => item.id)); const currentIds = new Set(currentItems.map((item) => item.id)); return [...currentItems, ...beforeItems.filter((item) => !afterIds.has(item.id) && !currentIds.has(item.id))]
  }
  const restoredCageMappings = Object.fromEntries(Object.entries(before.lcoCouplings.cageAssetIds).filter(([cageId]) => !(cageId in after.lcoCouplings.cageAssetIds)))
  store.replaceMaintenanceData({ equipment: mergeRemoved(current.equipment, before.equipment, after.equipment), subassemblies: mergeRemoved(current.subassemblies, before.subassemblies, after.subassemblies), plans: mergeRemoved(current.plans, before.plans, after.plans), events: mergeRemoved(current.events, before.events, after.events), units: current.units, lcoCouplings: { ...current.lcoCouplings, cageAssetIds: { ...current.lcoCouplings.cageAssetIds, ...restoredCageMappings } } })
}

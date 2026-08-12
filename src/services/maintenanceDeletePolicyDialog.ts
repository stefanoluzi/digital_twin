import type { AssetDeletePolicy, AssetMaintenanceSummary } from '../maintenance/domain/maintenanceIntegrity'
import { getAssetMaintenanceDeleteSummary } from './assetMaintenanceCommands'

export function requestAssetDeletePolicy(assetId: string): Promise<AssetDeletePolicy> {
  const summary = getAssetMaintenanceDeleteSummary(assetId)
  if (!summary.equipmentIds.length) return Promise.resolve('KEEP_ORPHAN')
  return showPolicyDialog(assetId, summary)
}

function showPolicyDialog(assetId: string, summary: AssetMaintenanceSummary): Promise<AssetDeletePolicy> {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div'); backdrop.className = 'maintenance-delete-backdrop'
    const dialog = document.createElement('div'); dialog.className = 'maintenance-delete-dialog'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true')
    const title = document.createElement('h3'); title.textContent = 'Este equipo tiene información de mantenimiento asociada.'
    const description = document.createElement('p'); description.textContent = `Asset ${assetId}`
    const list = document.createElement('ul')
    ;[[summary.subassemblyCount, 'posiciones funcionales'], [summary.eventCount, 'eventos'], [summary.planCount, 'vidas esperadas/configuraciones']].forEach(([count, label]) => { const item = document.createElement('li'); item.textContent = `${count} ${label}`; list.append(item) })
    const actions = document.createElement('div'); actions.className = 'maintenance-delete-actions'
    const finish = (policy: AssetDeletePolicy) => { document.removeEventListener('keydown', escape); backdrop.remove(); resolve(policy) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') finish('CANCEL') }
    const button = (label: string, policy: AssetDeletePolicy, className?: string) => { const node = document.createElement('button'); node.type = 'button'; node.textContent = label; if (className) node.className = className; node.addEventListener('click', () => finish(policy)); return node }
    const cancel = button('Cancelar', 'CANCEL', 'default')
    actions.append(cancel, button('Eliminar asset y conservar Maintenance', 'KEEP_ORPHAN'), button('Eliminar asset + Maintenance asociado', 'DELETE_MAINTENANCE', 'danger'))
    dialog.append(title, description, list, actions); backdrop.append(dialog); backdrop.addEventListener('mousedown', (event) => { if (event.target === backdrop) finish('CANCEL') }); document.addEventListener('keydown', escape); document.body.append(backdrop); cancel.focus()
  })
}

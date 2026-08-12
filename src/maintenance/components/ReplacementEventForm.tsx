import type { FormEvent } from 'react'
import type { MaintenanceEventType } from '../domain/maintenanceTypes'
import { useMaintenanceStore } from '../store/maintenanceStore'
import { Modal } from './ExpectedLifeForm'

const eventLabels: Record<MaintenanceEventType, string> = { INSPECTION: 'Inspección', LUBRICATION: 'Lubricación', ADJUSTMENT: 'Ajuste', REPAIR: 'Reparación', REPLACEMENT: 'Recambio', OVERHAUL: 'Reacondicionamiento', FAILURE: 'Falla', NOTE: 'Nota' }

export function ReplacementEventForm({ subassemblyId, defaultType = 'REPLACEMENT', onClose }: { subassemblyId: string; defaultType?: MaintenanceEventType; onClose: () => void }) {
  const store = useMaintenanceStore()
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); store.appendEvent({ subassemblyId, type: data.get('type') as MaintenanceEventType, date: String(data.get('date')), notes: String(data.get('notes') || ''), workOrder: String(data.get('workOrder') || '') }); onClose() }
  return <Modal title={defaultType === 'REPLACEMENT' ? 'Registrar recambio' : 'Registrar intervención'} onClose={onClose}><form className="maintenance-form" onSubmit={submit}><label>Tipo<select name="type" defaultValue={defaultType}>{Object.entries(eventLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Fecha<input name="date" type="date" required defaultValue={store.referenceDate} /></label><label>Orden de trabajo<input name="workOrder" /></label><label>Notas<textarea name="notes" /></label><button type="submit">Agregar al historial</button></form></Modal>
}

export { eventLabels }

import type { FormEvent } from 'react'
import { getPlanForSubassembly } from '../domain/maintenanceSelectors'
import type { MaintenanceIntervalUnit } from '../domain/maintenanceTypes'
import { useMaintenanceStore } from '../store/maintenanceStore'

export function ExpectedLifeForm({ subassemblyId, onClose }: { subassemblyId: string; onClose: () => void }) {
  const store = useMaintenanceStore(); const existing = getPlanForSubassembly(store, subassemblyId)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    store.savePlan({ id: existing?.id ?? `PLAN_${crypto.randomUUID()}`, subassemblyId, name: String(data.get('name') || 'Vida esperada'), intervalValue: Number(data.get('intervalValue')), intervalUnit: data.get('intervalUnit') as MaintenanceIntervalUnit, warningDays: Number(data.get('warningDays')), criticalDays: Number(data.get('criticalDays')), active: data.get('active') === 'on', createdAt: existing?.createdAt, source: existing?.source }); onClose()
  }
  return <Modal title={existing ? 'Editar intervalo' : 'Configurar vida esperada'} onClose={onClose}><form className="maintenance-form" onSubmit={submit}><label>Nombre<input name="name" required defaultValue={existing?.name ?? 'Vida esperada'} /></label><div className="two-columns"><label>Intervalo de recambio<input name="intervalValue" type="number" min="1" required defaultValue={existing?.intervalValue ?? 6} /></label><label>Unidad<select name="intervalUnit" defaultValue={existing?.intervalUnit ?? 'MONTHS'}><option value="DAYS">Días</option><option value="WEEKS">Semanas</option><option value="MONTHS">Meses</option><option value="YEARS">Años</option></select></label></div><div className="two-columns"><label>Aviso (días)<input name="warningDays" type="number" min="0" defaultValue={existing?.warningDays ?? 30} /></label><label>Crítico (días)<input name="criticalDays" type="number" min="0" defaultValue={existing?.criticalDays ?? 7} /></label></div><label className="field-check"><input name="active" type="checkbox" defaultChecked={existing?.active ?? true} /> Activa</label><button type="submit">Guardar vida esperada</button></form></Modal>
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="maintenance-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="maintenance-modal"><div className="maintenance-drawer-header"><h3>{title}</h3><button aria-label="Cerrar" onClick={onClose}>×</button></div>{children}</div></div> }

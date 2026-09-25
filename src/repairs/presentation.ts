import { formatRepairDate, monthLabel } from './calendar'
import { itemMetrics } from './domain'
import { OWNER_LABELS, STATUS_LABELS, type RepairEvent, type RepairItem, type RepairRequest, type RepairStatus } from './types'

export const criticalityLabel = (value: string) => value === 'CRITICAL' ? 'Crítica' : value === 'HIGH' ? 'Alta' : 'Normal'
const stateLabel = (value: string) => value === 'PLANNED' ? 'Pendiente' : STATUS_LABELS[value as RepairStatus] || 'Estado anterior'
export function complianceLabel(item: RepairItem, request: RepairRequest, asOf?: string) {
  const m = itemMetrics(item, request, asOf)
  if (item.status === 'CANCELLED') return 'No aplica · Cancelada'
  if (item.status === 'DELIVERED') return m.workshopLate || m.plantLate ? 'Cumplida fuera de fecha' : 'Cumplida en fecha'
  return m.overdue ? `Vencida · ${m.lateDays} días` : 'En término'
}
export function eventPresentation(event: RepairEvent, previous?: RepairEvent) {
  const titles: Record<string, string> = { CREATE: 'Necesidad creada', IMPORT: 'Necesidad importada', EDIT: 'Necesidad actualizada', START: 'Trabajo iniciado / reanudado', PEND: 'Vuelve a pendiente', SENT: 'Envío registrado', COMMIT: 'Compromiso registrado', BLOCK: 'Reparación bloqueada', RESOLVE: 'Bloqueo resuelto', DELIVER: 'Entrega registrada', CANCEL: 'Unidades canceladas', COMMENT: 'Comentario agregado' }
  const d = event.detail, r = event.snapshot
  const ids = Array.isArray(d.itemIds) ? d.itemIds : []
  const selected = r.items.filter((i) => ids.includes(i.id))
  const lines: string[] = []
  if (selected.length) lines.push(`Unidades: ${selected.map((i) => `#${i.ordinal}`).join(', ')}`)
  if (['CREATE', 'IMPORT', 'EDIT'].includes(event.action)) {
    lines.push(`Cantidad: ${r.quantity} · ${monthLabel(r.targetMonth, true)}`, `Criticidad: ${criticalityLabel(r.criticality)}${r.criticalReason ? ` · ${r.criticalReason}` : ''}`, `Necesidad Planta: ${formatRepairDate(r.requiredDate)}`, `Taller: ${r.workshop}`)
    if (r.notes) lines.push(r.notes)
  }
  for (const i of selected) {
    const before = previous?.snapshot.items.find((p) => p.id === i.id)
    if (before && before.status !== i.status) lines.push(`Unidad #${i.ordinal}: ${stateLabel(before.status)} → ${stateLabel(i.status)}`)
  }
  if (typeof d.date === 'string') lines.push(`${event.action === 'COMMIT' ? 'Compromiso' : event.action === 'START' ? 'Inicio / reanudación' : event.action === 'DELIVER' ? 'Entrega' : 'Fecha'}: ${formatRepairDate(d.date)}`)
  if (event.action === 'BLOCK') {
    lines.push(`Responsable: ${OWNER_LABELS[d.owner as keyof typeof OWNER_LABELS] || 'Otro'}`, `Motivo: ${String(d.category || '')}`)
    if (d.description && d.description !== d.comment) lines.push(String(d.description))
  }
  if (d.comment) lines.push(String(d.comment))
  if (d.reason) lines.push(`Motivo: ${String(d.reason)}`)
  return { title: titles[event.action] || 'Actualización registrada', lines }
}

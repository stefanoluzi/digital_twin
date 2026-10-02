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
  if (event.action === 'EDIT' && Array.isArray(d.changes) && d.changes.every((c) => c && typeof c.field === 'string')) {
    const labels: Record<string, string> = { targetMonth: 'Mes de necesidad', requiredDate: 'Fecha necesidad', quantity: 'Cantidad', criticality: 'Criticidad', criticalReason: 'Motivo de criticidad', fixedDeadline: 'Fecha inamovible', criticalDueDate: 'Límite crítico', responsibleId: 'GMB', workshop: 'Taller', notes: 'Observaciones', status: 'Estado', startedAt: 'Inicio', sentAt: 'Envío', commitments: 'Compromiso', blocks: 'Bloqueos', delivery: 'Entrega' }
    const valueLabel = (field: string, value: unknown): string => {
      if (value === null || value === undefined || value === '') return 'Sin definir'
      if (field === 'criticality') return criticalityLabel(String(value))
      if (field === 'status') return stateLabel(String(value))
      if (field === 'targetMonth') return monthLabel(String(value), true)
      if (['requiredDate', 'criticalDueDate', 'startedAt', 'sentAt'].includes(field)) return formatRepairDate(String(value))
      if (field === 'commitments' && Array.isArray(value)) return value.length ? formatRepairDate(value[value.length - 1].date) : 'Sin definir'
      if (typeof value === 'boolean') return value ? 'Sí' : 'No'
      return typeof value === 'object' ? JSON.stringify(value) : String(value)
    }
    for (const change of d.changes as { field: string; previousValue: unknown; newValue: unknown }[]) {
      const parts = change.field.split('.'); const field = parts[parts.length - 1]
      lines.push(`${parts[0] === 'items' ? `Unidad #${parts[1]} · ` : ''}${labels[field] || field}: ${valueLabel(field, change.previousValue)} → ${valueLabel(field, change.newValue)}`)
    }
    if (d.reason) lines.push(`Comentario: ${String(d.reason)}`)
    return { title: titles.EDIT, lines }
  }
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

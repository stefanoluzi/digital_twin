import { today } from './domain'
import type { RepairRequest, RepairStatus, BlockOwner } from './types'
export function needDraft(r: RepairRequest) {
  const commitments = [...new Set(r.items.filter((i) => !['DELIVERED', 'CANCELLED'].includes(i.status)).map((i) => i.commitments[i.commitments.length - 1]?.date.slice(0, 10) || ''))]
  const block = r.items.flatMap((i) => i.blocks).find((b) => !b.resolvedAt)
  return { targetMonth: r.targetMonth.slice(0, 7), requiredDate: r.requiredDate?.slice(0, 10) || '', quantity: r.quantity, criticality: r.criticality, criticalReason: r.criticalReason, fixedDeadline: r.fixedDeadline, criticalDueDate: r.criticalDueDate?.slice(0, 10) || '', responsibleId: r.responsibleId || '', workshop: r.workshop, notes: r.notes,
    status: (r.items.every((i) => i.status === r.items[0]?.status) ? r.items[0]?.status : '') as RepairStatus | '', commitment: commitments.length === 1 ? commitments[0] : '', blocked: Boolean(block), owner: (block?.owner || 'PLANT') as BlockOwner, category: block?.category || '', description: block?.description || '', date: today(), reason: '', scope: 'all', itemIds: [] as string[] }
}
export type NeedDraft = ReturnType<typeof needDraft>
export const needIsDirty = (draft: NeedDraft, initial: NeedDraft) => {
  const attributes = ({ reason: _reason, date: _date, scope: _scope, itemIds: _ids, ...values }: NeedDraft) => values
  return JSON.stringify(attributes(draft)) !== JSON.stringify(attributes(initial))
}
export function needPayload(d: NeedDraft, initial: NeedDraft) {
  const { status, commitment, blocked, owner, category, description, date, reason, scope, itemIds, ...values } = d
  const operations: Record<string, unknown>[] = []
  const units = scope === 'selected' ? { itemIds } : {}
  const add = (action: string, extra = {}) => operations.push({ action, ...units, date, comment: reason, ...extra })
  if (commitment !== initial.commitment) {
    if (!commitment) throw new Error('El compromiso registrado no se puede borrar. Seleccioná una nueva fecha.')
    add('COMMIT', { date: commitment })
  }
  const changedBlock = blocked && (owner !== initial.owner || category !== initial.category || description !== initial.description)
  if (initial.blocked && (!blocked || changedBlock)) add('RESOLVE')
  if (status && status !== initial.status && status !== 'BLOCKED') add(({ PENDING: 'PEND', IN_PROGRESS: 'START', DELIVERED: 'DELIVER', CANCELLED: 'CANCEL' } as Record<string, string>)[status])
  if (blocked && (!initial.blocked || changedBlock)) add('BLOCK', { owner, category, description: description || reason, comment: reason })
  return { ...values, targetMonth: `${values.targetMonth}-01`, requiredDate: values.requiredDate || null, criticalDueDate: values.criticalDueDate || null, responsibleId: values.responsibleId || null, reason, operations }
}

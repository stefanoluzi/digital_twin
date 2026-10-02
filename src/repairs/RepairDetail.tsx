import { RepairNeedForm } from './RepairNeedForm'
import { RepairTimeline } from './RepairTimeline'
import { blockedDays, itemMetrics } from './domain'
import { formatRepairDate } from './calendar'
import { OWNER_LABELS, type RepairEvent, type RepairRequest, type RepairState } from './types'
import { type RepairSave } from './RepairStatusControl'
import { complianceLabel } from './presentation'

export function RepairDetail({ request: r, state, events, eventError, busy, onSave, onAction, onDirtyChange, saveError }: { request: RepairRequest; state: RepairState; events: RepairEvent[]; eventError: string; saveError?: string; busy: boolean; onDirtyChange?: (dirty: boolean) => void; onSave: RepairSave; onAction: (action: 'DELIVER' | 'BLOCK' | 'RESOLVE' | 'COMMIT' | 'COMMENT' | 'EDIT' | 'SENT') => void }) {
  return <div className="repair-operational-detail">
    <p className="repair-compact-metadata">{r.equipment.area} · {r.equipment.repairProfile?.trade} · {r.workshop} · GMB: {r.responsible?.name || 'No aplica'}</p>
    <RepairNeedForm serverError={saveError} request={r} state={state} busy={busy} onSave={onSave} onDirtyChange={onDirtyChange} />
    <div className="repairs-actions">
      {r.items.some((i) => !['DELIVERED', 'CANCELLED', 'BLOCKED'].includes(i.status)) && <button className="ghost" onClick={() => onAction('DELIVER')}>Registrar entrega</button>}
      {r.items.some((i) => !i.sentAt && !['DELIVERED', 'CANCELLED'].includes(i.status)) && <button className="ghost" onClick={() => onAction('SENT')}>Registrar envío</button>}
      <button className="ghost" onClick={() => onAction('COMMENT')}>Agregar comentario</button>
    </div>
    <details className="repair-units-expanded"><summary>Detalle de unidades, compromisos y bloqueos</summary><div>{r.items.map((item) => { const im = itemMetrics(item, r); return <section key={item.id}>
      <p><b>Cumplimiento: </b><span className={im.overdue ? 'repair-risk' : ''}>{complianceLabel(item, r)}</span></p>
      <p>Inicio: {formatRepairDate(item.startedAt)} · Compromiso: {formatRepairDate(im.committed)} · Entrega: {formatRepairDate(item.delivery?.deliveredAt)}</p>
      {(item.commitments.length > 0 || item.blocks.length > 0) && <details><summary>Compromisos y bloqueos de la unidad #{item.ordinal}</summary>{item.commitments.map((c) => <p key={c.id}>Compromiso {c.sequence}: {formatRepairDate(c.date)} · {c.reason}</p>)}{item.blocks.map((b) => <p key={b.id}>{OWNER_LABELS[b.owner]} · {b.category} · {b.description}<br />{formatRepairDate(b.startedAt)} → {formatRepairDate(b.resolvedAt)} · {blockedDays(b)} días · {b.resolvedAt ? 'Resuelto' : 'Abierto'}<br />{b.comment}</p>)}</details>}
    </section> })}</div></details>
    <h3>Historial</h3>{eventError && <p role="alert">{eventError}</p>}<RepairTimeline events={events} users={state.users} />
  </div>
}

import { blockedDays, itemMetrics, requestMetrics } from './domain'
import { formatRepairDate, monthLabel, REPAIR_LOCALE, REPAIR_TIME_ZONE } from './calendar'
import { OWNER_LABELS, type RepairEvent, type RepairRequest, type RepairState } from './types'
import { RepairStatusControl, type RepairSave } from './RepairStatusControl'
import { complianceLabel, criticalityLabel, eventPresentation } from './presentation'

export function RepairDetail({ request: r, state, events, eventError, busy, onSave, onAction }: { request: RepairRequest; state: RepairState; events: RepairEvent[]; eventError: string; busy: boolean; onSave: RepairSave; onAction: (action: 'DELIVER' | 'BLOCK' | 'RESOLVE' | 'COMMIT' | 'COMMENT' | 'EDIT' | 'SENT') => void }) {
  const m = requestMetrics(r)
  const commitments = (kind: 'first' | 'committed') => [...new Set(m.items.map((i) => formatRepairDate(i[kind])))].join(' · ')
  return <div className="repair-operational-detail">
    <p>{r.equipment.area} · {r.equipment.repairProfile?.trade}<br />{r.workshop} · GMB: {r.responsible?.name || 'No aplica'}</p>
    <div className="repair-detail-top"><RepairStatusControl request={r} state={state} busy={busy} onSave={onSave} /><div><small>CANTIDAD</small><h2>{m.delivered} / {r.quantity} entregadas</h2>{m.counts.BLOCKED > 0 && <b className="repair-risk">ATENCIÓN · {m.counts.BLOCKED} bloqueada(s)</b>}</div></div>
    <div className="repair-detail-cards"><section><h3>Planificación</h3><dl><dt>Mes objetivo</dt><dd>{monthLabel(r.targetMonth, true)}</dd><dt>Necesidad Planta</dt><dd>{formatRepairDate(r.requiredDate)}{r.fixedDeadline && ' · Fecha inamovible'}</dd><dt>Compromiso original</dt><dd>{commitments('first')}</dd><dt>Compromiso actual</dt><dd>{commitments('committed')}</dd></dl></section><section><h3>Criticidad</h3><b>{criticalityLabel(r.criticality)}</b><p>{r.criticalReason || 'Sin motivo especial'}</p>{r.criticalDueDate && <p>Límite: {formatRepairDate(r.criticalDueDate)}</p>}</section><section><h3>Bloqueo actual</h3>{!m.blocks.length ? <p>Sin bloqueo</p> : r.items.flatMap((i) => i.blocks.filter((b) => !b.resolvedAt).map((b) => <p key={b.id}><b>#{i.ordinal} · {OWNER_LABELS[b.owner]}</b><br />{b.category}<br />{b.description}<br />Desde {formatRepairDate(b.startedAt)} · {blockedDays(b)} días</p>))}</section></div>
    {r.notes && <p>{r.notes}</p>}
    <div className="repairs-actions">
      {r.items.some((i) => !['DELIVERED', 'CANCELLED', 'BLOCKED'].includes(i.status)) && <><button className="ghost" onClick={() => onAction('DELIVER')}>Registrar entrega</button><button className="ghost" onClick={() => onAction('BLOCK')}>Bloquear</button></>}
      {m.blocks.length > 0 && <button className="ghost" onClick={() => onAction('RESOLVE')}>Resolver bloqueo</button>}
      {m.active && <button className="ghost" onClick={() => onAction('COMMIT')}>Cambiar compromiso</button>}
      {r.items.some((i) => !i.sentAt && !['DELIVERED', 'CANCELLED'].includes(i.status)) && <button className="ghost" onClick={() => onAction('SENT')}>Registrar envío</button>}
      <button className="ghost" onClick={() => onAction('COMMENT')}>Agregar comentario</button><button className="ghost" onClick={() => onAction('EDIT')}>Editar necesidad / criticidad</button>
    </div>
    <h3>{r.quantity === 1 ? 'Unidad' : 'Unidades'}</h3><div className="repair-unit-cards">{r.items.map((item) => { const im = itemMetrics(item, r); return <section key={item.id}>
      {r.quantity > 1 && <RepairStatusControl request={r} state={state} item={item} busy={busy} onSave={onSave} />}
      <p><b>Cumplimiento: </b><span className={im.overdue ? 'repair-risk' : ''}>{complianceLabel(item, r)}</span></p>
      <p>Inicio: {formatRepairDate(item.startedAt)} · Compromiso: {formatRepairDate(im.committed)} · Entrega: {formatRepairDate(item.delivery?.deliveredAt)}</p>
      {(item.commitments.length > 0 || item.blocks.length > 0) && <details><summary>Compromisos y bloqueos de la unidad #{item.ordinal}</summary>{item.commitments.map((c) => <p key={c.id}>Compromiso {c.sequence}: {formatRepairDate(c.date)} · {c.reason}</p>)}{item.blocks.map((b) => <p key={b.id}>{OWNER_LABELS[b.owner]} · {b.category} · {b.description}<br />{formatRepairDate(b.startedAt)} → {formatRepairDate(b.resolvedAt)} · {blockedDays(b)} días · {b.resolvedAt ? 'Resuelto' : 'Abierto'}<br />{b.comment}</p>)}</details>}
    </section> })}</div>
    <h3>Timeline completo</h3>{eventError && <p role="alert">{eventError}</p>}<ol className="repair-timeline">{events.map((event, index) => { const p = eventPresentation(event, events[index - 1]); const user = state.users.find((u) => u.id === event.actor)?.name || (event.actor === 'local-user' ? 'Usuario local' : 'Usuario registrado'); return <li key={event.id}><time>{new Date(event.recordedAt).toLocaleString(REPAIR_LOCALE, { timeZone: REPAIR_TIME_ZONE })}</time><b>{p.title}</b><span>Usuario: {user}</span>{p.lines.map((line, i) => <p key={i}>{line}</p>)}</li> })}</ol>
  </div>
}

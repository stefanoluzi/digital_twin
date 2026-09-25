import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { RepairPlanLegend } from './RepairPlanLegend'
import { dateInMonth, fiscalLabel, fiscalMonths, formatRepairDate, monthEnd, monthLabel, monthPhase } from './calendar'
import { exerciseMetrics, itemMetrics, requestMetrics } from './domain'
import { ExerciseSelector, RepairDatePicker } from './RepairCalendar'
import { OWNER_LABELS, STATUS_LABELS, type RepairEquipment, type RepairRequest, type RepairState } from './types'

export interface RepairSeed { equipmentId: string; month: string; quantity: number; requiredDate: string; criticality: string; criticalReason: string }
export type QuickAction = 'START' | 'DELIVER' | 'BLOCK' | 'RESOLVE'
export function ExercisePlan({ state, requests, equipment, year, today, busy, onYear, onSave, onDetail, onDetailedNew, onAction, onConfigure }: {
  state: RepairState; requests: RepairRequest[]; equipment: RepairEquipment[]; year: number; today: string; busy: boolean;
  onYear: (year: number) => void; onSave: (path: string, body: unknown) => Promise<boolean>;
  onDetail: (id: string) => void; onDetailedNew: (seed: RepairSeed) => void; onAction: (id: string, action: QuickAction) => void; onConfigure: () => void;
}) {
  const months = fiscalMonths(year)
  const [cell, setCell] = useState<{ equipment: RepairEquipment; month: string; quantity: number; typed?: boolean } | null>(null)
  const [focus, setFocus] = useState('0:0')
  const table = useRef<HTMLDivElement>(null)
  const kpis = exerciseMetrics(requests, year, today)
  const rowIds = equipment.map((e) => e.id).join('|')
  useEffect(() => setFocus('0:0'), [rowIds, year])
  const keydown = (e: KeyboardEvent<HTMLButtonElement>, row: number, col: number, eq: RepairEquipment, month: string) => {
    if (/^[1-9]$/.test(e.key)) { e.preventDefault(); setCell({ equipment: eq, month, quantity: Number(e.key), typed: true }); return }
    let nextRow = row, nextCol = col
    if (e.key === 'ArrowRight') nextCol++
    else if (e.key === 'ArrowLeft') nextCol--
    else if (e.key === 'ArrowDown') nextRow++
    else if (e.key === 'ArrowUp') nextRow--
    else if (e.key === 'Tab') { nextCol += e.shiftKey ? -1 : 1; if (nextCol > 11) { nextCol = 0; nextRow++ } if (nextCol < 0) { nextCol = 11; nextRow-- } }
    else return
    if (nextRow < 0 || nextRow >= equipment.length || nextCol < 0 || nextCol > 11) return
    e.preventDefault(); const key = `${nextRow}:${nextCol}`; setFocus(key); table.current?.querySelector<HTMLButtonElement>(`[data-cell="${key}"]`)?.focus()
  }
  return <section className="spares-panel exercise-plan"><header><div><h2>Plan de reparaciones</h2><span>{fiscalLabel(year)}</span></div><ExerciseSelector year={year} onChange={onYear} today={today} /></header>
    <div className="coverage-kpis exercise-kpis">{[['PLAN DEL EJERCICIO', kpis.planned], ['ENTREGADAS', kpis.delivered], ['CUMPLIMIENTO A FECHA', kpis.percent === null ? '—' : `${kpis.percent}%`], ['VENCIDAS', kpis.overdue], ['BLOQUEADAS', kpis.blocked], ['CRÍTICAS ABIERTAS', kpis.critical]].map(([label, value]) => <article className="coverage-kpi" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
    <p className="repairs-note">{kpis.fulfilled} de {kpis.due} unidades exigibles entregadas a hoy ({formatRepairDate(today)}). Sin día exacto, se exige al cierre del mes. Las necesidades futuras no reducen el cumplimiento. Indicadores según los filtros actuales.</p>
    <RepairPlanLegend />
    <div className="table-scroll exercise-grid" ref={table}><table><thead><tr><th>IDREP</th><th>Descripción</th><th>Área</th><th>Rubro</th>{months.map((month) => <th key={month} className={monthPhase(month, today) === 'current' ? 'current-month' : ''}>{monthLabel(month)}{monthPhase(month, today) === 'current' && <small>HOY</small>}</th>)}</tr></thead><tbody>{equipment.map((eq, row) => <tr key={eq.id}><th>{eq.repairProfile?.idrep || 'Sin IDREP'}</th><th>{eq.name}{!eq.repairProfile && <small>Vincular a taller</small>}</th><td>{eq.area}</td><td>{eq.repairProfile?.trade || '—'}</td>{months.map((month, col) => {
      const group = requests.filter((r) => r.equipmentId === eq.id && r.targetMonth.startsWith(month))
      const total = group.reduce((n, r) => n + r.quantity, 0), delivered = group.reduce((n, r) => n + requestMetrics(r, today).delivered, 0)
      const metrics = group.map((r) => requestMetrics(r, today))
      const tone = metrics.some((m) => m.overdue) ? 'late' : metrics.some((m) => m.counts.BLOCKED) ? 'blocked' : metrics.some((m) => m.counts.IN_PROGRESS) ? 'progress' : total && delivered === total ? 'delivered' : 'planned'
      const counts = Object.fromEntries(Object.keys(STATUS_LABELS).map((s) => [s, metrics.reduce((n, m) => n + m.counts[s], 0)]))
      const tooltip = total ? `${total} solicitadas\n${Object.entries(counts).filter(([, n]) => n).map(([s, n]) => `${n} ${STATUS_LABELS[s as keyof typeof STATUS_LABELS]}`).join('\n')}\n${group.map((r) => `Necesidad: ${r.requiredDate ? formatRepairDate(r.requiredDate) : 'Sin día exacto'} · Compromiso: ${[...new Set(r.items.map((i) => formatRepairDate(itemMetrics(i, r, today).committed)))].join(', ')}`).join('\n')}` : `Agregar necesidad: ${eq.name} · ${monthLabel(month, true)}`
      return <td key={month} className={monthPhase(month, today) === 'current' ? 'current-month' : ''}><button className={`repair-cell ${total ? tone : 'empty'}`} data-cell={`${row}:${col}`} tabIndex={focus === `${row}:${col}` ? 0 : -1} onFocus={() => setFocus(`${row}:${col}`)} aria-label={`${eq.repairProfile?.idrep || eq.name} · ${monthLabel(month, true)}${total ? ` · ${delivered}/${total} entregadas` : ' · Agregar'}`} title={tooltip} onKeyDown={(e) => keydown(e, row, col, eq, month)} onClick={() => setCell({ equipment: eq, month, quantity: 1 })}>{total ? <><b>{delivered > 0 && total > 1 ? `${delivered}/${total}` : total}</b><span className="repair-mixed">{Object.entries(counts).filter(([, n]) => n).map(([s, n]) => <i key={s} className={`unit-${s}`} style={{ flex: n }} />)}</span></> : <span aria-hidden="true">+</span>}</button></td>
    })}</tr>)}</tbody></table></div>
    {!equipment.length && <p className="repairs-note">No hay equipos para estos filtros. <button className="ghost" onClick={onConfigure}>Vincular equipo del catálogo</button></p>}
    <p className="repairs-note repair-plan-shortcuts">Click o <kbd>Enter</kbd> para editar <span>·</span> Flechas y <kbd>Tab</kbd> para recorrer <span>·</span> Escribí un número para cargar cantidad</p>
    {cell && <QuickCell state={state} key={`${cell.equipment.id}:${cell.month}`} cell={cell} requests={state.requests.filter((r) => r.equipmentId === cell.equipment.id && r.targetMonth.startsWith(cell.month))} workshop={state.config.workshops[0] || ''} busy={busy} today={today} onClose={() => setCell(null)} onSave={onSave} onDetail={onDetail} onDetailedNew={onDetailedNew} onAction={onAction} onConfigure={onConfigure} />}
  </section>
}

function QuickCell({ state, cell, requests, workshop, busy, today, onClose, onSave, onDetail, onDetailedNew, onAction, onConfigure }: {
  state: RepairState;
  cell: { equipment: RepairEquipment; month: string; quantity: number; typed?: boolean }; requests: RepairRequest[]; workshop: string; busy: boolean; today: string;
  onClose: () => void; onSave: (path: string, body: unknown) => Promise<boolean>; onDetail: (id: string) => void; onDetailedNew: (seed: RepairSeed) => void; onAction: (id: string, action: QuickAction) => void; onConfigure: () => void;
}) {
  const [quantity, setQuantity] = useState(cell.quantity)
  const [requiredDate, setRequiredDate] = useState('')
  const [criticality, setCriticality] = useState('NORMAL')
  const [criticalReason, setCriticalReason] = useState('')
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { const previous = document.activeElement as HTMLElement; const input = ref.current?.querySelector<HTMLInputElement>('input[type="number"]'); if (cell.typed) input?.focus(); else input?.select(); if (requests.length) ref.current?.focus(); return () => previous?.focus() }, [])
  const seed: RepairSeed = { equipmentId: cell.equipment.id, month: cell.month, quantity, requiredDate, criticality, criticalReason }
  const openAction = (id: string, action?: QuickAction) => { onClose(); if (action) onAction(id, action); else onDetail(id) }
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}><div ref={ref} className="form-modal repair-quick" role="dialog" aria-modal="true" aria-label={`Plan ${monthLabel(cell.month, true)}`} tabIndex={-1} onKeyDown={(e) => {
    if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose() }
    if (e.key === 'Tab') { const nodes = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)') || [])]; if (e.shiftKey && (document.activeElement === nodes[0] || document.activeElement === ref.current)) { e.preventDefault(); nodes[nodes.length - 1]?.focus() } else if (!e.shiftKey && document.activeElement === nodes[nodes.length - 1]) { e.preventDefault(); nodes[0]?.focus() } }
  }}><header><div><h2>{monthLabel(cell.month, true)}</h2><small>{cell.equipment.repairProfile?.idrep} · {cell.equipment.name}</small></div><button type="button" aria-label="Cerrar edición rápida" disabled={busy} onClick={onClose}>×</button></header><div className="modal-form-scroll">
    {requests.length ? requests.map((r) => { const m = requestMetrics(r, today); return <section className="quick-existing" key={r.id}><b>{m.delivered} / {r.quantity} entregadas</b><RepairStatusControl request={r} state={state} busy={busy} onSave={onSave} /><p><b>Cumplimiento:</b> {[...new Set(r.items.map((i) => complianceLabel(i, r, today)))].join(' · ')}</p>{m.counts.BLOCKED > 0 && <p className="repair-risk">ATENCIÓN · {m.counts.BLOCKED} bloqueada(s)</p>}<p>{Object.entries(m.counts).filter(([, n]) => n).map(([s, n]) => `${n} ${STATUS_LABELS[s as keyof typeof STATUS_LABELS]}`).join(' · ')}</p><p>Necesidad: {formatRepairDate(r.requiredDate)}<br />Compromiso: {[...new Set(m.items.map((i) => formatRepairDate(i.committed)))].join(' · ')}<br />Criticidad: {r.criticality === 'CRITICAL' ? 'Crítica' : r.criticality === 'HIGH' ? 'Alta' : 'Normal'}</p>{m.blocks.map((b) => <p key={b.id}>{OWNER_LABELS[b.owner]}: {b.description}</p>)}<div className="repairs-actions"><button className="primary" onClick={() => openAction(r.id)}>Ver detalle</button>{m.active && <><button className="ghost" onClick={() => openAction(r.id, 'DELIVER')}>Registrar entrega</button>{m.blocks.length ? <button className="ghost" onClick={() => openAction(r.id, 'RESOLVE')}>Resolver bloqueo</button> : <button className="ghost" onClick={() => openAction(r.id, 'BLOCK')}>Bloquear</button>}</>}</div></section> }) : !cell.equipment.repairProfile?.active ? <p>Este equipo debe habilitarse como reparable en el catálogo. No se creará un duplicado. <button className="ghost" onClick={() => { onClose(); onConfigure() }}>Vincular equipo</button></p> : <form onSubmit={async (e) => { e.preventDefault(); if (!dateInMonth(requiredDate, cell.month)) { setError('La fecha exacta debe pertenecer al mes seleccionado'); return } if (criticality !== 'NORMAL' && !criticalReason.trim()) { setError('Indicá el motivo de criticidad'); return } setError(''); const ok = await onSave('/requests', { equipmentId: cell.equipment.id, quantity, targetMonth: `${cell.month}-01`, requiredDate: requiredDate || null, criticality, criticalReason, fixedDeadline: false, criticalDueDate: null, responsibleId: null, workshop, notes: '' }); if (ok) onClose(); else setError('No se guardó. Revisá el mensaje de la API y actualizá los datos si hubo un conflicto.') }}>
      {error && <p role="alert">{error}</p>}<fieldset disabled={busy} className="repair-form"><label>Cantidad</label><div className="quick-quantity"><button type="button" aria-label="Restar unidad" onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><input aria-label="Cantidad" type="number" min={1} max={1000} required value={quantity || ''} onChange={(e) => setQuantity(Number(e.target.value))} /><button type="button" aria-label="Sumar unidad" onClick={() => setQuantity(Math.min(1000, quantity + 1))}>+</button></div><span>Fecha exacta de necesidad (opcional)</span><RepairDatePicker label="Fecha exacta de necesidad" value={requiredDate} onChange={setRequiredDate} initialMonth={cell.month} min={`${cell.month}-01`} max={monthEnd(cell.month)} /><label>Criticidad<select value={criticality} onChange={(e) => setCriticality(e.target.value)}><option value="NORMAL">Normal</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select></label>{criticality !== 'NORMAL' && <label>Motivo de criticidad<input required value={criticalReason} onChange={(e) => setCriticalReason(e.target.value)} /></label>}<div className="repairs-actions"><button className="primary" disabled={!workshop} type="submit">{busy ? 'Guardando…' : 'Guardar'}</button><button type="button" className="ghost" onClick={() => { onClose(); onDetailedNew(seed) }}>Más detalles…</button></div></fieldset>
    </form>}
  </div></div></div>
}
import { RepairStatusControl } from './RepairStatusControl'
import { complianceLabel } from './presentation'

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RepairDetail } from '../src/repairs/RepairDetail'
import { RepairTimeline, timelineEntries } from '../src/repairs/RepairTimeline'
import { RepairNeedForm } from '../src/repairs/RepairNeedForm'
import { needDraft, needIsDirty, needPayload } from '../src/repairs/needDraft'
import { eligibleStatusItems } from '../src/repairs/RepairStatusControl'
import { complianceLabel, eventPresentation } from '../src/repairs/presentation'
import type { RepairState } from '../src/repairs/types'
import { blockedDays, dashboardMetrics, exerciseMetrics, historicalMetrics, itemMetrics, legacyQuantity, monthSequence, requestMetrics, stateAt } from '../src/repairs/domain'
import type { RepairBlock, RepairEvent, RepairItem, RepairRequest } from '../src/repairs/types'
const item = (ordinal = 1): RepairItem => ({ id: `item-${ordinal}`, ordinal, status: 'PENDING', startedAt: null, sentAt: null, commitments: [], blocks: [], delivery: null })
const request = (quantity = 1): RepairRequest => ({ id: 'r1', equipmentId: 'e1', quantity, targetMonth: '2026-09-01', requiredDate: '2026-09-15', criticality: 'NORMAL', criticalReason: '', fixedDeadline: false, criticalDueDate: null, responsibleId: null, workshop: 'Taller', notes: '', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', createdBy: 'u', equipment: { id: 'e1', name: 'Cilindro', area: 'LCO', repairProfile: { equipmentId: 'e1', idrep: 'EQ1', sector: 'LC1C', trade: 'Hidráulica', active: true } }, responsible: null, items: Array.from({ length: quantity }, (_, i) => item(i + 1)) })
const promise = (date: string, sequence = 1) => ({ id: String(sequence), date, sequence, reason: 'Motivo', recordedAt: '2026-09-01T00:00:00Z', actor: 'u' })
const block = (owner: RepairBlock['owner'] = 'PLANT'): RepairBlock => ({ id: 'b', startedAt: '2026-09-02', resolvedAt: null, durationDays: null, owner, category: 'Falta repuesto', description: 'Rodamiento', comment: '', actor: 'u' })
describe('Dominio Reparaciones Taller', () => {
  it('ficha carga valores, no guarda sin cambios y Cancelar restaura el borrador inicial', () => {
    const r = request(2), initial = needDraft(r)
    let draft = { ...initial, quantity: 3, criticality: 'HIGH' as const }
    expect(needIsDirty(draft, initial)).toBe(true)
    expect(needIsDirty(initial, initial)).toBe(false)
    expect(needIsDirty({ ...initial, reason: 'Comentario aislado' }, initial)).toBe(false)
    const restored = { ...initial }
    expect(needIsDirty(restored, initial)).toBe(false)
    expect(restored.quantity).toBe(2)
    const state = { config: { workshops: ['Taller'], blockCategories: [] }, responsibles: [] } as unknown as RepairState
    const html = renderToStaticMarkup(createElement(RepairNeedForm, { request: r, state, busy: false, onSave: async () => true }))
    expect(html).toContain('Cantidad necesaria'); expect(html).toContain('value="2"')
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?Guardar cambios/)
    expect(html).not.toContain('Cambiar compromiso')
  })
  it('ficha compone cambios y conserva la carga mensual y transiciones validadas por API', () => {
    const initial = needDraft(request())
    const body = needPayload({ ...initial, quantity: 3, targetMonth: '2027-03', requiredDate: '', status: 'IN_PROGRESS', commitment: '2027-03-05', reason: 'Prueba' }, initial)
    expect(body.targetMonth).toBe('2027-03-01'); expect(body.requiredDate).toBeNull()
    expect(body.operations.map((op) => op.action)).toEqual(['COMMIT', 'START'])
    expect(() => needPayload({ ...initial, commitment: '' }, { ...initial, commitment: '2027-01-01' })).toThrow('no se puede borrar')
  })
  it('evento agrupado presenta valores anteriores/nuevos sin incluir campos no modificados', () => {
    const e: RepairEvent = { id: 1, requestId: 'r1', revision: 1, actor: 'u', recordedAt: '2026-10-02T12:00:00Z', action: 'EDIT', snapshot: request(), detail: { changes: [{ field: 'quantity', previousValue: 1, newValue: 2 }, { field: 'items.1.status', previousValue: 'PENDING', newValue: 'IN_PROGRESS' }], reason: 'Prueba' } }
    const p = eventPresentation(e)
    expect(p.lines).toContain('Cantidad: 1 → 2')
    expect(p.lines).toContain('Unidad #1 · Estado: Pendiente → En curso')
    expect(p.lines.join()).not.toContain('Criticidad:')
    expect(timelineEntries([e])[0].summary).toBe('2 cambios')
  })
  it('timeline descendente conserva la secuencia causal y no modifica los eventos', () => {
    const first = request(); const started = structuredClone(first); started.items[0].status = 'IN_PROGRESS'
    const blocked = structuredClone(started); blocked.items[0].status = 'BLOCKED'
    const events: RepairEvent[] = [
      { id: 1, requestId: first.id, action: 'CREATE', actor: 'u', recordedAt: '2026-10-01T15:20:39Z', revision: 1, detail: {}, snapshot: first },
      { id: 2, requestId: first.id, action: 'START', actor: 'u', recordedAt: '2026-10-01T14:54:48Z', revision: 2, detail: { itemIds: ['item-1'], date: '2026-10-01' }, snapshot: started },
      { id: 3, requestId: first.id, action: 'BLOCK', actor: 'u', recordedAt: '2026-10-01T14:55:13Z', revision: 3, detail: { itemIds: ['item-1'], owner: 'PLANT', category: 'Repuesto no enviado', description: 'Observación completa' }, snapshot: blocked },
    ]
    const original = structuredClone(events)
    const result = timelineEntries([events[2], events[0], events[1]])
    expect(result.map((entry) => entry.event.id)).toEqual([1, 3, 2])
    expect(result[1].summary).toContain('En curso → Bloqueada')
    expect(result[1].summary).toContain('Responsable: Planta')
    expect(result[2].summary).toContain('Pendiente → En curso')
    expect(events).toEqual(original)
  })
  it('timeline ofrece detalles cerrados, autores, timestamps y datos completos para cada tipo', () => {
    const events: RepairEvent[] = ['CREATE', 'START', 'BLOCK', 'SENT', 'DELIVER', 'RESOLVE', 'CANCEL', 'COMMENT', 'UNKNOWN'].map((action, index) => ({ id: index + 1, requestId: 'r1', action, actor: index ? 'u' : 'unmapped', revision: index + 1, recordedAt: '2026-10-01T15:20:39Z', detail: { itemIds: ['item-1'], date: '2026-10-01', customField: 'dato adicional preservado', comment: 'Texto completo de la observación' }, snapshot: request() }))
    const html = renderToStaticMarkup(createElement(RepairTimeline, { events, users: [{ id: 'u', name: 'Técnico de prueba', role: 'ADMIN' }] }))
    expect(html.match(/<li /g)).toHaveLength(9)
    expect(html.match(/class="repair-event-details"/g)).toHaveLength(9)
    expect(html).not.toContain(' open=')
    expect(html).toContain('Ver detalle'); expect(html).toContain('Ocultar detalle')
    expect(html).toContain('Técnico de prueba'); expect(html).toContain('Usuario registrado')
    expect(html).toContain('dateTime="2026-10-01T15:20:39Z"')
    expect(html).toContain('Fecha envío: 01/10/2026')
    expect(html).toContain('dato adicional preservado')
    for (const tone of ['created', 'progress', 'blocked', 'delivered', 'late', 'neutral']) expect(html).toContain(`repair-event-${tone}`)
    expect(html.indexOf('Actualización registrada')).toBeLessThan(html.indexOf('Necesidad creada'))
  })
  it('timeline admite eventos sin detalle y no inventa transiciones', () => {
    const event: RepairEvent = { id: 1, requestId: 'r1', action: 'COMMENT', actor: 'local-user', revision: 1, recordedAt: '2026-10-01T15:00:00Z', detail: {}, snapshot: request() }
    expect(timelineEntries([event])[0].summary).toBe('')
    const html = renderToStaticMarkup(createElement(RepairTimeline, { events: [event], users: [] }))
    expect(html).toContain('Usuario local'); expect(html).toContain('Comentario agregado')
    expect(html).toContain('Datos completos del registro')
    expect(renderToStaticMarkup(createElement(RepairTimeline, { events: [], users: [] }))).not.toContain('<li')
  })
  it('selección masiva excluye entregadas/canceladas y entrega excluye bloqueadas', () => {
    const r = request(4); r.items[0].status = 'DELIVERED'; r.items[1].status = 'CANCELLED'; r.items[2].status = 'BLOCKED'
    expect(eligibleStatusItems(r.items, 'IN_PROGRESS').map((i) => i.ordinal)).toEqual([3, 4])
    expect(eligibleStatusItems(r.items, 'DELIVERED').map((i) => i.ordinal)).toEqual([4])
  })
  it('cumplimiento separado del estado y atraso usa necesidad aunque compromiso sea futuro', () => {
    const r = request(); const i = r.items[0]; i.status = 'IN_PROGRESS'; i.commitments = [promise('2026-10-10')]
    expect(complianceLabel(i, r, '2026-09-20')).toBe('Vencida · 5 días'); expect(i.status).toBe('IN_PROGRESS')
    i.status = 'DELIVERED'; i.delivery = { deliveredAt: '2026-09-16', comment: '', actor: 'u' }
    expect(complianceLabel(i, r)).toBe('Cumplida fuera de fecha')
    i.delivery.deliveredAt = '2026-09-15'; expect(complianceLabel(i, r)).toBe('Cumplida en fecha')
  })
  it('snapshots legacy se leen como pendientes sin alterar el evento original', () => {
    const r = request(); (r.items[0] as { status: string }).status = 'PLANNED'
    const e = { id: 1, requestId: r.id, recordedAt: '2026-09-01T00:00:00Z', snapshot: r } as RepairEvent
    expect(stateAt([e], '2026-09-02T00:00:00Z')[0].items[0].status).toBe('PENDING')
    expect(e.snapshot.items[0].status).toBe('PLANNED')
  })
  it('vista sintética no expone JSON, UUID ni nombres de propiedades fuera del detalle expandible', () => {
    const r = request(); const original = structuredClone(r); r.items[0].status = 'IN_PROGRESS'
    const created: RepairEvent = { id: 1, requestId: r.id, action: 'CREATE', actor: 'private-user-id', recordedAt: '2026-09-01T15:00:00Z', revision: 1, detail: { equipmentId: 'private-equipment-id', requiredDate: r.requiredDate }, snapshot: original }
    const started: RepairEvent = { ...created, id: 2, action: 'START', detail: { itemIds: [r.items[0].id], date: '2026-09-02' }, snapshot: r }
    expect(eventPresentation(started, created).lines).toContain('Unidad #1: Pendiente → En curso')
    const state = { users: [{ id: 'private-user-id', name: 'Juan Perez' }], responsibles: [], config: { blockCategories: [], workshops: ['Taller'] } } as unknown as RepairState
    const html = renderToStaticMarkup(createElement(RepairDetail, { request: r, state, events: [created, started], eventError: '', busy: false, onSave: async () => true, onAction: () => {} }))
    const collapsed = html.replace(/<details class="repair-event-details">[\s\S]*?<\/article>/g, '</article>')
    for (const value of ['equipmentId', 'requiredDate', 'itemIds', 'private-user-id', 'private-equipment-id', '<pre', '<table']) expect(collapsed).not.toContain(value)
    expect(html).toContain('Juan Perez'); expect(html).toContain('Estado actual'); expect(html).toContain('Guardar cambios')
  })
  it('cumplimiento a fecha ignora necesidades futuras y toma fin de mes sin día exacto', () => {
    const due = request(2); due.items[0].status = 'DELIVERED'; due.items[0].delivery = { deliveredAt: '2026-09-16', actor: 'u', comment: '' }
    const future = request(3); future.targetMonth = '2027-03-01'; future.requiredDate = null
    const current = request(); current.requiredDate = null
    expect(exerciseMetrics([due, future, current], 2026, '2026-09-24')).toMatchObject({ planned: 6, delivered: 1, due: 2, fulfilled: 1, percent: 50 })
    expect(itemMetrics(current.items[0], current, '2026-09-30').overdue).toBe(false)
    expect(itemMetrics(current.items[0], current, '2026-10-01').overdue).toBe(true)
    expect(exerciseMetrics([future], 2026, '2026-09-24').percent).toBeNull()
  })
  it('estados mixtos respetan vencida > bloqueada > en curso > entregada', () => {
    const r = request(3); r.items[0].status = 'DELIVERED'; r.items[1].status = 'IN_PROGRESS'; r.items[2].status = 'BLOCKED'
    expect(requestMetrics(r, '2026-09-01')).toMatchObject({ delivered: 1, tone: 'blocked' })
    expect(requestMetrics(r, '2026-09-20').tone).toBe('late')
    r.items[2].status = 'PENDING'; expect(requestMetrics(r, '2026-09-01').tone).toBe('progress')
  })
  it.each([1, 3])('necesidad con %i unidades, sin entregas', (n) => { const r = request(n); expect(requestMetrics(r, '2026-09-01')).toMatchObject({ delivered: 0, pending: n, active: true }) })
  it('entrega parcial 1/3 y completa 3/3', () => {
    const r = request(3); r.items[0].status = 'DELIVERED'; r.items[0].delivery = { deliveredAt: '2026-09-10', comment: '', actor: 'u' }
    expect(requestMetrics(r, '2026-09-10')).toMatchObject({ delivered: 1, pending: 2, active: true })
    for (const i of r.items) { i.status = 'DELIVERED'; i.delivery = { deliveredAt: '2026-09-10', comment: '', actor: 'u' } }
    expect(requestMetrics(r, '2026-09-10')).toMatchObject({ delivered: 3, pending: 0, tone: 'delivered' })
  })
  it('en curso dentro de fecha, vencimiento automático sin escritura', () => {
    const r = request(); r.items[0].status = 'IN_PROGRESS'; r.items[0].commitments = [promise('2026-09-10')]
    expect(itemMetrics(r.items[0], r, '2026-09-10').overdue).toBe(false)
    expect(itemMetrics(r.items[0], r, '2026-09-13')).toMatchObject({ overdue: true, workshopLate: true, plantLate: false, lateDays: 3 })
  })
  it('detecta compromiso posterior a necesidad antes del vencimiento', () => { const r = request(); r.items[0].commitments = [promise('2026-09-20')]; expect(itemMetrics(r.items[0], r, '2026-09-01')).toMatchObject({ commitmentMismatch: true, overdue: false }) })
  it('períodos que empiezan a mitad de mes incluyen su plan mensual', () => { const r = request(3); expect(historicalMetrics([r], '2026-09-15', '2026-09-30')).toMatchObject({ planned: 3, planDelivered: 0, planPercent: 0 }) })
  it.each([['2026-09-10', 0], ['2026-09-12', 2], ['2026-09-08', -2]])('entrega %s con desvío %i', (at, deviation) => { const r = request(); const i = r.items[0]; i.commitments = [promise('2026-09-10')]; i.status = 'DELIVERED'; i.delivery = { deliveredAt: at, actor: 'u', comment: '' }; expect(itemMetrics(i, r, '2026-10-01')).toMatchObject({ overdue: false, originalDeviation: deviation, currentDeviation: deviation }) })
  it('compromiso original se conserva frente a múltiples reprogramaciones', () => { const r = request(); const i = r.items[0]; i.commitments = [promise('2026-09-10'), promise('2026-09-12', 2), promise('2026-09-20', 3)]; i.status = 'DELIVERED'; i.delivery = { deliveredAt: '2026-09-18', actor: 'u', comment: '' }; expect(itemMetrics(i, r)).toMatchObject({ first: '2026-09-10', committed: '2026-09-20', originalDeviation: 8, currentDeviation: -2, plantDeviation: 3 }); expect(historicalMetrics([r], '2026-09-01', '2026-09-30')).toMatchObject({ percent: 100, originalPercent: 0, reschedules: 2 }) })
  it('bloqueos abiertos/cerrados calculan duración sin descontar a ciegas SLA', () => { const b = block(); expect(blockedDays(b, '2026-09-10')).toBe(8); b.resolvedAt = '2026-09-05'; expect(blockedDays(b, '2026-09-10')).toBe(3) })
  it('Planta y Taller se separan; bloqueada también puede estar vencida', () => { const r = request(2); r.items.forEach((i, index) => { i.status = 'BLOCKED'; i.blocks = [block(index ? 'WORKSHOP' : 'PLANT')] }); expect(dashboardMetrics([r], '2026-09-20')).toMatchObject({ plant: 1, blocked: 1, overdue: 1 }); expect(historicalMetrics([r], '2026-09-01', '2026-09-10').byOwner).toEqual({ PLANT: 8, WORKSHOP: 8 }) })
  it('criticidad próxima y vencida tiene prioridad', () => { const r = request(); r.criticality = 'CRITICAL'; r.criticalReason = 'Sin pie'; expect(requestMetrics(r, '2026-09-10')).toMatchObject({ priority: 1, criticalRisk: true }); expect(requestMetrics(r, '2026-09-20').priority).toBe(0) })
  it('histórico respeta estado y nombre conocidos en la fecha', () => { const r = request(); const changed = structuredClone(r); changed.items[0].status = 'DELIVERED'; changed.equipment.name = 'Otro'; const events = [{ id: 1, requestId: r.id, recordedAt: '2026-09-01T00:00:00Z', snapshot: r }, { id: 2, requestId: r.id, recordedAt: '2026-09-20T00:00:00Z', snapshot: changed }] as RepairEvent[]; expect(stateAt(events, '2026-09-10T00:00:00Z')).toEqual([r]); expect(stateAt(events, '2026-08-01T00:00:00Z')).toEqual([]) })
  it('matriz genera julio 2026 a junio 2027 y otros períodos', () => { expect(monthSequence('2026-07')).toHaveLength(12); expect(monthSequence('2026-07')[11]).toBe('2027-06'); expect(monthSequence('2028-12', 2)).toEqual(['2028-12', '2029-01']) })
  it.each([['X', 1], ['x', 1], ['3', 3], [2, 2], ['', null]])('legacy %s → %s', (v, expected) => expect(legacyQuantity(v)).toBe(expected))
  it.each(['Cruceta', 'X-BIELAS', 'N/A', 0, -1, 1.2])('rechaza cantidad ambigua %s', (v) => expect(() => legacyQuantity(v)).toThrow())
  it('mes objetivo define el plan, entrega real otra métrica; cancelación no es entrega', () => { const r = request(2); r.items[0].status = 'DELIVERED'; r.items[0].delivery = { deliveredAt: '2026-09-12', comment: '', actor: 'u' }; r.items[1].status = 'CANCELLED'; expect(historicalMetrics([r], '2026-09-01', '2026-09-30')).toMatchObject({ planned: 2, delivered: 1, planDelivered: 1, planPercent: 50, comparable: 0, percent: null }); r.targetMonth = '2026-10-01'; expect(historicalMetrics([r], '2026-09-01', '2026-09-30').planned).toBe(0) })
})

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import type { Server } from 'node:http'
import { createApp } from '../../server/app'
import { initializeRepairs } from '../../server/repairs/router'
import { createDemoSparesData } from '../../src/spares/data/demoSpares'
import { HttpCriticalSparesRepository } from '../../src/spares/repositories/HttpCriticalSparesRepository'
import { RepairsRepository } from '../../src/repairs/repository'
import { today } from '../../src/repairs/domain'
import { requestMetrics } from '../../src/repairs/domain'
import { fiscalYear, systemDay } from '../../src/repairs/calendar'
import type { RepairState } from '../../src/repairs/types'

describe.skipIf(process.env.RUN_POSTGRES_TESTS !== '1')('Reparaciones: API + PostgreSQL', () => {
  let db: PrismaClient; let server: Server; let base: string; let repository: RepairsRepository; let state: RepairState
  const cleanup = async () => { await db.repairEvent.deleteMany(); await db.repairDelivery.deleteMany(); await db.repairBlock.deleteMany(); await db.repairCommitment.deleteMany(); await db.repairItem.deleteMany(); await db.repairRequest.deleteMany(); await db.repairEquipmentProfile.deleteMany(); await db.auditLog.deleteMany({ where: { entity: 'repairImport' } }) }
  const start = async () => { db = new PrismaClient(); await initializeRepairs(db); server = createApp(db, 'dist-spares').listen(0, '127.0.0.1'); await new Promise<void>((resolve) => server.on('listening', resolve)); base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`; repository = new RepairsRepository(`${base}/repairs`) }
  const stop = async () => { await new Promise<void>((resolve) => server?.close(() => resolve())); await db?.$disconnect() }
  beforeAll(async () => { if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Base _test requerida'); await start() })
  afterAll(async () => { if (db) await cleanup(); await stop() })
  beforeEach(async () => {
    await cleanup()
    const spares = new HttpCriticalSparesRepository(base, () => 'admin-demo'); await spares.importBackup(createDemoSparesData(), (await spares.load()).revision)
    state = await repository.load()
    state = await repository.save('/equipment', { equipmentId: 'eq-transfer-4', idrep: 'EQ-TEST', name: state.equipment.find((e) => e.id === 'eq-transfer-4')!.name, area: 'LCO', sector: 'LC1C', trade: 'Mecánica', active: true }, state.revision, 'admin-demo')
  })
  const create = async (quantity = 1) => {
    state = await repository.save('/requests', { equipmentId: 'eq-transfer-4', quantity, targetMonth: `${today().slice(0, 7)}-01`, requiredDate: today(), criticality: 'NORMAL', criticalReason: '', fixedDeadline: false, responsibleId: '', criticalDueDate: '', workshop: 'Taller central', notes: '' }, state.revision, 'admin-demo')
    return state.requests[0]
  }
  const act = async (id: string, action: string, itemIds?: string[], extra: Record<string, unknown> = {}) => { state = await repository.save(`/requests/${id}/actions`, { action, ...(action === 'COMMENT' ? {} : { itemIds, date: today() }), comment: 'Prueba', ...extra }, state.revision, 'admin-demo') }
  it('selector conserva transiciones y colores con estados por unidad y protege entregadas', async () => {
    const r = await create(3); const ids = r.items.map((i) => i.id)
    expect(r.items.every((i) => i.status === 'PENDING')).toBe(true)
    const original = await repository.events(r.id)
    await act(r.id, 'START', ids); expect(requestMetrics(state.requests[0]).tone).toBe('progress')
    await act(r.id, 'BLOCK', [ids[2]], { owner: 'PLANT', category: 'Repuesto no enviado', description: 'Rodamiento pendiente' })
    expect(requestMetrics(state.requests[0]).tone).toBe('blocked')
    await act(r.id, 'DELIVER', [ids[0]])
    expect(requestMetrics(state.requests[0])).toMatchObject({ delivered: 1, tone: 'blocked' })
    await expect(act(r.id, 'PEND', ids)).rejects.toThrow('cerrada')
    expect((await db.repairItem.findUniqueOrThrow({ where: { id: ids[0] } })).status).toBe('DELIVERED')
    await act(r.id, 'START', [ids[2]])
    expect(requestMetrics(state.requests[0]).tone).toBe('progress')
    expect(state.requests[0].items[2].blocks[0].resolvedAt).toBeTruthy()
    await act(r.id, 'DELIVER', ids.slice(1)); expect(requestMetrics(state.requests[0]).tone).toBe('delivered')
    const events = await repository.events(r.id)
    expect(events[0]).toEqual(original[0])
    expect(events[1].detail.changes).toContainEqual({ ordinal: 1, before: 'PENDING', after: 'IN_PROGRESS' })
    expect(events[4].detail.changes).toContainEqual({ ordinal: 3, before: 'BLOCKED', after: 'IN_PROGRESS' })
    expect((await new RepairsRepository(`${base}/repairs`).load()).requests[0].items.every((i) => i.status === 'DELIVERED')).toBe(true)
  })
  it('volver a pendiente y cancelar no borran el inicio ni bloqueo del historial', async () => {
    const r = await create(); const ids = [r.items[0].id]
    await act(r.id, 'START', ids)
    await act(r.id, 'BLOCK', ids, { owner: 'PLANT', category: 'Repuesto no enviado', description: 'Falta pieza' })
    await act(r.id, 'PEND', ids, { comment: '' })
    expect(state.requests[0].items[0]).toMatchObject({ status: 'PENDING', startedAt: null })
    await act(r.id, 'CANCEL', ids)
    expect(state.requests[0].items[0].status).toBe('CANCELLED')
    const events = await repository.events(r.id)
    expect(events[1].snapshot.items[0].startedAt).toBeTruthy()
    expect(events[2].snapshot.items[0].blocks[0].resolvedAt).toBeNull()
    expect(events[4].detail.changes).toEqual([{ ordinal: 1, before: 'PENDING', after: 'CANCELLED' }])
  })
  it('bloqueo exige responsable, motivo configurado y comentario', async () => {
    const r = await create(); const ids = [r.items[0].id]
    for (const extra of [{ category: 'Repuesto no enviado', description: 'Pieza' }, { owner: 'PLANT', category: 'Inventado', description: 'Pieza' }, { owner: 'PLANT', category: 'Repuesto no enviado', description: 'Pieza', comment: '' }]) {
      await expect(act(r.id, 'BLOCK', ids, extra)).rejects.toThrow()
    }
    expect(await db.repairBlock.count()).toBe(0); expect(await db.repairEvent.count()).toBe(1)
  })
  it.each([1, 3])('alta genera exactamente %i unidades y evento', async (quantity) => { const r = await create(quantity); expect(r.items).toHaveLength(quantity); expect(await db.repairItem.count()).toBe(quantity); expect(await db.repairEvent.count()).toBe(1); expect((await repository.events(r.id))[0].snapshot.quantity).toBe(quantity) })
  it('alta desde celdas de meses distintos, cantidades 1/3 y fecha NULL persisten para otro cliente', async () => {
    const year = fiscalYear() + 1
    const draft = { equipmentId: 'eq-transfer-4', quantity: 1, targetMonth: `${year}-08-01`, requiredDate: null, criticality: 'NORMAL', criticalReason: '', fixedDeadline: false, responsibleId: null, criticalDueDate: null, workshop: 'Taller central', notes: '' }
    state = await repository.save('/requests', draft, state.revision, 'admin-demo')
    state = await repository.save('/requests', { ...draft, quantity: 3, targetMonth: `${year + 1}-03-01` }, state.revision, 'admin-demo')
    const second = await new RepairsRepository(`${base}/repairs`).load()
    expect(second.requests).toHaveLength(2); expect(second.requests.every((r) => r.requiredDate === null)).toBe(true)
    expect(await db.repairItem.count()).toBe(4)
    const history = await (await fetch(`${base}/repairs/history?exercise=${year}`)).json()
    expect(history.series).toHaveLength(12); expect(history.series[0].month).toBe(`${year}-07`)
    expect(history.series.every((m: { phase: string; planPercent: number | null }) => m.phase === 'future' && m.planPercent === null)).toBe(true)
    expect(history.series.find((m: { month: string }) => m.month === `${year + 1}-03`).planned).toBe(3)
    await expect(repository.save('/requests', { ...draft, requiredDate: `${year}-09-15` }, state.revision, 'admin-demo')).rejects.toThrow('mes objetivo')
    expect(await db.repairRequest.count()).toBe(2)
  })
  it('entrega parcial, completa y segunda PC tras reinicio conservan datos', async () => {
    const r = await create(3)
    await act(r.id, 'START', r.items.map((i) => i.id))
    await act(r.id, 'DELIVER', [r.items[0].id])
    expect(state.requests[0].items.filter((i) => i.status === 'DELIVERED')).toHaveLength(1)
    await act(r.id, 'DELIVER', r.items.slice(1).map((i) => i.id))
    await stop(); await start()
    const b = new RepairsRepository(`${base}/repairs`)
    expect((await b.load()).requests[0].items.every((i) => i.status === 'DELIVERED')).toBe(true)
    expect(await db.repairDelivery.count()).toBe(3)
    expect((await b.events(r.id))).toHaveLength(4)
  })
  it('bloquear Planta, resolver, bloquear Taller, resolver conserva ambos y duración', async () => {
    const r = await create(); const ids = [r.items[0].id]
    await act(r.id, 'START', ids)
    await act(r.id, 'BLOCK', ids, { owner: 'PLANT', category: 'Repuesto no enviado', description: 'Rodamiento' })
    await expect(act(r.id, 'DELIVER', ids)).rejects.toThrow('Resolvé')
    await act(r.id, 'RESOLVE', ids)
    expect(state.requests[0].items[0].status).toBe('IN_PROGRESS')
    await act(r.id, 'BLOCK', ids, { owner: 'WORKSHOP', category: 'Falta capacidad', description: 'Banco ocupado' })
    await act(r.id, 'RESOLVE', ids)
    const blocks = await db.repairBlock.findMany()
    expect(blocks).toHaveLength(2); expect(blocks.every((b) => b.resolvedAt && b.durationDays === 0)).toBe(true)
  })
  it('permite registrar fechas reales anteriores al alta sin inventar eventos pasados', async () => {
    const r = await create(); const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    await act(r.id, 'DELIVER', [r.items[0].id], { date: yesterday })
    expect(state.requests[0].items[0].delivery?.deliveredAt.slice(0, 10)).toBe(yesterday)
    expect((await repository.events(r.id)).every((e) => systemDay(new Date(e.recordedAt)) === today())).toBe(true)
  })
  it('múltiples compromisos append-only y motivos visibles', async () => {
    const r = await create(); const ids = [r.items[0].id]
    const dates = [today(), new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)]
    for (const d of dates) await act(r.id, 'COMMIT', ids, { date: d })
    expect(state.requests[0].items[0].commitments.map((c) => c.date.slice(0, 10))).toEqual(dates)
    await expect(act(r.id, 'COMMIT', ids, { date: dates[2] })).rejects.toThrow('no cambió')
    expect(await db.repairCommitment.count()).toBe(3)
  })
  it('cambio de mes y criticidad preservan snapshots previos', async () => {
    const r = await create(); const first = (await repository.events(r.id))[0]
    const targetMonth = '2027-02-01'
    state = await repository.save(`/requests/${r.id}`, { targetMonth, requiredDate: '2027-02-10', criticality: 'CRITICAL', criticalReason: 'Sin pie', criticalDueDate: '2027-02-08', fixedDeadline: true, responsibleId: '', workshop: r.workshop, notes: '', reason: 'Nueva intervención' }, state.revision, 'admin-demo', 'PUT')
    expect(state.requests[0].targetMonth.slice(0, 10)).toBe(targetMonth)
    expect((await repository.events(r.id))[0]).toEqual(first)
    const history = await (await fetch(`${base}/repairs/history?from=${today()}&until=${today()}`)).json()
    expect(history.availableSince).toBeTruthy(); expect(history.backlog.active).toBe(1)
  })
  it('428/409/422 y acciones mixtas fallidas revierten toda la transacción', async () => {
    const r = await create(2); const revision = state.revision
    expect((await fetch(`${base}/repairs/requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(428)
    await act(r.id, 'START', [r.items[1].id])
    await expect(repository.save(`/requests/${r.id}/actions`, { action: 'COMMENT', comment: 'Obsoleto' }, revision, 'admin-demo')).rejects.toThrow('Otro usuario')
    const count = await db.repairEvent.count()
    await expect(act(r.id, 'START', r.items.map((i) => i.id))).rejects.toThrow('ya tiene ese estado')
    expect((await repository.load()).requests[0].items[0].status).toBe('PENDING')
    expect(await db.repairEvent.count()).toBe(count)
    await expect(act(r.id, 'BLOCK', [r.items[0].id], { owner: 'PLANT', category: 'inventada', description: 'Error' })).rejects.toThrow('Categoría')
  })
  it('import legacy X/x/cantidad es atómico, no duplica lote y protege datos compartidos', async () => {
    const rows = ['X', 'x', 3].map((quantity, index) => ({ idrep: 'EQ-TEST', name: state.equipment.find((e) => e.id === 'eq-transfer-4')!.name, area: 'LCO', sector: 'LC1C', trade: 'Mecánica', targetMonth: `2027-0${index + 1}-01`, requiredDate: `2027-0${index + 1}-10`, quantity, workshop: 'Taller central', notes: '' }))
    state = await repository.save('/import', { confirmed: true, rows }, state.revision, 'admin-demo')
    expect(await db.repairItem.count()).toBe(5)
    await expect(repository.save('/import', { confirmed: true, rows }, state.revision, 'admin-demo')).rejects.toThrow('ya fue importado')
    await expect(repository.save('/import', { confirmed: true, rows: [rows[0], { ...rows[1], area: 'INEXISTENTE' }] }, state.revision, 'admin-demo')).rejects.toThrow('Área')
    expect(await db.repairRequest.count()).toBe(3)
    const spares = new HttpCriticalSparesRepository(base, () => 'admin-demo'); const current = await spares.load()
    await expect(spares.updateConfig({ ...current.data.config, equipment: current.data.config.equipment.filter((e) => e.id !== 'eq-transfer-4') }, current.revision)).rejects.toThrow()
    expect(await db.repairRequest.count()).toBe(3)
  })
  it('cancelación conserva historia y cierra bloqueo sin inventar entrega', async () => { const r = await create(); await act(r.id, 'BLOCK', [r.items[0].id], { owner: 'PLANT', category: 'Repuesto no enviado', description: 'Falta' }); await act(r.id, 'CANCEL', [r.items[0].id]); expect(state.requests[0].items[0].status).toBe('CANCELLED'); expect(await db.repairDelivery.count()).toBe(0); expect((await repository.events(r.id))).toHaveLength(3); expect(state.requests[0].items[0].blocks[0].resolvedAt).toBeTruthy() })
})

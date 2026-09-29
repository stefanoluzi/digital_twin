import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import type { Server } from 'node:http'
import { createApp } from '../../server/app'
import { initializeRex } from '../../server/rex/router'
import { RexRepository } from '../../src/rex/repository'
import { taskMetrics } from '../../src/rex/domain'
import type { RexState } from '../../src/rex/types'

describe.skipIf(process.env.RUN_POSTGRES_TESTS !== '1')('REX API + PostgreSQL real', () => {
  let db: PrismaClient; let server: Server; let base: string; let repo: RexRepository; let state: RexState
  const cleanup = async () => { await db.rexPendingResolution.deleteMany(); await db.rexPending.deleteMany(); await db.rexExecutionItem.deleteMany(); await db.rexExecution.deleteMany(); await db.rexTaskDocument.deleteMany(); await db.rexTaskScopeItem.deleteMany(); await db.rexEstimate.deleteMany(); await db.rexTask.deleteMany(); await db.rexEvent.deleteMany(); await db.auditLog.deleteMany({ where: { entity: { startsWith: 'rex' } } }) }
  beforeAll(async () => {
    if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Solo base _test')
    db = new PrismaClient(); await initializeRex(db)
    await db.revision.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })
    await db.area.upsert({ where: { id: 'LCO' }, create: { id: 'LCO', code: 'LCO', name: 'Laminador continuo' }, update: {} })
    server = createApp(db).listen(0, '127.0.0.1'); await new Promise<void>((resolve) => server.on('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/rex`; repo = new RexRepository(base)
  })
  afterAll(async () => { if (db) { await cleanup(); await db.$disconnect() }; if (server) await new Promise<void>((r) => server.close(() => r())) })
  beforeEach(async () => { await db.rexEstimate.deleteMany(); await cleanup(); await db.rexConfig.update({ where: { id: 1 }, data: { hoursPerDay: 9, hourlyRate: null, currency: 'USD' } }); state = await repo.load() })
  const draft = () => ({ name: 'Cambio conjunto transferidor', areaId: 'LCO', specialty: 'MEC', criticality: 'HIGH', frequencyType: 'PERIODIC', intervalMonths: 24, scope: ['Estructura', 'Reductor', 'Acoplamiento', 'Cilindro hidráulico'].map((description) => ({ description, quantity: 1, unit: 'unidad', required: true })) })
  const save = async (path: string, body: unknown, method = 'POST') => { const next = await repo.save(path, body, state.revision, method); state = next; return next.id }
  const createTask = () => save('/tasks', draft())
  const estimate = { durationDays: '3', mechanical: '12', electrical: '1', mro: '30000', services: '5000', ownLabor: '1500' }
  it('estimaciones persistidas, configuración compartida y snapshots históricos inmutables', async () => {
    await save('/config', { hoursPerDay: '9', hourlyRate: '25', currency: 'USD' }, 'PUT')
    const taskId = await save('/tasks', { ...draft(), resources: { HH: 'LEGACY 123' }, estimate })
    expect(state.tasks[0].estimates[0]).toMatchObject({ manHours: '351', contractorLabor: '8775', total: '45275', hourlyRate: '25' })
    expect((await db.rexEstimate.findFirstOrThrow()).total.toString()).toBe('45275')
    const planId = await save('/executions', { taskId, mode: 'PLAN', items: [] })
    const snapshot = state.executions[0].taskSnapshot
    await save('/config', { hoursPerDay: '9', hourlyRate: '30', currency: 'USD' }, 'PUT')
    expect((await new RexRepository(base).load()).config.hourlyRate).toBe('30')
    await save(`/tasks/${taskId}`, { ...draft(), name: 'Título corregido' }, 'PUT')
    expect(state.tasks[0].estimates[0].total).toBe('45275')
    expect(state.tasks[0].resources).toEqual({ HH: 'LEGACY 123' })
    const items = state.executions[0].items
    await save(`/executions/${planId}/finalize`, { performedAt: '2026-05-18', items: items.map((i) => ({ id: i.id, completed: 1 })) })
    expect(state.executions[0].taskSnapshot).toEqual(snapshot)
    await save('/executions', { taskId, mode: 'PLAN', items: [] })
    expect(state.executions.find((e) => e.id !== planId)!.taskSnapshot.estimate).toMatchObject({ hourlyRate: '30', total: '47030.00' })
    await save(`/tasks/${taskId}`, { ...draft(), estimate }, 'PUT')
    expect(state.tasks[0].estimates[0].total).toBe('47030')
    expect(await db.rexEstimate.count({ where: { taskId } })).toBe(2)
    expect(state.executions.find((e) => e.id === planId)!.taskSnapshot).toEqual(snapshot)
  })
  it('backend rechaza estimaciones adulteradas, tarifa ausente y configuración inválida', async () => {
    const before = state.revision
    await expect(save('/tasks', { ...draft(), estimate })).rejects.toThrow()
    expect((await repo.load()).revision).toBe(before)
    expect(await db.rexTask.count()).toBe(0)
    await save('/config', { hoursPerDay: '9', hourlyRate: '25', currency: 'USD' }, 'PUT')
    for (const extra of [{ total: '1' }, { hourlyRate: '0' }, { manHours: '1' }]) {
      await expect(save('/tasks', { ...draft(), estimate: { ...estimate, ...extra } })).rejects.toThrow()
    }
    await expect(save('/config', { hoursPerDay: '0', hourlyRate: '25', currency: 'USD' }, 'PUT')).rejects.toThrow()
    expect(await db.rexEstimate.count()).toBe(0)
    expect((await fetch(`${base}/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hoursPerDay: '9', hourlyRate: '25', currency: 'USD' }) })).status).toBe(428)
  })
  const createEvent = () => save('/events', { name: 'REX Abril/Mayo 2026', type: 'REX', status: 'OPEN' })
  const partial = async (taskId: string, eventId?: string, performedAt: string | null = null) => {
    const task = state.tasks.find((t) => t.id === taskId)!
    return save('/executions', { taskId, eventId, mode: 'RESULT', performedAt, items: task.scope.map((s, i) => ({ id: s.id, completed: i < 3 ? 1 : 0, reason: i === 3 ? 'Taller' : '', notes: i === 3 ? 'Taller no llegó con la reparación' : '' })) })
  }
  it('caso cilindro: parcial, evento cerrado, segunda PC, resolución y origen intacto', async () => {
    const taskId = await createTask(); const eventId = await createEvent(); const executionId = await partial(taskId, eventId)
    const original = await db.rexExecution.findUniqueOrThrow({ where: { id: executionId }, include: { items: { orderBy: { ordinal: 'asc' } } } })
    expect(original.status).toBe('PARTIAL'); expect(state.pending).toHaveLength(1); expect(state.pending[0].notes).toBe('Taller no llegó con la reparación')
    await save(`/events/${eventId}`, { name: 'REX Abril/Mayo 2026', type: 'REX', status: 'CLOSED' }, 'PUT')
    expect((await new RexRepository(base).load()).pending[0].remaining).toBe('1')
    const pendingId = state.pending[0].id
    const resolutionId = await save(`/pending/${pendingId}/resolutions`, { performedAt: '2026-08-18', quantity: 1, notes: 'Cilindro hidráulico reemplazado' })
    expect(state.pending[0].remaining).toBe('0'); expect(state.pending[0].resolutions[0].executionId).toBe(resolutionId)
    expect(await db.rexExecution.findUniqueOrThrow({ where: { id: executionId }, include: { items: { orderBy: { ordinal: 'asc' } } } })).toEqual(original)
    const clientB = await new RexRepository(base).load()
    expect(clientB.executions).toHaveLength(2); expect(taskMetrics(clientB.tasks[0], clientB).lastComplete).toBeUndefined()
    expect(taskMetrics(clientB.tasks[0], clientB).lastIntervention?.id).toBe(resolutionId)
    expect(taskMetrics(clientB.tasks[0], clientB).cycle).toBe('NO_COMPLETE')
    expect(await db.auditLog.count({ where: { entity: 'rexResolution' } })).toBe(1)
  })
  it('maestro editado no altera snapshot de planificación ni resultado posterior', async () => {
    const taskId = await createTask()
    const planId = await save('/executions', { taskId, mode: 'PLAN', items: [] })
    expect(state.pending).toHaveLength(0)
    const before = state.executions[0].items
    await save(`/tasks/${taskId}`, { ...draft(), name: 'Transferidor modificado', scope: [{ description: 'Otro alcance', quantity: 8, unit: 'piezas', required: true }] }, 'PUT')
    expect(state.executions[0].items).toEqual(before)
    await save(`/executions/${planId}/finalize`, { performedAt: '2026-05-18', items: before.map((i, n) => ({ id: i.id, completed: n === 3 ? 0 : 1, reason: n === 3 ? 'Taller' : '' })) })
    expect(state.executions[0].status).toBe('PARTIAL'); expect(state.pending[0].component).toBe('Cilindro hidráulico')
    await expect(save(`/executions/${planId}/finalize`, { items: before.map((i) => ({ id: i.id, completed: 1 })) })).rejects.toThrow('no se sobrescribe')
  })
  it('completa de 2024, parcial 2026 y resolución no reinician el ciclo', async () => {
    const taskId = await createTask()
    await save('/executions', { taskId, mode: 'RESULT', performedAt: '2024-05-18', items: state.tasks[0].scope.map((s) => ({ id: s.id, completed: 1 })) })
    await partial(taskId, undefined, '2026-05-18')
    await save(`/pending/${state.pending[0].id}/resolutions`, { performedAt: '2026-08-18', quantity: 1, notes: 'Cilindro reemplazado' })
    expect(taskMetrics(state.tasks[0], state, '2026-09-28').due).toBe('2026-05-18')
    expect(taskMetrics(state.tasks[0], state, '2026-09-28').cycle).toBe('OVERDUE')
  })
  it('cantidades fraccionarias y resolución parcial mantienen saldo exacto', async () => {
    const taskId = await save('/tasks', { ...draft(), scope: [{ description: 'Mangueras', quantity: 8, unit: 'm', required: true }] })
    await save('/executions', { taskId, mode: 'RESULT', performedAt: '2026-05-18', items: [{ id: state.tasks[0].scope[0].id, completed: 4.1, reason: 'Falta de repuesto' }] })
    const id = state.pending[0].id
    await save(`/pending/${id}/resolutions`, { performedAt: '2026-08-18', quantity: 0.1, notes: 'Primer tramo' })
    expect(state.pending[0].remaining).toBe('3.8')
    await save(`/pending/${id}/resolutions`, { performedAt: '2026-08-18', quantity: 3.8, notes: 'Último tramo' })
    expect(state.pending[0].remaining).toBe('0')
    await expect(save(`/pending/${id}/resolutions`, { performedAt: '2026-08-18', quantity: 0.001, notes: 'Duplicado' })).rejects.toThrow('saldo')
  })
  it('doble resolución concurrente: una confirmada, otra 409, sin duplicar', async () => {
    await partial(await createTask())
    const body = { performedAt: '2026-08-18', quantity: 1, notes: 'Reemplazo' }
    const results = await Promise.allSettled([repo.save(`/pending/${state.pending[0].id}/resolutions`, body, state.revision), repo.save(`/pending/${state.pending[0].id}/resolutions`, body, state.revision)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await db.rexPendingResolution.count()).toBe(1)
  })
  it('422 revierte alta de ejecución/ítems/auditoría y conserva revisión', async () => {
    const taskId = await createTask(); const before = state.revision
    await expect(save('/executions', { taskId, mode: 'RESULT', items: state.tasks[0].scope.map((s) => ({ id: s.id, completed: 2 })) })).rejects.toThrow('supera')
    expect(await db.rexExecution.count()).toBe(0); expect((await repo.load()).revision).toBe(before)
    await expect(save('/executions', { taskId, mode: 'RESULT', items: state.tasks[0].scope.map((s) => ({ id: s.id, completed: 0 })) })).rejects.toThrow('motivo')
  })
  it('fecha resolución anterior se rechaza y origen no se altera', async () => {
    await partial(await createTask(), undefined, '2026-05-18')
    await expect(save(`/pending/${state.pending[0].id}/resolutions`, { performedAt: '2026-05-17', quantity: 1, notes: 'Inválida' })).rejects.toThrow('anterior')
    expect(await db.rexPendingResolution.count()).toBe(0)
  })
  it('428 sin If-Match y 409 revisión obsoleta', async () => {
    const response = await fetch(`${base}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft()) })
    expect(response.status).toBe(428)
    const revision = state.revision; await createTask()
    await expect(repo.save('/tasks', draft(), revision)).rejects.toThrow('Otra persona')
  })
  it('sin subtareas funciona como una actividad única', async () => {
    const taskId = await save('/tasks', { ...draft(), scope: [] })
    await save('/executions', { taskId, mode: 'RESULT', items: [{ id: 'single', completed: 1 }] })
    expect(state.executions[0].items).toHaveLength(1); expect(state.executions[0].status).toBe('COMPLETED')
    expect(taskMetrics(state.tasks[0], state).due).toBeNull()
  })
  it('eventos sin fecha no inventan ejercicio; julio/junio se calculan', async () => {
    await save('/events', { name: 'REX 2021', type: 'REX', status: 'CLOSED' })
    expect(state.events[0].startDate).toBeNull(); expect(state.events[0].exercise).toBeNull()
    const june = await save('/events', { name: 'Junio', type: 'BO', status: 'CLOSED', startDate: '2026-06-30' })
    const july = await save('/events', { name: 'Julio', type: 'BO', status: 'CLOSED', startDate: '2026-07-01' })
    expect(state.events.find((e) => e.id === june)?.exercise).toBe(2025); expect(state.events.find((e) => e.id === july)?.exercise).toBe(2026)
  })
  it('FK impide borrar el área compartida usada por una tarea', async () => {
    await db.area.create({ data: { id: 'rex-test-area', code: 'REX-TEST', name: 'Prueba' } })
    try { await save('/tasks', { ...draft(), areaId: 'rex-test-area' }); await expect(db.area.delete({ where: { id: 'rex-test-area' } })).rejects.toThrow() }
    finally { await cleanup(); await db.area.delete({ where: { id: 'rex-test-area' } }) }
  })
})

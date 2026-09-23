import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import type { Server } from 'node:http'
import { createApp } from '../../server/app'
import { HttpLcoRepository } from '../../src/maintenance/repositories/HttpLcoRepository'
import { createEmptyLcoCouplingData } from '../../src/maintenance/domain/lcoCouplings'
import { HttpCriticalSparesRepository } from '../../src/spares/repositories/HttpCriticalSparesRepository'

describe.skipIf(process.env.RUN_POSTGRES_TESTS !== '1')('LCO central: PostgreSQL real', () => {
  let db: PrismaClient; let server: Server; let base: string; let a: HttpLcoRepository; let b: HttpLcoRepository
  const start = async () => {
    server = createApp(db, 'dist-spares').listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.on('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    a = new HttpLcoRepository(`${base}/api/controles-criticos/acoplamientos`); b = new HttpLcoRepository(`${base}/api/controles-criticos/acoplamientos`)
  }
  beforeAll(async () => {
    if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Solo base dedicada de tests')
    db = new PrismaClient(); await start()
  })
  afterAll(async () => { await new Promise<void>((resolve) => server?.close(() => resolve())); await db?.$disconnect() })
  beforeEach(async () => {
    await db.lcoImportReceipt.deleteMany(); await db.lcoEventVersion.deleteMany(); await db.lcoPhoto.deleteMany(); await db.lcoReading.deleteMany(); await db.lcoEvent.deleteMany()
    await db.lcoConfig.update({ where: { id: 1 }, data: { revision: 0, staleDays: 90, veryStaleDays: 180, recentDays: 30, dueDays: 60, oldDays: 90, migratedLegacyFingerprints: [] } })
    await db.lcoCage.updateMany({ data: { assetId: null } })
  })
  const draft = () => ({ type: 'INSPECTION', date: '2026-09-23', inspector: 'Técnico', observations: 'Control', attachments: [], readings: [{ couplingId: 'J1_SUP_RED', wearLevel: 3, note: 'Inicial' }] })
  const create = () => a.request('/events', 'POST', draft(), 0)
  it('crea, B lee, edita fecha/desgaste, conserva versiones y elimina sin destruir evidencia', async () => {
    const state = await create(); const event = state.data.events[0]
    expect(state.revision).toBe(1); expect(event.id).toMatch(/^LCO_/)
    expect((await b.load()).data.events).toEqual(state.data.events)
    expect(await db.lcoReading.count()).toBe(1)
    const edited = await a.request(`/events/${event.id}`, 'PUT', { ...event, date: '2026-09-20', readings: [{ couplingId: 'J1_SUP_RED', wearLevel: 5, note: 'Corregido' }] }, 1)
    expect(edited.revision).toBe(2)
    const versions = await db.lcoEventVersion.findMany({ where: { eventId: event.id }, orderBy: { revision: 'asc' } })
    expect(versions).toHaveLength(2); expect(versions[0].snapshot).toMatchObject({ date: '2026-09-23' })
    expect(await a.request(`/events/${event.id}/versions`)).toHaveLength(2)
    await a.request(`/events/${event.id}`, 'DELETE', undefined, 2)
    expect((await b.load()).data.events).toEqual([])
    expect((await db.lcoEvent.findUniqueOrThrow({ where: { id: event.id } })).deletedAt).not.toBeNull()
    expect(await db.lcoEventVersion.count()).toBe(3)
  })
  it('recambios de acoplamiento y alunga, fotos y borrado de una lectura', async () => {
    const photo = { id: 'photo', fileName: 'foto.png', mimeType: 'image/png', dataUrl: 'data:image/png;base64,aGVsbG8=', createdAt: '2026-09-23T10:00:00.000Z', caption: 'Evidencia' }
    let state = await a.request('/events', 'POST', { ...draft(), attachments: [photo], readings: [...draft().readings, { couplingId: 'J1_SUP_JAU', wearLevel: 2, note: '', attachments: [{ ...photo, id: 'reading-photo' }] }] }, 0)
    const eventId = state.id!
    expect(await db.lcoPhoto.count()).toBe(2)
    state = await a.request(`/events/${eventId}?couplingId=J1_SUP_RED`, 'DELETE', undefined, state.revision)
    expect(state.data.events[0]).toMatchObject({ readings: [{ couplingId: 'J1_SUP_JAU' }] })
    state = await a.request('/events', 'POST', { type: 'COUPLING_REPLACEMENT', date: '2026-09-24', couplingId: 'J1_SUP_JAU', reason: '', notes: '', sapWorkOrder: 'OT', wearAtRemoval: 3, attachments: [photo] }, state.revision)
    state = await a.request('/events', 'POST', { type: 'SHAFT_REPLACEMENT', date: '2026-09-25', cageNumber: 1, shaftPosition: 'UPPER', reason: '', notes: '', sapWorkOrder: '', attachments: [] }, state.revision)
    expect(state.data.events).toHaveLength(3)
    const summary = await a.request<any>('/summary?date=2026-09-26')
    expect(summary.wear.total).toBe(32); expect(summary.wear.critical).toBe(0)
  })
  it('reiniciar backend y cliente DB conserva eventos visibles en B', async () => {
    const created = await create()
    await new Promise<void>((resolve) => server.close(() => resolve())); await db.$disconnect()
    db = new PrismaClient(); await start()
    expect(await b.load()).toMatchObject({ revision: 1, data: { events: created.data.events } })
  })
  it('importación idempotente confirmada, incluso al reintentar con revisión antigua', async () => {
    const data = createEmptyLcoCouplingData()
    data.events = [{ ...draft(), id: 'legacy-1', createdAt: '2026-09-23T10:00:00.000Z' } as any]
    const imported = await a.request('/import', 'POST', data, 0)
    expect(imported.receipt?.eventCount).toBe(1)
    const retried = await b.request('/import', 'POST', data, 0)
    expect(retried.revision).toBe(1); expect(await db.lcoEvent.count()).toBe(1)
    expect(await db.lcoEventVersion.count()).toBe(1)
    expect(await a.request(`/imports/${imported.receipt!.hash}`)).toMatchObject({ eventCount: 1 })
    await a.request('/events/legacy-1', 'DELETE', undefined, 1)
    expect((await b.request('/import', 'POST', data, 0)).data.events).toHaveLength(0)
  })
  it('importar un ID conflictivo revierte también las nuevas filas previas', async () => {
    const created = await create(); const data = createEmptyLcoCouplingData()
    data.events = [{ ...created.data.events[0], id: 'new-before-conflict' }, { ...created.data.events[0], date: '2026-09-10' }]
    await expect(a.request('/import', 'POST', data, 1)).rejects.toMatchObject({ status: 409 })
    expect(await db.lcoEvent.count()).toBe(1); expect(await db.lcoImportReceipt.count()).toBe(0)
    expect((await b.load()).revision).toBe(1)
  })
  it('422, 428, 409 y FK sin cambios parciales', async () => {
    await expect(a.request('/events', 'POST', draft())).rejects.toMatchObject({ status: 428 })
    await expect(a.request('/events', 'POST', { ...draft(), date: '2026-02-30' }, 0)).rejects.toMatchObject({ status: 422 })
    await expect(a.request('/events', 'POST', { ...draft(), readings: [{ couplingId: 'invalid', wearLevel: 9, note: '' }] }, 0)).rejects.toMatchObject({ status: 422 })
    await create()
    await expect(b.request('/events', 'POST', draft(), 0)).rejects.toMatchObject({ status: 409 })
    await expect(db.lcoCoupling.delete({ where: { id: 'J1_SUP_RED' } })).rejects.toMatchObject({ code: 'P2003' })
    expect((await b.load()).revision).toBe(1)
  })
  it('Repuestos y LCO usan la misma API/DB con revisiones separadas', async () => {
    const spares = new HttpCriticalSparesRepository(`${base}/api`)
    const before = await spares.load()
    await create()
    expect(await spares.load()).toEqual(before)
    await spares.updateConfig(before.data.config, before.revision)
    expect((await b.load()).revision).toBe(1)
    for (const path of ['/', '/repuestos', '/controles-criticos', '/controles-criticos/acoplamientos']) {
      const response = await fetch(`${base}${path}`)
      expect(response.status).toBe(200); expect(await response.text()).toContain('id="root"')
    }
  })
})

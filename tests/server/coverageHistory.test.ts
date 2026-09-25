import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import type { Server } from 'node:http'
import { createApp } from '../../server/app'
import { initializeCoverageHistory } from '../../server/sparesDatabase'
import { recordCoverage } from '../../server/coverageHistory'
import { createDemoSparesData } from '../../src/spares/data/demoSpares'
import { HttpCriticalSparesRepository } from '../../src/spares/repositories/HttpCriticalSparesRepository'
import { coverageSummary } from '../../src/spares/domain/spareSelectors'

describe.skipIf(process.env.RUN_POSTGRES_TESTS !== '1')('Históricos PostgreSQL real', () => {
  let db: PrismaClient; let server: Server; let base: string; let client: HttpCriticalSparesRepository
  const start = async () => {
    db = new PrismaClient()
    server = createApp(db, 'dist-spares').listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.on('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`
    client = new HttpCriticalSparesRepository(base, () => 'admin-demo')
  }
  const stop = async () => { await new Promise<void>((resolve) => server?.close(() => resolve())); await db?.$disconnect() }
  beforeAll(async () => {
    if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Requiere base _test')
    await start()
  })
  afterAll(stop)
  beforeEach(async () => {
    await client.importBackup(createDemoSparesData(), (await client.load()).revision)
    await db.coverageSnapshot.deleteMany()
    await initializeCoverageHistory(db)
  })
  it('inicialización real y reinicio no duplican; otro cliente lee los mismos indicadores', async () => {
    const first = await db.coverageSnapshot.findFirstOrThrow({ include: { groups: true } })
    expect(first).toMatchObject(coverageSummary((await client.load()).data))
    await stop(); await start(); await initializeCoverageHistory(db)
    expect(await db.coverageSnapshot.count()).toBe(1)
    const response = await (await fetch(`${base}/coverage-history?period=ALL`)).json()
    expect(response.current.id).toBe(first.id)
    expect(response.baseline).toBeNull()
    expect(response.thirtyDaysAgo).toBeNull()
    expect(response.current.groups.length).toBe(first.groups.length)
  })
  it('comentarios no duplican ni cuentan como mejora; alta cambia el universo; conflicto no escribe', async () => {
    let state = await client.load()
    const spare = state.data.spareTypes[0]
    const { id: _id, createdAt: _created, updatedAt: _updated, uncoveredAt: _uncovered, ...draft } = spare
    state = await client.update(spare.id, { ...draft, comments: 'Solo comentario' }, state.revision)
    expect(await db.coverageSnapshot.count()).toBe(1)
    const before = await db.coverageSnapshot.findFirstOrThrow()
    const changed = await client.create({ ...draft, sapNumber: '', name: 'Nuevo universo' }, state.revision)
    const after = await db.coverageSnapshot.findFirstOrThrow({ orderBy: { id: 'desc' } })
    expect(after.total).toBe(before.total + 1)
    expect(after.covered).toBe(before.covered)
    expect(after.uncovered).toBe(before.uncovered + 1)
    await expect(client.create({ ...draft, sapNumber: '', name: 'Conflicto' }, state.revision)).rejects.toMatchObject({ status: 409 })
    expect(await db.coverageSnapshot.count()).toBe(2)
    expect((await client.load()).revision).toBe(changed.revision)
  })
  it('reasignación y renombre conservan el GMB anterior en cada snapshot', async () => {
    const before = await db.coverageSnapshot.findFirstOrThrow({ include: { groups: true } })
    let state = await client.load()
    const area = state.data.config.areas.find((item) => item.id === 'LCO')!
    const next = state.data.config.responsibles.find((item) => item.active && item.id !== area.responsibleGmbId)!
    state = await client.updateConfig({ ...state.data.config, areas: state.data.config.areas.map((item) => item.id === 'LCO' ? { ...item, responsibleGmbId: next.id } : item) }, state.revision)
    await client.updateConfig({ ...state.data.config, responsibles: state.data.config.responsibles.map((item) => item.id === next.id ? { ...item, name: 'Nombre nuevo' } : item) }, state.revision)
    const original = await db.coverageSnapshot.findUniqueOrThrow({ where: { id: before.id }, include: { groups: true } })
    expect(original).toEqual(before)
    const last = await db.coverageSnapshot.findFirstOrThrow({ orderBy: { id: 'desc' }, include: { groups: true } })
    expect(last.groups.find((group) => group.dimension === 'AREA' && group.key === 'LCO')).toMatchObject({ responsibleId: next.id, responsibleName: 'Nombre nuevo' })
  })
  it('cambio de stock registra mejora y posteriores comentarios mantienen su fecha', async () => {
    let state = await client.load()
    const spare = state.data.spareTypes.find((item) => !state.data.units.some((unit) => unit.spareTypeId === item.id && ['WAREHOUSE', 'MACHINE_SIDE'].includes(unit.status)))!
    state = await client.createUnit(spare.id, { status: 'WAREHOUSE', statusSince: '2026-09-24', comment: '', location: '' }, state.revision)
    const last = await db.coverageSnapshot.findFirstOrThrow({ orderBy: { id: 'desc' }, include: { groups: true } })
    expect(last.groups.find((group) => group.dimension === 'AREA' && group.key === spare.area)?.lastImprovedAt).not.toBeNull()
    const { id: _id, createdAt: _created, updatedAt: _updated, uncoveredAt: _uncovered, ...draft } = spare
    await client.update(spare.id, { ...draft, comments: 'No es una mejora' }, state.revision)
    expect(await db.coverageSnapshot.findFirstOrThrow({ orderBy: { id: 'desc' }, include: { groups: true } })).toEqual(last)
  })
  it('rangos filtran snapshots; rollback incluye el histórico', async () => {
    await db.coverageSnapshot.deleteMany()
    const state = await client.load()
    const now = Date.now()
    await db.$transaction(async (tx) => {
      await recordCoverage(tx, state.data, state.revision, new Date(now - 40 * 86400000))
      const next = structuredClone(state.data); next.units = []
      await recordCoverage(tx, next, state.revision, new Date(now - 10 * 86400000))
    })
    for (const [period, count] of [['7', 0], ['30', 1], ['90', 2]] as const) {
      const response = await (await fetch(`${base}/coverage-history?period=${period}`)).json()
      expect(response.points).toHaveLength(count)
    }
    expect((await fetch(`${base}/coverage-history?period=CUSTOM&from=2026-02-30&until=2026-03-01`)).status).toBe(422)
    const from = new Date(now - 12 * 86400000).toISOString().slice(0, 10)
    const until = new Date(now - 8 * 86400000).toISOString().slice(0, 10)
    expect((await (await fetch(`${base}/coverage-history?period=CUSTOM&from=${from}&until=${until}`)).json()).points).toHaveLength(1)
    await expect(db.$transaction(async (tx) => { await recordCoverage(tx, state.data, state.revision); throw new Error('rollback') })).rejects.toThrow('rollback')
    expect(await db.coverageSnapshot.count()).toBe(2)
  })
})

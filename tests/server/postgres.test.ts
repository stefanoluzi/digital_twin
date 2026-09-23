import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import type { Server } from 'node:http'
import { createApp } from '../../server/app'
import { createDemoSparesData } from '../../src/spares/data/demoSpares'
import { HttpCriticalSparesRepository } from '../../src/spares/repositories/HttpCriticalSparesRepository'
import { coverageSummary } from '../../src/spares/domain/spareSelectors'
import type { SpareDraft } from '../../src/spares/store/criticalSparesStore'
import { createUuid } from '../../src/spares/domain/createUuid'

// Explicit opt-in: normal npm test never modifies a developer/production DB.
describe.skipIf(process.env.RUN_POSTGRES_TESTS !== '1')('PostgreSQL real + API + clientes independientes', () => {
  let db: PrismaClient; let server: Server; let base: string
  let a: HttpCriticalSparesRepository; let b: HttpCriticalSparesRepository
  beforeAll(async () => {
    if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Base de prueba dedicada requerida')
    db = new PrismaClient()
    server = createApp(db, 'dist-spares').listen(0, '0.0.0.0')
    await new Promise<void>((resolve) => server.on('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`
    a = new HttpCriticalSparesRepository(base, () => 'admin-demo')
    b = new HttpCriticalSparesRepository(base, () => 'supervisor-demo')
  })
  afterAll(async () => { await new Promise<void>((resolve) => server?.close(() => resolve())); await db?.$disconnect() })
  beforeEach(async () => { const { revision } = await a.load(); await a.importBackup(createDemoSparesData(), revision) })
  const draft = (name: string): SpareDraft => ({ sapNumber: '', name, description: 'Prueba central', categoryId: 'reductor', area: 'LCO', compatibleEquipmentIds: ['eq-transfer-4', 'eq-transfer-5'], drawingNumber: '', comments: '' })

  it('catálogos vacíos: Rodamientos, Juan Perez y Perforador persisten y B los ve', async () => {
    const empty = createDemoSparesData()
    empty.spareTypes = []; empty.units = []; empty.history = []
    empty.config.categories = []; empty.config.responsibles = []; empty.config.equipment = []
    empty.config.areas = empty.config.areas.map(({ responsibleGmbId: _r, migrationCandidateIds: _m, ...area }) => area)
    empty.config.users = [{ id: 'local-user', name: 'Usuario local', role: 'ADMIN' }]
    empty.config.currentUserId = 'local-user'
    await a.importBackup(empty, (await a.load()).revision)
    // Dedicated test DB only: reproduce the initial migration's revision exactly.
    await db.revision.update({ where: { id: 1 }, data: { version: 0 } })
    let state = await a.load()
    const category = { id: `category-${createUuid()}`, name: 'Rodamientos' }
    state = await a.updateConfig({ ...state.data.config, categories: [category] }, state.revision)
    expect(state.revision).toBe(1)
    expect(await db.category.findUnique({ where: { id: category.id } })).toEqual(category)
    expect((await b.load()).data.config.categories).toEqual([category])
    const responsible = { id: `responsible-${createUuid()}`, name: 'Juan Perez', active: true }
    state = await a.updateConfig({ ...state.data.config, responsibles: [responsible] }, state.revision)
    expect(state.revision).toBe(2)
    expect(await db.responsible.findUnique({ where: { id: responsible.id } })).toEqual(responsible)
    expect((await b.load()).data.config.responsibles).toEqual([responsible])
    const equipment = { id: `equipment-${createUuid()}`, name: 'Perforador', area: 'LCO' as const }
    state = await a.updateConfig({ ...state.data.config, equipment: [equipment] }, state.revision)
    expect(state.revision).toBe(3)
    expect(await db.equipment.findUnique({ where: { id: equipment.id } })).toEqual(equipment)
    expect(await b.load()).toEqual(state)
    const areas = state.data.config.areas.map((area) => area.id === 'LCO' ? { ...area, responsibleGmbId: responsible.id } : area)
    state = await a.updateConfig({ ...state.data.config, areas }, state.revision)
    expect((await b.load()).data.config.areas.find((area) => area.id === 'LCO')?.responsibleGmbId).toBe(responsible.id)
    expect((await db.revision.findUniqueOrThrow({ where: { id: 1 } })).version).toBe(4)
  })

  it('PUT config rechaza 428/409/422 sin alterar datos ni revisión', async () => {
    const state = await a.load()
    const options = { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.data.config) }
    expect((await fetch(`${base}/config`, options)).status).toBe(428)
    await expect(a.updateConfig(state.data.config, state.revision - 1)).rejects.toMatchObject({ status: 409 })
    await expect(a.updateConfig({ ...state.data.config, categories: [{ id: 'invalid', name: '' }] }, state.revision)).rejects.toMatchObject({ status: 422 })
    expect(await b.load()).toEqual(state)
  })

  it('escucha en 0.0.0.0 y sirve frontend y API en el mismo puerto', async () => {
    expect((server.address() as { address: string }).address).toBe('0.0.0.0')
    const root = await fetch(base.replace('/api', '/'))
    expect(root.status).toBe(200)
    expect(await root.text()).toContain('id="root"')
    expect(await (await fetch(`${base}/health`)).json()).toEqual({ status: 'ok', database: 'postgresql' })
  })
  it('cerrar y recrear app y cliente Prisma conserva datos de A visibles para B', async () => {
    const created = await a.create(draft('Persistente tras reinicio'), (await a.load()).revision)
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await db.$disconnect()
    db = new PrismaClient()
    server = createApp(db, 'dist-spares').listen(0, '0.0.0.0')
    await new Promise<void>((resolve) => server.on('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`
    a = new HttpCriticalSparesRepository(base, () => 'admin-demo')
    b = new HttpCriticalSparesRepository(base, () => 'supervisor-demo')
    expect((await b.load()).data.spareTypes.find((spare) => spare.id === created.id)?.name).toBe('Persistente tras reinicio')
  })

  it('A crea → PostgreSQL persiste → B ve; edita y elimina con relaciones N:M', async () => {
    const created = await a.create(draft('Cliente A'), (await a.load()).revision)
    const stored = await db.spare.findUnique({ where: { id: created.id! }, include: { equipment: true } })
    expect(stored?.name).toBe('Cliente A'); expect(stored?.equipment).toHaveLength(2)
    const seen = await b.load()
    expect(seen.data.spareTypes.find((spare) => spare.id === created.id)?.name).toBe('Cliente A')
    const edited = await b.update(created.id!, draft('Cliente B'), seen.revision)
    expect((await a.load()).data.spareTypes.find((spare) => spare.id === created.id)?.name).toBe('Cliente B')
    await a.remove(created.id!, edited.revision)
    expect(await db.spare.findUnique({ where: { id: created.id! } })).toBeNull()
    const audit = await db.auditLog.findMany({ where: { entityId: created.id, field: 'name' } })
    expect(audit.some((row) => row.user === 'supervisor-demo' && row.oldValue === 'Cliente A' && row.newValue === 'Cliente B')).toBe(true)
  })
  it('rechaza cambios simultáneos obsoletos sin perder al ganador', async () => {
    const state = await a.load()
    const results = await Promise.allSettled([a.create(draft('Concurrente A'), state.revision), b.create(draft('Concurrente B'), state.revision)])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const failure = results.find((result) => result.status === 'rejected') as PromiseRejectedResult
    expect(failure.reason.status).toBe(409)
    expect((await b.load()).data.spareTypes.filter((spare) => spare.name.startsWith('Concurrente'))).toHaveLength(1)
  })
  it('reasignar el área cambia su GMB sin modificar cada repuesto; impide borrar GMB referenciado', async () => {
    const state = await a.load()
    const config = structuredClone(state.data.config)
    config.areas.find((area) => area.id === 'LCO')!.responsibleGmbId = 'gmb-hidraulica'
    const changed = await a.updateConfig(config, state.revision)
    expect((await b.load()).data.config.areas.find((area) => area.id === 'LCO')?.responsibleGmbId).toBe('gmb-hidraulica')
    expect(changed.data.spareTypes).toEqual(state.data.spareTypes)
    config.responsibles = config.responsibles.filter((person) => person.id !== 'gmb-hidraulica')
    await expect(a.updateConfig(config, changed.revision)).rejects.toMatchObject({ status: 422 })
  })
  it('unidades cambian cobertura e historial, y borrar conserva el evento', async () => {
    let state = await a.load()
    const created = await a.createUnit('sp-bomba-hg', { status: 'WAREHOUSE', statusSince: '2026-09-22', location: 'A1', comment: '' }, state.revision)
    expect(coverageSummary(created.data).covered).toBe(4)
    state = await a.updateUnit(created.id!, { status: 'IN_REPAIR', statusSince: '2026-09-22', location: '', comment: 'Reparar', sapNotice: '123' }, created.revision)
    expect(state.data.history.filter((event) => event.unitId === created.id)).toHaveLength(2)
    state = await a.removeUnit(created.id!, state.revision)
    expect(state.data.history.filter((event) => event.unitId === created.id)).toHaveLength(2)
    const next = await a.createUnit('sp-bomba-hg', { status: 'WAREHOUSE', statusSince: '2026-09-22', location: '', comment: '' }, state.revision)
    expect(next.id).not.toBe(created.id)
  })
  it('backup export/import conserva IDs, fotos, PDF, y registros de unidades eliminadas', async () => {
    const data = createDemoSparesData()
    data.spareTypes[0].referencePhoto = 'data:image/png;base64,aGVsbG8='
    data.spareTypes[0].drawingPdf = 'data:application/pdf;base64,JVBERg=='
    data.units = data.units.slice(1)
    await a.importBackup(data, (await a.load()).revision)
    const exported = await (await fetch(`${base}/backup`)).json()
    expect(exported.version).toBe(2)
    const spare = exported.data.spareTypes.find((item: { id: string }) => item.id === data.spareTypes[0].id)
    expect(spare.referencePhoto).toBe(data.spareTypes[0].referencePhoto)
    expect(spare.drawingPdf).toBe(data.spareTypes[0].drawingPdf)
    expect(exported.data.history).toHaveLength(data.history.length)
    await a.importBackup(exported.data, (await a.load()).revision)
    expect(await db.spare.count()).toBe(6)
  })
  it('importación inválida no altera datos, revisión ni auditoría', async () => {
    const state = await a.load(); const count = await db.auditLog.count()
    const data = structuredClone(state.data); data.units[0].spareTypeId = 'missing'
    await expect(a.importBackup(data, state.revision)).rejects.toMatchObject({ status: 422 })
    expect(await a.load()).toEqual(state); expect(await db.auditLog.count()).toBe(count)
  })
  it('ROLLBACK real cuando PostgreSQL falla DESPUÉS de escribir parte de una importación', async () => {
    const state = await a.load(); const count = await db.auditLog.count()
    // Test-only failure injected at the audit stage, after operational upserts.
    await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION reject_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END $$`)
    await db.$executeRawUnsafe(`CREATE TRIGGER reject_test_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_test_audit()`)
    try {
      const data = structuredClone(state.data); data.spareTypes[0].name = 'No debe persistir'
      await expect(a.importBackup(data, state.revision)).rejects.toBeDefined()
      expect(await a.load()).toEqual(state); expect(await db.auditLog.count()).toBe(count)
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER reject_test_audit ON audit_log')
      await db.$executeRawUnsafe('DROP FUNCTION reject_test_audit()')
    }
  })
  it('rechaza API sin revisión, origen externo y campos ajenos al modelo', async () => {
    expect((await fetch(`${base}/spares`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(428)
    expect((await fetch(`${base}/spares`, { method: 'POST', headers: { Origin: 'https://evil.invalid', 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(403)
    const state = await a.load()
    await expect(a.create({ ...draft('bad'), id: 'forced' } as SpareDraft, state.revision)).rejects.toMatchObject({ status: 422 })
  })
})

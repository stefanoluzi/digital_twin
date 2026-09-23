import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import type { Server } from 'node:http'
import { createApp } from '../../server/app'
import { createDemoSparesData } from '../../src/spares/data/demoSpares'
import { HttpCriticalSparesRepository } from '../../src/spares/repositories/HttpCriticalSparesRepository'
import { coverageSummary } from '../../src/spares/domain/spareSelectors'
import type { SpareDraft } from '../../src/spares/store/criticalSparesStore'

// Explicit opt-in: normal npm test never modifies a developer/production DB.
describe.skipIf(process.env.RUN_POSTGRES_TESTS !== '1')('PostgreSQL real + API + clientes independientes', () => {
  let db: PrismaClient; let server: Server; let base: string
  let a: HttpCriticalSparesRepository; let b: HttpCriticalSparesRepository
  beforeAll(async () => {
    if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Base de prueba dedicada requerida')
    db = new PrismaClient()
    server = createApp(db).listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.on('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`
    a = new HttpCriticalSparesRepository(base, () => 'admin-demo')
    b = new HttpCriticalSparesRepository(base, () => 'supervisor-demo')
  })
  afterAll(async () => { await new Promise<void>((resolve) => server?.close(() => resolve())); await db?.$disconnect() })
  beforeEach(async () => { const { revision } = await a.load(); await a.importBackup(createDemoSparesData(), revision) })
  const draft = (name: string): SpareDraft => ({ sapNumber: '', name, description: 'Prueba central', categoryId: 'reductor', area: 'LCO', compatibleEquipmentIds: ['eq-transfer-4', 'eq-transfer-5'], drawingNumber: '', comments: '' })

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

import { Prisma, type PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'
import type { CriticalSparesData } from '../src/spares/types'
import { ApiError } from './errors'
import { recordCoverage } from './coverageHistory'

type Tx = Prisma.TransactionClient
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value))
const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value, (_key, item) => item === null ? undefined : item))
const optionalFields = (row: object, fields: string[]) => Object.fromEntries(fields.map((key) => [key, key === 'installedEquipmentId' ? (row as Record<string, unknown>)[key] || null : (row as Record<string, unknown>)[key] ?? null]))

export async function readData(tx: Tx): Promise<CriticalSparesData> {
  const [spares, units, history, areas, categories, equipment, responsibles, users] = await Promise.all([
    tx.spare.findMany({ include: { equipment: { orderBy: { equipmentId: 'asc' } } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    tx.unit.findMany({ orderBy: { id: 'asc' } }), tx.history.findMany({ orderBy: [{ timestamp: 'asc' }, { id: 'asc' }] }),
    tx.area.findMany({ orderBy: { id: 'asc' } }), tx.category.findMany({ orderBy: { name: 'asc' } }),
    tx.equipment.findMany({ orderBy: { id: 'asc' } }), tx.responsible.findMany({ orderBy: { id: 'asc' } }),
    tx.appUser.findMany({ orderBy: { id: 'asc' } }),
  ])
  return clean({ schemaVersion: 2, spareTypes: spares.map(({ equipment, ...spare }) => ({ ...spare, compatibleEquipmentIds: equipment.map((item) => item.equipmentId) })), units, history,
    config: { areas, categories, equipment, responsibles, users, currentUserId: users[0]?.id || 'local-user' },
  }) as CriticalSparesData
}

export async function readState(db: PrismaClient) {
  return db.$transaction(async (tx) => ({ data: await readData(tx), revision: (await tx.revision.findUniqueOrThrow({ where: { id: 1 } })).version }), { isolationLevel: 'RepeatableRead' })
}

// Keep all relationships in tables; JSON is only used for historical snapshots.
// Only changed records are upserted. Import deletes missing rows in FK-safe order.
export async function writeData(tx: Tx, before: CriticalSparesData, after: CriticalSparesData) {
  const removed = (oldRows: { id: string }[], rows: { id: string }[]) => oldRows.filter((old) => !rows.some((row) => row.id === old.id)).map((row) => row.id)
  await tx.history.deleteMany({ where: { id: { in: removed(before.history, after.history) } } })
  await tx.unit.deleteMany({ where: { id: { in: removed(before.units, after.units) } } })
  // Relationship replacement is small and transactional; no operational row is reset.
  await tx.spareEquipment.deleteMany()
  await tx.spare.deleteMany({ where: { id: { in: removed(before.spareTypes, after.spareTypes) } } })
  const changed = <T extends { id: string }>(old: T[], rows: T[]) => rows.filter((row) => JSON.stringify(old.find((item) => item.id === row.id)) !== JSON.stringify(row))
  for (const row of changed(before.config.responsibles, after.config.responsibles)) await tx.responsible.upsert({ where: { id: row.id }, create: row, update: row })
  for (const row of changed(before.config.categories, after.config.categories)) await tx.category.upsert({ where: { id: row.id }, create: row, update: row })
  for (const row of changed(before.config.users, after.config.users)) await tx.appUser.upsert({ where: { id: row.id }, create: row, update: row })
  for (const row of changed(before.config.areas, after.config.areas)) {
    const data = { ...row, responsibleGmbId: row.responsibleGmbId || null, migrationCandidateIds: row.migrationCandidateIds || [] }
    await tx.area.upsert({ where: { id: row.id }, create: data, update: data })
  }
  for (const row of changed(before.config.equipment, after.config.equipment)) await tx.equipment.upsert({ where: { id: row.id }, create: row, update: row })
  for (const { compatibleEquipmentIds, ...row } of changed(before.spareTypes, after.spareTypes)) {
    const data = { ...row, ...optionalFields(row, ['drawingPdf', 'drawingPdfName', 'referencePhoto', 'uncoveredAt']) }
    await tx.spare.upsert({ where: { id: row.id }, create: data, update: data })
  }
  for (const row of changed(before.units, after.units)) {
    const data = { ...row, ...optionalFields(row, ['installedEquipmentId', 'installationDate', 'sapNotice', 'repairStartDate', 'solp', 'purchaseOrder', 'eta', 'photo']) }
    await tx.unit.upsert({ where: { id: row.id }, create: data, update: data })
  }
  for (const row of changed(before.history, after.history)) {
    const data = { ...row, snapshot: json(row.snapshot), previousStatus: row.previousStatus || null, equipmentId: row.equipmentId || null }
    await tx.history.upsert({ where: { id: row.id }, create: data, update: data })
  }
  const links = after.spareTypes.flatMap((spare) => spare.compatibleEquipmentIds.map((equipmentId) => ({ spareId: spare.id, equipmentId })))
  if (links.length) await tx.spareEquipment.createMany({ data: links })
  await tx.equipment.deleteMany({ where: { id: { in: removed(before.config.equipment, after.config.equipment) } } })
  await tx.area.deleteMany({ where: { id: { in: removed(before.config.areas, after.config.areas) } } })
  await tx.responsible.deleteMany({ where: { id: { in: removed(before.config.responsibles, after.config.responsibles) } } })
  await tx.category.deleteMany({ where: { id: { in: removed(before.config.categories, after.config.categories) } } })
  await tx.appUser.deleteMany({ where: { id: { in: removed(before.config.users, after.config.users) } } })
}

function auditValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === undefined || value === null) return Prisma.DbNull
  if (typeof value === 'string' && value.startsWith('data:')) return { attachment: true, length: value.length, sha256: createHash('sha256').update(value).digest('hex') }
  // Historical snapshots can contain attachments too.
  return JSON.parse(JSON.stringify(value, (_key, v) => typeof v === 'string' && v.startsWith('data:') ? { attachment: true, length: v.length, sha256: createHash('sha256').update(v).digest('hex') } : v))
}

async function auditChanges(tx: Tx, before: CriticalSparesData, after: CriticalSparesData, actor: string, importing: boolean) {
  const entities = (data: CriticalSparesData) => ({ spare: data.spareTypes, unit: data.units, history: data.history, area: data.config.areas, responsible: data.config.responsibles, equipment: data.config.equipment, category: data.config.categories, user: data.config.users })
  const old = entities(before); const next = entities(after)
  const logs: Prisma.AuditLogCreateManyInput[] = []
  for (const entity of Object.keys(old) as (keyof typeof old)[]) {
    const oldRows = new Map(old[entity].map((row) => [row.id, row as unknown as Record<string, unknown>]))
    const newRows = new Map(next[entity].map((row) => [row.id, row as unknown as Record<string, unknown>]))
    for (const entityId of new Set([...oldRows.keys(), ...newRows.keys()])) {
      const a = oldRows.get(entityId); const b = newRows.get(entityId)
      for (const field of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
        if (JSON.stringify(a?.[field]) === JSON.stringify(b?.[field])) continue
        logs.push({ user: actor, entity, entityId, action: importing ? 'IMPORT' : !a ? 'CREATE' : !b ? 'DELETE' : 'UPDATE', field, oldValue: auditValue(a?.[field]), newValue: auditValue(b?.[field]) })
      }
    }
  }
  if (logs.length) await tx.auditLog.createMany({ data: logs })
}

export async function mutateState(db: PrismaClient, revision: number, actor: string, mutate: (data: CriticalSparesData) => { data: CriticalSparesData; id?: string }, importing = false) {
  return db.$transaction(async (tx) => {
    // Serializes writes, including imports; the version check prevents stale clients
    // from overwriting a successful write. A rejected write rolls back audit + data.
    const rows = await tx.$queryRaw<{ version: number }[]>`SELECT version FROM "Revision" WHERE id = 1 FOR UPDATE`
    if (rows[0]?.version !== revision) throw new ApiError(409, 'Otro usuario modificó los datos. Actualizá desde el servidor y revisá tu edición antes de guardar.')
    const before = await readData(tx)
    await recordCoverage(tx, before, revision)
    const result = mutate(structuredClone(before))
    await writeData(tx, before, result.data)
    await auditChanges(tx, before, result.data, actor, importing)
    await recordCoverage(tx, result.data, revision + 1)
    await tx.revision.update({ where: { id: 1 }, data: { version: { increment: 1 } } })
    return { data: await readData(tx), revision: revision + 1, id: result.id }
  }, { maxWait: 15000, timeout: 60000 })
}

export async function initializeCoverageHistory(db: PrismaClient) {
  await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ version: number }[]>`SELECT version FROM "Revision" WHERE id=1 FOR UPDATE`
    await recordCoverage(tx, await readData(tx), rows[0].version)
  }, { timeout: 60000 })
}

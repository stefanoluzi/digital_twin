import { Router } from 'express'
import { Prisma, type PrismaClient } from '@prisma/client'
import { createHash, randomUUID } from 'node:crypto'
import { ApiError } from '../errors'
import { canonicalLco, lcoConfigSchema, validateLcoData, validateLcoEvent } from '../../src/maintenance/domain/lcoValidation'
import { createDefaultLcoCouplingTopology, createLcoShaftId, getLcoShaftById, type LcoCouplingEvent, type LcoCouplingModuleData } from '../../src/maintenance/domain/lcoCouplings'
import { getLcoCouplingSummary, getLcoInspectionAgeSummary } from '../../src/maintenance/domain/lcoCouplingSelectors'
import { parseDateOnly } from '../../src/maintenance/domain/maintenanceDateService'

type Tx = Prisma.TransactionClient
const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v))

export async function readLco(tx: Tx) {
  const config = await tx.lcoConfig.findUniqueOrThrow({ where: { id: 1 } })
  const cages = await tx.lcoCage.findMany({ orderBy: { id: 'asc' } })
  const rows = await tx.lcoEvent.findMany({ where: { deletedAt: null }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }], include: { readings: { orderBy: { ordinal: 'asc' } }, photos: { orderBy: { ordinal: 'asc' } } } })
  const events = rows.map((row): LcoCouplingEvent => {
    const photos = (scope: string) => row.photos.filter((p) => p.scope === scope).map(({ id, fileName, mimeType, dataUrl, createdAt, caption }) => ({ id, fileName, mimeType: mimeType as 'image/png', dataUrl, createdAt, caption }))
    const base = { id: row.id, date: row.date, createdAt: row.createdAt, ...(row.updatedAt ? { updatedAt: row.updatedAt } : {}), attachments: photos(''), inspector: row.inspector }
    if (row.type === 'INSPECTION') return { ...base, type: 'INSPECTION', observations: row.observations || '', readings: row.readings.map((r) => ({ couplingId: r.couplingId, wearLevel: r.wearLevel as 1, note: r.note, ...(r.conditionCode ? { conditionCode: r.conditionCode as 'NORMAL' } : {}), ...(photos(r.couplingId).length ? { attachments: photos(r.couplingId) } : {}) })) }
    const replacement = { ...base, reason: row.reason || '', sapWorkOrder: row.sapWorkOrder || '', notes: row.notes || '' }
    if (row.type === 'COUPLING_REPLACEMENT') return { ...replacement, type: 'COUPLING_REPLACEMENT', couplingId: row.couplingId!, wearAtRemoval: row.wearAtRemoval as 1 | null }
    const shaft = getLcoShaftById(row.shaftId!)!
    return { ...replacement, type: 'SHAFT_REPLACEMENT', cageNumber: shaft.cageNumber, shaftPosition: shaft.position }
  })
  const data: LcoCouplingModuleData = { events, cageAssetIds: Object.fromEntries(cages.filter((c) => c.assetId).map((c) => [c.id, c.assetId!])), inspectionFreshnessThresholds: { staleDays: config.staleDays, veryStaleDays: config.veryStaleDays }, inspectionAgeThresholds: { recentDays: config.recentDays, dueDays: config.dueDays, oldDays: config.oldDays }, migratedLegacyFingerprints: config.migratedLegacyFingerprints }
  return { data, revision: config.revision }
}

async function saveEvent(tx: Tx, event: LcoCouplingEvent, revision: number, action: string, actor: string) {
  const replacement = event.type !== 'INSPECTION' ? event : null
  const values = { type: event.type, date: event.date, createdAt: event.createdAt, updatedAt: event.updatedAt ?? null, inspector: event.inspector || '', observations: event.type === 'INSPECTION' ? event.observations : null, couplingId: event.type === 'COUPLING_REPLACEMENT' ? event.couplingId : null, shaftId: event.type === 'SHAFT_REPLACEMENT' ? createLcoShaftId(event.cageNumber, event.shaftPosition) : null, reason: replacement?.reason ?? null, sapWorkOrder: replacement?.sapWorkOrder ?? null, notes: replacement?.notes ?? null, wearAtRemoval: event.type === 'COUPLING_REPLACEMENT' ? event.wearAtRemoval : null }
  await tx.lcoEvent.upsert({ where: { id: event.id }, create: { id: event.id, ...values }, update: values })
  await tx.lcoPhoto.deleteMany({ where: { eventId: event.id } })
  await tx.lcoReading.deleteMany({ where: { eventId: event.id } })
  if (event.type === 'INSPECTION') for (const [ordinal, r] of event.readings.entries()) await tx.lcoReading.create({ data: { eventId: event.id, couplingId: r.couplingId, ordinal, wearLevel: r.wearLevel, note: r.note, conditionCode: r.conditionCode ?? null } })
  const groups = [{ scope: '', photos: event.attachments }, ...(event.type === 'INSPECTION' ? event.readings.map((r) => ({ scope: r.couplingId, photos: r.attachments || [] })) : [])]
  for (const group of groups) for (const [ordinal, photo] of group.photos.entries()) await tx.lcoPhoto.create({ data: { ...photo, eventId: event.id, scope: group.scope, couplingId: group.scope || null, ordinal } })
  await tx.lcoEventVersion.create({ data: { eventId: event.id, revision, action, actor, snapshot: json(event) } })
}

async function saveConfig(tx: Tx, data: Omit<LcoCouplingModuleData, 'events'>) {
  const config = lcoConfigSchema.parse(data)
  await tx.lcoConfig.update({ where: { id: 1 }, data: { ...config.inspectionFreshnessThresholds, ...config.inspectionAgeThresholds, migratedLegacyFingerprints: config.migratedLegacyFingerprints } })
  for (const cage of createDefaultLcoCouplingTopology().cages) await tx.lcoCage.update({ where: { id: cage.id }, data: { assetId: config.cageAssetIds[cage.id] || null } })
}

// Canonical domain comparison tolerates optional empty photo lists/inspector only.
function eventIdentity(event: LcoCouplingEvent) {
  return canonicalLco({ ...event, inspector: event.inspector || '', ...(event.type === 'INSPECTION' ? { readings: event.readings.map((r) => ({ ...r, attachments: r.attachments || [] })) } : {}) })
}

export function createLcoRouter(db: PrismaClient) {
  const router = Router()
  router.get('/state', async (_req, res) => res.json(await db.$transaction(readLco, { isolationLevel: 'RepeatableRead' })))
  router.get('/topology', (_req, res) => res.json(createDefaultLcoCouplingTopology()))
  router.get('/summary', async (req, res) => {
    const date = String(req.query.date || new Date().toISOString().slice(0, 10))
    if (!parseDateOnly(date)) throw new ApiError(422, 'Fecha de referencia inválida')
    const state = await db.$transaction(readLco, { isolationLevel: 'RepeatableRead' })
    res.json({ revision: state.revision, wear: getLcoCouplingSummary(state.data, date), age: getLcoInspectionAgeSummary(state.data, date) })
  })
  router.get('/events/:id/versions', async (req, res) => res.json(await db.lcoEventVersion.findMany({ where: { eventId: req.params.id }, orderBy: { revision: 'asc' } })))
  router.get('/imports/:hash', async (req, res) => {
    const receipt = await db.lcoImportReceipt.findUnique({ where: { hash: req.params.hash } })
    if (!receipt) throw new ApiError(404, 'Migración no registrada')
    res.json(receipt)
  })
  router.use(async (req, res) => {
    const header = req.header('If-Match')
    if (!header || !/^\d+$/.test(header)) throw new ApiError(428, 'Se requiere If-Match con la revisión leída del servidor')
    const actor = req.header('X-Actor-Id') || 'local-user'
    if (actor.length > 160) throw new ApiError(422, 'Usuario inválido')
    const result = await db.$transaction(async (tx) => {
      const locks = await tx.$queryRaw<{ revision: number }[]>`SELECT revision FROM "LcoConfig" WHERE id=1 FOR UPDATE`
      let imported: LcoCouplingModuleData | null = null
      let hash: string | undefined
      if (req.path === '/import' && req.method === 'POST') {
        imported = validateLcoData(req.body)
        hash = createHash('sha256').update(canonicalLco(imported)).digest('hex')
        const receipt = await tx.lcoImportReceipt.findUnique({ where: { hash } })
        if (receipt) return { ...await readLco(tx), receipt }
      }
      if (locks[0].revision !== Number(header)) throw new ApiError(409, 'Otro cliente modificó Acoplamientos. Actualizá los datos y revisá el borrador antes de reintentar.')
      const before = await readLco(tx)
      const revision = before.revision + 1
      let id: string | undefined
      if (imported) {
        // Never overwrite an existing or deleted event while importing legacy data.
        for (const event of imported.events) {
          const existing = await tx.lcoEvent.findUnique({ where: { id: event.id } })
          if (existing) {
            const visible = before.data.events.find((e) => e.id === event.id)
            if (!visible || eventIdentity(visible) !== eventIdentity(event)) throw new ApiError(409, `El evento ${event.id} ya existe con otra versión. No se importó ningún dato.`)
          } else await saveEvent(tx, event, revision, 'IMPORT', actor)
        }
        const { events: _events, ...config } = imported
        const { events: _beforeEvents, ...currentConfig } = before.data
        const compare = ({ migratedLegacyFingerprints: _f, ...rest }: typeof config) => canonicalLco(rest)
        if (before.revision > 0 && compare(config) !== compare(currentConfig)) throw new ApiError(409, 'La configuración central difiere del respaldo. Revisala antes de importar; no se sobrescribió.')
        await saveConfig(tx, { ...config, migratedLegacyFingerprints: [...new Set([...currentConfig.migratedLegacyFingerprints, ...config.migratedLegacyFingerprints])] })
        await tx.lcoImportReceipt.create({ data: { hash: hash!, eventCount: imported.events.length, revision } })
      } else if (req.path === '/config' && req.method === 'PUT') {
        await saveConfig(tx, req.body)
      } else if (req.path === '/events' && req.method === 'POST') {
        id = `LCO_${randomUUID()}`
        const event = validateLcoEvent({ ...req.body, id, createdAt: new Date().toISOString() })
        await saveEvent(tx, event, revision, 'CREATE', actor)
      } else if (/^\/events\/[^/]+$/.test(req.path) && ['PUT', 'DELETE'].includes(req.method)) {
        id = decodeURIComponent(req.path.split('/')[2])
        const event = before.data.events.find((e) => e.id === id)
        if (!event) throw new ApiError(404, 'Evento inexistente')
        if (req.method === 'PUT') {
          const updated = validateLcoEvent({ ...req.body, id, createdAt: event.createdAt, updatedAt: new Date().toISOString() })
          if (updated.type !== event.type) throw new ApiError(422, 'No se puede cambiar el tipo de evento')
          await saveEvent(tx, updated, revision, 'UPDATE', actor)
        } else {
          const couplingId = req.query.couplingId
          if (couplingId && (event.type !== 'INSPECTION' || !event.readings.some((r) => r.couplingId === couplingId))) throw new ApiError(422, 'Lectura inexistente')
          const remaining = event.type === 'INSPECTION' && couplingId ? event.readings.filter((r) => r.couplingId !== couplingId) : []
          if (event.type === 'INSPECTION' && remaining.length) await saveEvent(tx, { ...event, readings: remaining, updatedAt: new Date().toISOString() }, revision, 'DELETE_READING', actor)
          else {
            await tx.lcoEvent.update({ where: { id }, data: { deletedAt: new Date() } })
            await tx.lcoEventVersion.create({ data: { eventId: id, revision, action: 'DELETE', actor, snapshot: json(event) } })
          }
        }
      } else throw new ApiError(404, 'Operación LCO inexistente')
      await tx.lcoConfig.update({ where: { id: 1 }, data: { revision } })
      return { ...await readLco(tx), id, ...(hash ? { receipt: await tx.lcoImportReceipt.findUnique({ where: { hash } }) } : {}) }
    }, { maxWait: 15000, timeout: 60000 })
    res.json(result)
  })
  return router
}

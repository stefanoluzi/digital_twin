import { Router } from 'express'
import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { createHash, randomUUID } from 'node:crypto'
import { ApiError } from '../errors'
import { businessDayEnd, systemDay, dateInMonth, fiscalYear, fiscalMonths, monthPhase } from '../../src/repairs/calendar'
import { BLOCK_OWNERS, DEFAULT_BLOCK_CATEGORIES, type RepairEvent } from '../../src/repairs/types'
import { dashboardMetrics, historicalMetrics, monthSequence, stateAt, today, daysBetween, legacyQuantity } from '../../src/repairs/domain'

type Tx = Prisma.TransactionClient
const text = z.string().trim().min(1).max(500)
const note = z.string().trim().max(10000).default('')
const civil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Fecha inválida')
const actualDate = civil.refine((v) => v <= today(), 'Una fecha real no puede estar en el futuro')
const optionalDate = z.union([civil, z.literal(''), z.null()]).optional()
const date = (v: string) => new Date(`${v}T00:00:00Z`)
const optional = (v?: string | null) => v ? date(v) : null
const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v))
const includeRequest = { equipment: { include: { repairProfile: true } }, responsible: true, items: { orderBy: { ordinal: 'asc' as const }, include: { commitments: { orderBy: { sequence: 'asc' as const } }, blocks: { orderBy: { startedAt: 'asc' as const } }, delivery: true } } }
const requestSchema = z.object({ equipmentId: text, quantity: z.number().int().min(1).max(1000), targetMonth: civil.refine((v) => v.endsWith('-01'), 'El mes objetivo debe ser el primer día del mes'), requiredDate: optionalDate, criticality: z.enum(['NORMAL', 'HIGH', 'CRITICAL']), criticalReason: note, fixedDeadline: z.boolean(), criticalDueDate: optionalDate, responsibleId: z.union([text, z.literal(''), z.null()]).optional(), workshop: text, notes: note }).strict().refine((v) => v.criticality === 'NORMAL' || !!v.criticalReason, 'Indicá el motivo de criticidad')
const editSchema = z.object({ targetMonth: civil.refine((v) => v.endsWith('-01')), requiredDate: optionalDate, criticality: z.enum(['NORMAL', 'HIGH', 'CRITICAL']), criticalReason: note, fixedDeadline: z.boolean(), criticalDueDate: optionalDate, responsibleId: z.union([text, z.literal(''), z.null()]).optional(), workshop: text, notes: note, reason: text }).strict().refine((v) => v.criticality === 'NORMAL' || !!v.criticalReason, 'Indicá el motivo de criticidad')
const equipmentSchema = z.object({ equipmentId: z.string().optional(), idrep: text, name: text, area: text, sector: text, trade: text, active: z.boolean() }).strict()
const configSchema = z.object({ warningDays: z.number().int().min(1).max(365), workshops: z.array(text).min(1).max(100), blockCategories: z.array(z.object({ owner: z.enum(BLOCK_OWNERS), name: text }).strict()).min(1).max(200) }).strict()
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('PEND'), itemIds: z.array(text).min(1), date: actualDate, comment: note }).strict(),
  z.object({ action: z.literal('START'), itemIds: z.array(text).min(1), date: actualDate, comment: note }).strict(),
  z.object({ action: z.literal('SENT'), itemIds: z.array(text).min(1), date: actualDate, comment: note }).strict(),
  z.object({ action: z.literal('COMMIT'), itemIds: z.array(text).min(1), date: civil, comment: text }).strict(),
  z.object({ action: z.literal('DELIVER'), itemIds: z.array(text).min(1), date: actualDate, comment: note }).strict(),
  z.object({ action: z.literal('BLOCK'), itemIds: z.array(text).min(1), date: actualDate, owner: z.enum(BLOCK_OWNERS), category: text, description: text, comment: text }).strict(),
  z.object({ action: z.literal('RESOLVE'), itemIds: z.array(text).min(1), date: actualDate, comment: text }).strict(),
  z.object({ action: z.literal('CANCEL'), itemIds: z.array(text).min(1), date: actualDate, comment: text }).strict(),
  z.object({ action: z.literal('COMMENT'), comment: text }).strict(),
])

export async function initializeRepairs(db: PrismaClient) {
  await db.repairConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1, blockCategories: json(DEFAULT_BLOCK_CATEGORIES), workshops: ['Taller central'] } })
}
async function read(tx: Tx) {
  const config = await tx.repairConfig.findUniqueOrThrow({ where: { id: 1 } })
  const [equipment, areas, responsibles, users, requests] = await Promise.all([
    tx.equipment.findMany({ include: { repairProfile: true }, orderBy: { name: 'asc' } }), tx.area.findMany({ orderBy: { code: 'asc' } }), tx.responsible.findMany({ orderBy: { name: 'asc' } }), tx.appUser.findMany({ orderBy: { name: 'asc' } }), tx.repairRequest.findMany({ include: includeRequest, orderBy: { updatedAt: 'desc' } }),
  ])
  return { revision: config.revision, config, equipment, areas, responsibles, users, requests }
}
async function event(tx: Tx, requestId: string, action: string, actor: string, revision: number, detail: unknown) {
  await tx.repairRequest.update({ where: { id: requestId }, data: { updatedAt: new Date() } })
  const snapshot = await tx.repairRequest.findUniqueOrThrow({ where: { id: requestId }, include: includeRequest })
  await tx.repairEvent.create({ data: { requestId, action, actor, revision, detail: json(detail), snapshot: json(snapshot) } })
}
async function validateAssignment(tx: Tx, responsibleId?: string | null) {
  if (responsibleId && !await tx.responsible.findFirst({ where: { id: responsibleId, active: true } })) throw new ApiError(422, 'El GMB debe existir y estar activo')
}
export function createRepairsRouter(db: PrismaClient) {
  const router = Router()
  router.get('/state', async (_req, res) => res.json(await db.$transaction(read, { isolationLevel: 'RepeatableRead' })))
  router.get('/requests/:id/events', async (req, res) => res.json(await db.repairEvent.findMany({ where: { requestId: req.params.id }, orderBy: { id: 'asc' } })))
  router.get('/history', async (req, res) => {
    const exercise = req.query.exercise === undefined ? null : z.coerce.number().int().min(1900).max(9998).parse(req.query.exercise)
    const start = exercise !== null ? `${exercise}-07-01` : civil.parse(String(req.query.from || `${fiscalYear()}-07-01`))
    const requestedEnd = exercise !== null ? `${exercise + 1}-06-30` : civil.parse(String(req.query.until || today()))
    const end = requestedEnd > today() && exercise !== null ? today() : requestedEnd
    if (exercise === null && (start > end || end > today() || daysBetween(start, end) > 3660)) throw new ApiError(422, 'Elegí un período válido de hasta 10 años, sin fechas futuras')
    const events = JSON.parse(JSON.stringify(await db.repairEvent.findMany({ where: { recordedAt: { lte: new Date(businessDayEnd(end)) } }, orderBy: { id: 'asc' } }))) as RepairEvent[]
    const availableSince = events[0]?.recordedAt || null
    const current = stateAt(events, businessDayEnd(end))
    const count = (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(end.slice(5, 7)) - Number(start.slice(5, 7)) + 1
    const series = (exercise === null ? monthSequence(start, count) : fiscalMonths(exercise)).map((month) => {
      const phase = monthPhase(month)
      if (phase === 'future') return { month, phase, available: false, planned: current.filter((r) => r.targetMonth.startsWith(month)).reduce((n, r) => n + r.quantity, 0), planPercent: null }

      const next = monthSequence(month, 2)[1]
      const lastDay = new Date(Date.parse(`${next}-01`) - 86400000).toISOString().slice(0, 10)
      const cutoff = lastDay > end ? end : lastDay
      const known = stateAt(events, businessDayEnd(cutoff))
      if (!availableSince || cutoff < systemDay(new Date(availableSince))) return { month, phase, available: false }
      return { month, phase, available: true, ...dashboardMetrics(known, cutoff), ...historicalMetrics(known, `${month}-01` < start ? start : `${month}-01`, cutoff) }
    })
    res.json({ availableSince, from: start, until: end, summary: historicalMetrics(current, start, end), backlog: dashboardMetrics(current, end), series,
      workshops: [...new Set(current.map((r) => r.workshop))].map((workshop) => ({ workshop, ...historicalMetrics(current.filter((r) => r.workshop === workshop), start, end), ...dashboardMetrics(current.filter((r) => r.workshop === workshop), end) })) })
  })
  router.use(async (req, res) => {
    if (!['POST', 'PUT'].includes(req.method)) throw new ApiError(404, 'Operación inexistente')
    const match = req.header('If-Match')
    if (!match || !/^\d+$/.test(match)) throw new ApiError(428, 'Falta la revisión If-Match. Actualizá los datos.')
    const actor = text.parse(req.header('X-Actor-Id') || 'local-user')
    const result = await db.$transaction(async (tx) => {
      // Same lock ordering as catalog writes; never race with catalog removal/import.
      await tx.$queryRaw`SELECT version FROM "Revision" WHERE id=1 FOR UPDATE`
      const locks = await tx.$queryRaw<{ revision: number }[]>`SELECT revision FROM "RepairConfig" WHERE id=1 FOR UPDATE`
      if (locks[0]?.revision !== Number(match)) throw new ApiError(409, 'Otro usuario modificó Reparaciones. Actualizá y revisá tu edición antes de reintentar.')
      const config = await tx.repairConfig.findUniqueOrThrow({ where: { id: 1 } })
      const revision = config.revision + 1
      let id: string | undefined
      if (req.path === '/equipment' && req.method === 'POST') {
        const body = equipmentSchema.parse(req.body)
        if (!await tx.area.findUnique({ where: { id: body.area } })) throw new ApiError(422, 'Área inexistente; seleccionala del catálogo compartido')
        let equipmentId = body.equipmentId
        if (equipmentId) {
          const existing = await tx.equipment.findUnique({ where: { id: equipmentId } })
          if (!existing) throw new ApiError(422, 'Equipo inexistente')
          // Shared name/area are edited in their owning catalog, not silently overwritten here.
          if (existing.name !== body.name || existing.area !== body.area) throw new ApiError(422, 'Para vincular un equipo existente conservá su nombre y área actuales')
        } else equipmentId = (await tx.equipment.create({ data: { id: randomUUID(), area: body.area, name: body.name } })).id
        await tx.repairEquipmentProfile.upsert({ where: { equipmentId }, create: { equipmentId, idrep: body.idrep, sector: body.sector, trade: body.trade, active: body.active }, update: { idrep: body.idrep, sector: body.sector, trade: body.trade, active: body.active } })
        await tx.revision.update({ where: { id: 1 }, data: { version: { increment: 1 } } })
        await tx.auditLog.create({ data: { user: actor, entity: 'repairEquipment', entityId: equipmentId, action: 'UPSERT', field: 'profile', newValue: json(body) } })
        id = equipmentId
      } else if (req.path === '/config' && req.method === 'PUT') {
        const body = configSchema.parse(req.body)
        if (new Set(body.workshops).size !== body.workshops.length) throw new ApiError(422, 'Talleres duplicados')
        await tx.repairConfig.update({ where: { id: 1 }, data: { ...body, blockCategories: json(body.blockCategories) } })
        await tx.auditLog.create({ data: { user: actor, entity: 'repairConfig', entityId: '1', action: 'UPDATE', field: 'config', oldValue: json(config), newValue: json(body) } })
      } else if (req.path === '/import' && req.method === 'POST') {
        const rowSchema = z.object({ idrep: text, name: text, area: text, sector: text, trade: text, targetMonth: civil.refine((v) => v.endsWith('-01')), requiredDate: optionalDate, quantity: z.union([z.number(), z.string()]), workshop: text, notes: note }).strict()
        const body = z.object({ confirmed: z.literal(true), rows: z.array(rowSchema).min(1).max(1000) }).strict().parse(req.body)
        const hash = createHash('sha256').update(JSON.stringify(body.rows)).digest('hex')
        if (await tx.auditLog.findFirst({ where: { entity: 'repairImport', entityId: hash } })) throw new ApiError(409, 'Este lote ya fue importado. No se duplicaron necesidades.')
        let total = 0
        for (const row of body.rows) {
          if (!dateInMonth(row.requiredDate, row.targetMonth)) throw new ApiError(422, 'La fecha de necesidad debe pertenecer al mes objetivo')
          let quantity: number | null
          try { quantity = legacyQuantity(row.quantity) } catch (error) { throw new ApiError(422, (error as Error).message) }
          if (!quantity || (total += quantity) > 2000) throw new ApiError(422, 'El lote debe tener cantidades positivas y como máximo 2000 unidades')
          if (!config.workshops.includes(row.workshop) || !await tx.area.findUnique({ where: { id: row.area } })) throw new ApiError(422, `Área o taller sin confirmar para ${row.idrep}`)
          let profile = await tx.repairEquipmentProfile.findUnique({ where: { idrep: row.idrep }, include: { equipment: true } })
          if (profile && (!profile.active || profile.equipment.name !== row.name || profile.equipment.area !== row.area || profile.trade !== row.trade || profile.sector !== row.sector)) throw new ApiError(409, `El IDREP ${row.idrep} ya existe con otros datos. Revisá el lote.`)
          if (!profile) {
            const equipment = await tx.equipment.findFirst({ where: { name: row.name, area: row.area } })
            const equipmentId = equipment?.id || (await tx.equipment.create({ data: { id: randomUUID(), area: row.area, name: row.name } })).id
            profile = await tx.repairEquipmentProfile.create({ data: { equipmentId, idrep: row.idrep, trade: row.trade, sector: row.sector }, include: { equipment: true } })
          }
          const created = await tx.repairRequest.create({ data: { equipmentId: profile.equipmentId, quantity, targetMonth: date(row.targetMonth), requiredDate: optional(row.requiredDate), criticality: 'NORMAL', criticalReason: '', fixedDeadline: false, workshop: row.workshop, notes: row.notes, createdBy: actor, items: { create: Array.from({ length: quantity }, (_, i) => ({ ordinal: i + 1 })) } } })
          await event(tx, created.id, 'IMPORT', actor, revision, { source: 'Legacy revisado', ...row })
        }
        await tx.revision.update({ where: { id: 1 }, data: { version: { increment: 1 } } })
        await tx.auditLog.create({ data: { user: actor, entity: 'repairImport', entityId: hash, action: 'IMPORT', field: 'batch', newValue: { requests: body.rows.length, units: total } } })
      } else if (req.path === '/requests' && req.method === 'POST') {
        const body = requestSchema.parse(req.body)
        if (!dateInMonth(body.requiredDate, body.targetMonth)) throw new ApiError(422, 'La fecha de necesidad debe pertenecer al mes objetivo')
        if (!await tx.repairEquipmentProfile.findFirst({ where: { equipmentId: body.equipmentId, active: true } })) throw new ApiError(422, 'Elegí un equipo habilitado para taller')
        if (!config.workshops.includes(body.workshop)) throw new ApiError(422, 'Taller no configurado')
        await validateAssignment(tx, body.responsibleId)
        id = (await tx.repairRequest.create({ data: { ...body, targetMonth: date(body.targetMonth), requiredDate: optional(body.requiredDate), criticalDueDate: optional(body.criticalDueDate), responsibleId: body.responsibleId || null, createdBy: actor,
          items: { create: Array.from({ length: body.quantity }, (_, index) => ({ ordinal: index + 1 })) } } })).id
        await event(tx, id, 'CREATE', actor, revision, body)
      } else {
        const route = req.path.match(/^\/requests\/([^/]+)(\/actions)?$/)
        if (!route) throw new ApiError(404, 'Operación inexistente')
        id = route[1]
        const request = await tx.repairRequest.findUnique({ where: { id }, include: includeRequest })
        if (!request) throw new ApiError(404, 'Necesidad inexistente')
        if (!route[2] && req.method === 'PUT') {
          const body = editSchema.parse(req.body)
          if (!dateInMonth(body.requiredDate, body.targetMonth)) throw new ApiError(422, 'La fecha de necesidad debe pertenecer al mes objetivo')
          if (!config.workshops.includes(body.workshop)) throw new ApiError(422, 'Taller no configurado')
          await validateAssignment(tx, body.responsibleId)
          const { reason, ...values } = body
          await tx.repairRequest.update({ where: { id }, data: { ...values, targetMonth: date(values.targetMonth), requiredDate: optional(values.requiredDate), criticalDueDate: optional(values.criticalDueDate), responsibleId: values.responsibleId || null } })
          await event(tx, id, 'EDIT', actor, revision, { ...body, before: { targetMonth: request.targetMonth, requiredDate: request.requiredDate, criticality: request.criticality, criticalReason: request.criticalReason, workshop: request.workshop, responsibleId: request.responsibleId } })
        } else if (route[2] && req.method === 'POST') {
          const body = actionSchema.parse(req.body)
          if (body.action !== 'COMMENT') {
            if (new Set(body.itemIds).size !== body.itemIds.length || body.itemIds.some((itemId) => !request.items.some((item) => item.id === itemId))) throw new ApiError(422, 'Selección de unidades inválida')
            for (const item of request.items.filter((item) => body.itemIds.includes(item.id))) {
              if (['DELIVERED', 'CANCELLED'].includes(item.status)) throw new ApiError(422, `La unidad #${item.ordinal} ya está cerrada`)
              const at = date(body.date)
              const activeBlock = item.blocks.find((block) => !block.resolvedAt)
              if (body.action === 'START' || body.action === 'PEND') {
                const nextStatus = body.action === 'START' ? 'IN_PROGRESS' : 'PENDING'
                if (item.status === nextStatus) throw new ApiError(422, 'La unidad ya tiene ese estado')
                if (activeBlock) {
                  if (at < activeBlock.startedAt) throw new ApiError(422, 'La resolución no puede preceder al bloqueo')
                  if (body.action === 'START' && !body.comment.trim()) throw new ApiError(422, 'Indicá cómo se resolvió el bloqueo')
                  await tx.repairBlock.update({ where: { id: activeBlock.id }, data: { resolvedAt: at, durationDays: daysBetween(activeBlock.startedAt.toISOString(), body.date), resolvedBy: actor, comment: `${activeBlock.comment}\nResolución: ${body.comment || 'Vuelve a pendiente'}` } })
                }
                if (item.sentAt && at < item.sentAt) throw new ApiError(422, 'El inicio no puede ser anterior al envío')
                if (item.blocks.some((b) => b.resolvedAt && at < b.resolvedAt)) throw new ApiError(422, 'La fecha no puede preceder al último bloqueo resuelto')
                await tx.repairItem.update({ where: { id: item.id }, data: { status: nextStatus, startedAt: body.action === 'PEND' ? null : item.startedAt || at } })
              } else if (body.action === 'SENT') {
                if (item.sentAt) throw new ApiError(422, 'El envío ya está registrado')
                if (item.startedAt && at > item.startedAt) throw new ApiError(422, 'El envío no puede ser posterior al inicio')
                await tx.repairItem.update({ where: { id: item.id }, data: { sentAt: at } })
              } else if (body.action === 'COMMIT') {
                if (item.commitments.at(-1)?.date.getTime() === at.getTime()) throw new ApiError(422, 'La fecha comprometida no cambió')
                await tx.repairCommitment.create({ data: { itemId: item.id, date: at, reason: body.comment, actor, sequence: item.commitments.length + 1 } })
              } else if (body.action === 'BLOCK') {
                if (activeBlock) throw new ApiError(422, 'La unidad ya tiene un bloqueo abierto')
                if (item.startedAt && at < item.startedAt || item.blocks.some((block) => block.resolvedAt && at < block.resolvedAt)) throw new ApiError(422, 'El bloqueo no puede preceder al último avance registrado')
                const categories = config.blockCategories as { owner: string; name: string }[]
                if (!categories.some((category) => category.owner === body.owner && category.name === body.category)) throw new ApiError(422, 'Categoría de bloqueo no configurada para ese responsable')
                await tx.repairBlock.create({ data: { itemId: item.id, startedAt: at, owner: body.owner, category: body.category, description: body.description, comment: body.comment, actor, previousStatus: item.status } })
                await tx.repairItem.update({ where: { id: item.id }, data: { status: 'BLOCKED' } })
              } else if (body.action === 'RESOLVE') {
                if (!activeBlock || at < activeBlock.startedAt) throw new ApiError(422, 'No hay bloqueo abierto o la resolución precede al bloqueo')
                await tx.repairBlock.update({ where: { id: activeBlock.id }, data: { resolvedAt: at, durationDays: daysBetween(activeBlock.startedAt.toISOString(), body.date), resolvedBy: actor, comment: `${activeBlock.comment}\nResolución: ${body.comment}` } })
                await tx.repairItem.update({ where: { id: item.id }, data: { status: activeBlock.previousStatus } })
              } else if (body.action === 'DELIVER') {
                if (activeBlock) throw new ApiError(422, 'Resolvé primero el bloqueo para registrar la entrega')
                if (item.startedAt && at < item.startedAt || item.blocks.some((block) => block.resolvedAt && at < block.resolvedAt)) throw new ApiError(422, 'La entrega no puede ser anterior al trabajo registrado')
                await tx.repairDelivery.create({ data: { itemId: item.id, deliveredAt: at, actor, comment: body.comment } })
                await tx.repairItem.update({ where: { id: item.id }, data: { status: 'DELIVERED' } })
              } else if (body.action === 'CANCEL') {
                if (item.startedAt && at < item.startedAt || item.blocks.some((block) => block.resolvedAt && at < block.resolvedAt)) throw new ApiError(422, 'Cancelación anterior al trabajo registrado')
                if (activeBlock) {
                  if (at < activeBlock.startedAt) throw new ApiError(422, 'Cancelación anterior al bloqueo')
                  await tx.repairBlock.update({ where: { id: activeBlock.id }, data: { resolvedAt: at, durationDays: daysBetween(activeBlock.startedAt.toISOString(), body.date), resolvedBy: actor, comment: `${activeBlock.comment}\nCancelación: ${body.comment}` } })
                }
                await tx.repairItem.update({ where: { id: item.id }, data: { status: 'CANCELLED' } })
              }
            }
          }
          const after = await tx.repairItem.findMany({ where: { requestId: id } })
          const changes = request.items.flatMap((item) => {
            const next = after.find((i) => i.id === item.id)!
            return next.status === item.status ? [] : [{ ordinal: item.ordinal, before: item.status, after: next.status }]
          })
          await event(tx, id, body.action, actor, revision, { ...body, changes })
        } else throw new ApiError(404, 'Operación inexistente')
      }
      await tx.repairConfig.update({ where: { id: 1 }, data: { revision } })
      return { ...await read(tx), id }
    }, { timeout: 60000, maxWait: 15000 })
    res.status(req.method === 'POST' ? 201 : 200).json(result)
  })
  return router
}

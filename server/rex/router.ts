import { Router } from 'express'
import { Prisma, type PrismaClient } from '@prisma/client'
import { ApiError } from '../errors'
import { taskSchema, eventSchema, executionSchema, finalizeSchema, resolutionSchema, rexConfigSchema, text, date } from './validation'
import { calculateEstimate, estimateInputs, type EstimateConfig, type EstimateInputs } from '../../src/rex/estimation'
import { deriveStatus } from '../../src/rex/domain'
import { fiscalYear } from '../../src/repairs/calendar'

type Tx = Prisma.TransactionClient
const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v))
const taskInclude = { scope: { where: { active: true }, orderBy: { ordinal: 'asc' as const } }, documents: true, estimates: { orderBy: { id: 'desc' as const }, take: 1 } }
const executionInclude = { items: { orderBy: { ordinal: 'asc' as const } }, resolutions: true }
export async function initializeRex(db: PrismaClient) { await db.rexConfig.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }) }
async function read(tx: Tx) {
  const [config, tasks, events, executions, pending, areas, equipment, responsibles] = await Promise.all([
    tx.rexConfig.findUniqueOrThrow({ where: { id: 1 } }), tx.rexTask.findMany({ include: taskInclude, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
    tx.rexEvent.findMany({ orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }] }), tx.rexExecution.findMany({ include: executionInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    tx.rexPending.findMany({ include: { originItem: { include: { execution: true } }, resolutions: true }, orderBy: { createdAt: 'asc' } }),
    tx.area.findMany({ orderBy: { code: 'asc' } }), tx.equipment.findMany({ orderBy: { name: 'asc' } }), tx.responsible.findMany({ orderBy: { name: 'asc' } }),
  ])
  return { revision: config.revision, config, tasks, events, executions, areas, equipment, responsibles, pending: pending.map(({ originItem, ...p }) => ({ ...p, taskId: originItem.execution.taskId, executionId: originItem.executionId, component: originItem.description, unit: originItem.unit, remaining: p.quantity.minus(p.resolutions.reduce((n, r) => n.plus(r.quantity), new Prisma.Decimal(0))).toString() })) }
}
async function estimateAtCurrentConfig(tx: Tx, inputs: EstimateInputs) {
  const config = await tx.rexConfig.findUniqueOrThrow({ where: { id: 1 } })
  try { return calculateEstimate(inputs, JSON.parse(JSON.stringify(config)) as EstimateConfig) }
  catch (e) { throw new ApiError(422, (e as Error).message) }
}
async function audit(tx: Tx, actor: string, entity: string, id: string, before: unknown, after: unknown) {
  await tx.auditLog.create({ data: { user: actor, entity: `rex${entity}`, entityId: id, action: before ? 'UPDATE' : 'CREATE', field: 'snapshot', oldValue: before ? json(before) : Prisma.DbNull, newValue: json(after) } })
}
async function assignments(tx: Tx, eventId?: string | null, responsibleId?: string | null) {
  if (eventId && !await tx.rexEvent.findUnique({ where: { id: eventId } })) throw new ApiError(422, 'Evento inexistente')
  if (responsibleId && !await tx.responsible.findFirst({ where: { id: responsibleId, active: true } })) throw new ApiError(422, 'Elegí un responsable activo')
}
type Result = { id: string; completed: number; reason: string; notes: string }
type Item = { id: string; quantity: Prisma.Decimal; required: boolean }
function validateResults(items: Item[], results: Result[]) {
  if (results.length !== items.length || new Set(results.map((r) => r.id)).size !== items.length || results.some((r) => !items.some((i) => i.id === r.id))) throw new ApiError(422, 'El alcance cambió o está incompleto. Revisá cada actividad antes de guardar.')
  for (const item of items) {
    const r = results.find((r) => r.id === item.id)!
    if (item.quantity.lessThan(r.completed)) throw new ApiError(422, 'La cantidad realizada supera la prevista')
    if (item.required && item.quantity.greaterThan(r.completed) && !r.reason) throw new ApiError(422, 'Indicá el motivo de cada actividad obligatoria pendiente')
  }
}
async function finish(tx: Tx, executionId: string, results: Result[], performedAt: Date | null) {
  const items = await tx.rexExecutionItem.findMany({ where: { executionId }, orderBy: { ordinal: 'asc' } })
  validateResults(items, results)
  const status = deriveStatus(items.map((i) => ({ ...i, quantity: i.quantity.toString(), completed: results.find((r) => r.id === i.id)!.completed })))
  for (const item of items) {
    const r = results.find((r) => r.id === item.id)!
    const remaining = item.quantity.minus(r.completed)
    await tx.rexExecutionItem.update({ where: { id: item.id }, data: { completed: r.completed, status: remaining.isZero() ? 'COMPLETED' : r.completed ? 'PARTIAL' : 'NOT_PERFORMED', reason: r.reason, notes: r.notes } })
    if (remaining.greaterThan(0)) await tx.rexPending.create({ data: { originItemId: item.id, quantity: remaining, reason: r.reason || 'Alcance opcional no realizado', notes: r.notes, originDate: performedAt } })
  }
  await tx.rexExecution.update({ where: { id: executionId }, data: { status, performedAt } })
}
export function createRexRouter(db: PrismaClient) {
  const router = Router()
  router.get('/state', async (_req, res) => res.json(await db.$transaction(read, { isolationLevel: 'RepeatableRead' })))
  router.get('/tasks/:id/history', async (req, res) => {
    const page = Math.max(0, Math.min(100000, Number(req.query.page) || 0))
    res.json(await db.rexExecution.findMany({ where: { taskId: req.params.id }, include: executionInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: Math.floor(page) * 50, take: 50 }))
  })
  router.use(async (req, res) => {
    if (!['POST', 'PUT'].includes(req.method)) throw new ApiError(404, 'Operación REX inexistente')
    const match = req.header('If-Match')
    if (!match || !/^\d+$/.test(match)) throw new ApiError(428, 'Falta la revisión If-Match. Volvé a abrir el módulo.')
    const actor = text.parse(req.header('X-Actor-Id') || 'local-user')
    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT version FROM "Revision" WHERE id=1 FOR UPDATE`
      const locks = await tx.$queryRaw<{ revision: number }[]>`SELECT revision FROM "RexConfig" WHERE id=1 FOR UPDATE`
      if (locks[0]?.revision !== Number(match)) throw new ApiError(409, 'Otra persona modificó Tareas REX. Volvé a abrir el módulo y revisá los datos antes de reintentar.')
      let id = ''
      const taskRoute = req.path.match(/^\/tasks(?:\/([^/]+))?$/)
      const eventRoute = req.path.match(/^\/events(?:\/([^/]+))?$/)
      const finalRoute = req.path.match(/^\/executions\/([^/]+)\/finalize$/)
      const resolutionRoute = req.path.match(/^\/pending\/([^/]+)\/resolutions$/)
      if (req.path === '/config' && req.method === 'PUT') {
        const body = rexConfigSchema.parse(req.body)
        const before = await tx.rexConfig.findUniqueOrThrow({ where: { id: 1 } })
        const after = await tx.rexConfig.update({ where: { id: 1 }, data: body })
        id = '1'; await audit(tx, actor, 'Config', id, before, after)
      } else if (taskRoute && ((req.method === 'POST' && !taskRoute[1]) || (req.method === 'PUT' && taskRoute[1]))) {
        const { scope, documents, estimate, ...body } = taskSchema.parse(req.body)
        const before = taskRoute[1] ? await tx.rexTask.findUnique({ where: { id: taskRoute[1] }, include: taskInclude }) : null
        if (taskRoute[1] && !before) throw new ApiError(404, 'Tarea inexistente')
        if (!await tx.area.findUnique({ where: { id: body.areaId } })) throw new ApiError(422, 'Elegí un área del catálogo compartido')
        if (body.equipmentId && !await tx.equipment.findFirst({ where: { id: body.equipmentId, area: body.areaId } })) throw new ApiError(422, 'El equipo no pertenece al área elegida')
        if (scope.some((i) => i.id && !before?.scope.some((s) => s.id === i.id))) throw new ApiError(422, 'Actividad de alcance ajena a esta tarea')
        const data = { ...body, equipmentId: body.equipmentId || null, intervalMonths: body.frequencyType === 'PERIODIC' ? body.intervalMonths : null, updatedBy: actor, resources: json(before ? before.resources : body.resources) }
        const task = before ? await tx.rexTask.update({ where: { id: before.id }, data }) : await tx.rexTask.create({ data: { ...data, createdBy: actor } })
        id = task.id
        if (estimate) await tx.rexEstimate.create({ data: { ...await estimateAtCurrentConfig(tx, estimate), taskId: id, createdBy: actor } })
        await tx.rexTaskScopeItem.updateMany({ where: { taskId: id }, data: { active: false } })
        for (const [ordinal, s] of scope.entries()) {
          const { id: scopeId, ...values } = s
          if (scopeId) await tx.rexTaskScopeItem.update({ where: { id: scopeId }, data: { ...values, ordinal, active: true } })
          else await tx.rexTaskScopeItem.create({ data: { ...values, taskId: id, ordinal } })
        }
        await tx.rexTaskDocument.deleteMany({ where: { taskId: id } })
        if (documents.length) await tx.rexTaskDocument.createMany({ data: documents.map((d) => ({ ...d, taskId: id })) })
        await audit(tx, actor, 'Task', id, before, await tx.rexTask.findUnique({ where: { id }, include: taskInclude }))
      } else if (eventRoute && ((req.method === 'POST' && !eventRoute[1]) || (req.method === 'PUT' && eventRoute[1]))) {
        const body = eventSchema.parse(req.body)
        const before = eventRoute[1] ? await tx.rexEvent.findUnique({ where: { id: eventRoute[1] } }) : null
        if (eventRoute[1] && !before) throw new ApiError(404, 'Evento inexistente')
        const exercise = body.exercise ?? (body.startDate ? fiscalYear(body.startDate) : null)
        if (body.startDate && exercise !== fiscalYear(body.startDate)) throw new ApiError(422, 'El ejercicio debe coincidir con la fecha de inicio (julio–junio)')
        const data = { ...body, startDate: date(body.startDate), endDate: date(body.endDate), exercise, updatedBy: actor }
        const event = before ? await tx.rexEvent.update({ where: { id: before.id }, data }) : await tx.rexEvent.create({ data: { ...data, createdBy: actor } })
        id = event.id; await audit(tx, actor, 'Event', id, before, event)
      } else if (req.path === '/executions' && req.method === 'POST') {
        const body = executionSchema.parse(req.body)
        const task = await tx.rexTask.findUnique({ where: { id: body.taskId }, include: { ...taskInclude, area: true } })
        if (!task || !task.active) throw new ApiError(422, 'Elegí una tarea activa')
        await assignments(tx, body.eventId, body.responsibleId)
        const scope = task.scope.length ? task.scope : [{ id: 'single', description: task.name, quantity: new Prisma.Decimal(1), unit: 'actividad', required: true, ordinal: 0 }]
        if (body.mode === 'RESULT') validateResults(scope, body.items)
        else if (body.items.some((i) => i.completed !== 0)) throw new ApiError(422, 'Una planificación no registra cantidades realizadas')
        const estimate = task.estimates[0] ? await estimateAtCurrentConfig(tx, estimateInputs(JSON.parse(JSON.stringify(task.estimates[0])))) : null
        const execution = await tx.rexExecution.create({ data: { taskId: task.id, eventId: body.eventId || null, intent: 'FULL_TASK', status: 'PLANNED', performedAt: body.mode === 'RESULT' ? date(body.performedAt) : null, startedAt: date(body.startedAt), ot: body.ot, notes: body.notes, responsibleId: body.responsibleId || null, taskSnapshot: json({ ...task, estimates: undefined, estimate, areaCode: task.area.code }), createdBy: actor, updatedBy: actor,
          items: { create: scope.map((s) => ({ scopeItemId: s.id === 'single' ? null : s.id, description: s.description, ordinal: s.ordinal, required: s.required, quantity: s.quantity, completed: 0, unit: s.unit, status: 'PLANNED' })) } }, include: executionInclude })
        id = execution.id
        if (body.mode === 'RESULT') await finish(tx, id, execution.items.map((i, index) => ({ ...body.items.find((r) => r.id === scope[index].id)!, id: i.id })), date(body.performedAt))
        await audit(tx, actor, 'Execution', id, null, await tx.rexExecution.findUnique({ where: { id }, include: executionInclude }))
      } else if (finalRoute && req.method === 'POST') {
        const body = finalizeSchema.parse(req.body)
        const before = await tx.rexExecution.findUnique({ where: { id: finalRoute[1] }, include: executionInclude })
        if (!before) throw new ApiError(404, 'Intervención inexistente')
        if (before.status !== 'PLANNED') throw new ApiError(422, 'La intervención ya tiene un resultado confirmado; su historial no se sobrescribe')
        await assignments(tx, body.eventId, body.responsibleId)
        id = before.id
        await tx.rexExecution.update({ where: { id }, data: { eventId: body.eventId || null, startedAt: date(body.startedAt), ot: body.ot, notes: body.notes, responsibleId: body.responsibleId || null, updatedBy: actor } })
        await finish(tx, id, body.items, date(body.performedAt))
        await audit(tx, actor, 'Execution', id, before, await tx.rexExecution.findUnique({ where: { id }, include: executionInclude }))
      } else if (resolutionRoute && req.method === 'POST') {
        const body = resolutionSchema.parse(req.body)
        const pending = await tx.rexPending.findUnique({ where: { id: resolutionRoute[1] }, include: { resolutions: true, originItem: { include: { execution: true } } } })
        if (!pending) throw new ApiError(404, 'Pendiente inexistente')
        const remaining = pending.quantity.minus(pending.resolutions.reduce((n, r) => n.plus(r.quantity), new Prisma.Decimal(0)))
        if (remaining.lessThan(body.quantity)) throw new ApiError(422, 'La cantidad supera el saldo pendiente o el pendiente ya está resuelto')
        if (pending.originDate && date(body.performedAt)! < pending.originDate) throw new ApiError(422, 'La resolución no puede ser anterior al trabajo origen')
        await assignments(tx, body.eventId)
        const origin = pending.originItem
        const execution = await tx.rexExecution.create({ data: { taskId: origin.execution.taskId, eventId: body.eventId || null, intent: 'PENDING_RESOLUTION', status: 'COMPLETED', performedAt: date(body.performedAt), ot: body.ot, notes: body.notes, taskSnapshot: json(origin.execution.taskSnapshot), createdBy: actor, updatedBy: actor,
          items: { create: { description: origin.description, ordinal: 0, required: true, quantity: body.quantity, completed: body.quantity, unit: origin.unit, status: 'COMPLETED' } } }, include: executionInclude })
        id = execution.id
        await tx.rexPendingResolution.create({ data: { pendingId: pending.id, executionId: id, itemId: execution.items[0].id, quantity: body.quantity, performedAt: date(body.performedAt), createdBy: actor } })
        await audit(tx, actor, 'Resolution', id, null, { pendingId: pending.id, execution, quantity: body.quantity })
      } else throw new ApiError(404, 'Operación REX inexistente')
      await tx.rexConfig.update({ where: { id: 1 }, data: { revision: { increment: 1 } } })
      return { ...await read(tx), id }
    }, { timeout: 30000 })
    res.status(req.method === 'POST' ? 201 : 200).json(result)
  })
  return router
}

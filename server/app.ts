import express, { type ErrorRequestHandler } from 'express'
import { Prisma, type PrismaClient } from '@prisma/client'
import { ZodError } from 'zod'
import { createStore } from 'zustand/vanilla'
import { resolve } from 'node:path'
import { criticalSparesState } from '../src/spares/store/criticalSparesStore'
import { configSchema, parseBackup, spareDraftSchema, unitDraftSchema, validateSparesData, SparesValidationError } from '../src/spares/domain/sparesValidation'
import type { CriticalSparesConfig, CriticalSparesData } from '../src/spares/types'
import type { SpareDraft, UnitDraft } from '../src/spares/store/criticalSparesStore'
import { readState, mutateState } from './sparesDatabase'
import { ApiError } from './errors'
import { createLcoRouter } from './lco/router'
import { coverageHistoryRouter } from './coverageHistory'
import { createRepairsRouter } from './repairs/router'

export function createApp(db: PrismaClient, staticDirectory?: string) {
  const app = express()
  app.disable('x-powered-by')
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    res.set('X-Content-Type-Options', 'nosniff')
    // No CORS: only this origin may mutate. Local Vite uses its server proxy.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return next(new ApiError(403, 'Origen no permitido'))
    next()
  })
  app.use(express.json({ limit: '100mb' }))
  app.use('/api/controles-criticos/acoplamientos', createLcoRouter(db))
  app.use('/api/coverage-history', coverageHistoryRouter(db))
  app.use('/api/repairs', createRepairsRouter(db))
  app.get('/api/health', async (_req, res) => { await db.$queryRaw`SELECT 1`; res.json({ status: 'ok', database: 'postgresql' }) })
  app.get('/api/state', async (_req, res) => res.json(await readState(db)))
  app.get('/api/backup', async (_req, res) => {
    const state = await readState(db)
    res.json({ format: 'LACO1_CRITICAL_SPARES', version: 2, exportedAt: new Date().toISOString(), data: state.data })
  })
  for (const collection of ['spares', 'units', 'areas', 'responsibles', 'equipment'] as const) {
    app.get(`/api/${collection}`, async (_req, res) => {
      const { data, revision } = await readState(db)
      res.json({ revision, items: collection === 'spares' ? data.spareTypes : collection === 'units' ? data.units : data.config[collection] })
    })
  }
  app.get('/api/spares/:id', async (req, res) => {
    const { data, revision } = await readState(db); const item = data.spareTypes.find((spare) => spare.id === req.params.id)
    if (!item) throw new ApiError(404, 'Repuesto inexistente')
    res.json({ revision, item })
  })
  app.get('/api/audit', async (req, res) => {
    const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
    const items = await db.auditLog.findMany({ where: { entityId }, take: 100, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) })
    res.json({ items, nextCursor: items.length === 100 ? items.at(-1)?.id : null })
  })
  app.use('/api', async (req, res, next) => {
    if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return next()
    const header = req.header('If-Match')
    if (!header || !/^\d+$/.test(header)) throw new ApiError(428, 'Se requiere If-Match con la revisión leída del servidor')
    const actor = req.header('X-Actor-Id') || 'local-user'
    if (actor.length > 160) throw new ApiError(400, 'Identificador de usuario demasiado largo')
    const importing = req.path === '/import' && req.method === 'POST'
    const imported = importing ? parseBackup(req.body) : null
    const result = await mutateState(db, Number(header), actor, (data) => {
      if (imported) return { data: imported }
      data.config.currentUserId = data.config.users.some((user) => user.id === actor) ? actor : data.config.currentUserId
      const segments = req.path.split('/').filter(Boolean)
      const [collection, id] = segments.map(decodeURIComponent)
      const exists = (rows: { id: string }[]) => { if (!rows.some((item) => item.id === id)) throw new ApiError(404, 'Registro inexistente') }
      let createdId: string | undefined
      // Read back from the isolated store after each synchronous domain operation.
      const local = createStore(criticalSparesState(data))
      const actions = local.getState()
      if (collection === 'spares' && segments.length <= 2) {
        if (req.method === 'POST' && !id) createdId = actions.addSpare(spareDraftSchema.parse(req.body) as SpareDraft)
        else if (req.method === 'PUT' && id) { exists(data.spareTypes); actions.updateSpare(id, spareDraftSchema.parse(req.body) as SpareDraft) }
        else if (req.method === 'DELETE' && id) { exists(data.spareTypes); actions.deleteSpare(id) }
        else throw new ApiError(404, 'Operación no disponible')
      } else if (collection === 'units' && segments.length <= 2) {
        if (req.method === 'POST' && !id) {
          const body = unitDraftSchema.extend({ spareTypeId: spareDraftSchema.shape.categoryId }).parse(req.body)
          const { spareTypeId, ...draft } = body
          if (!data.spareTypes.some((spare) => spare.id === spareTypeId)) throw new ApiError(422, 'Repuesto inexistente')
          createdId = actions.addUnit(spareTypeId, draft as UnitDraft)
        } else if (req.method === 'PUT' && id) { exists(data.units); actions.updateUnit(id, unitDraftSchema.parse(req.body) as UnitDraft) }
        else if (req.method === 'DELETE' && id) { exists(data.units); actions.deleteUnit(id) }
        else throw new ApiError(404, 'Operación no disponible')
      } else if (collection === 'config' && segments.length === 1 && req.method === 'PUT') {
        const config = configSchema.parse(req.body) as CriticalSparesConfig
        if (data.config.responsibles.some((person) => person.active && !config.responsibles.some((next) => next.id === person.id))) throw new ApiError(422, 'Inactivá el GMB antes de eliminarlo, y reasigná sus áreas.')
        actions.updateConfig(config)
      } else throw new ApiError(404, 'Operación no disponible')
      const updated = local.getState()
      const snapshot: CriticalSparesData = { schemaVersion: 2, spareTypes: updated.spareTypes, units: updated.units, history: updated.history, config: updated.config }
      return { data: validateSparesData(snapshot), id: createdId }
    }, importing)
    res.status(req.method === 'POST' && !importing ? 201 : 200).json(result)
  })
  app.use('/api', (_req, _res, next) => next(new ApiError(404, 'Endpoint inexistente')))
  if (staticDirectory) {
    app.use(express.static(resolve(staticDirectory), { index: 'index.html' }))
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(staticDirectory, 'index.html')))
  }
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ApiError) { res.status(error.status).json({ error: error.message, details: error.details }); return }
    if (error instanceof SparesValidationError || error instanceof ZodError) { res.status(422).json({ error: error instanceof SparesValidationError ? error.message : 'Datos inválidos', details: error.issues }); return }
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2003', 'P2025'].includes(error.code)) { res.status(409).json({ error: 'Conflicto de integridad: ID duplicado o registro referenciado. No se guardó ningún cambio.' }); return }
    if (error?.type === 'entity.too.large') { res.status(413).json({ error: 'El respaldo supera el límite de 100 MB.' }); return }
    if (error instanceof SyntaxError) { res.status(400).json({ error: 'JSON inválido' }); return }
    // Do not leak queries, connection strings or attachments in responses/logs.
    console.error('API failure', error instanceof Error ? error.name : 'unknown')
    res.status(503).json({ error: 'No se pudo completar la operación en PostgreSQL. Ningún cambio fue confirmado; revisá la conexión y reintentá.' })
  }
  app.use(errors)
  return app
}

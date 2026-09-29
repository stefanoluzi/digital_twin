import { z } from 'zod'
import { reasons } from '../../src/rex/types'
import { systemDay } from '../../src/repairs/calendar'
import { decimalInput } from '../../src/rex/estimation'

export const text = z.string().trim().min(1).max(500)
const note = z.string().trim().max(10000).default('')
export const quantity = z.number().finite().min(0).max(9999999).refine((n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 0.00001, 'Usá como máximo tres decimales')
const positive = quantity.refine((n) => n > 0, 'La cantidad debe ser positiva')
const civil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Fecha inválida')
const nullableDate = z.union([civil, z.literal(''), z.null()]).optional()
const actualDate = z.union([civil.refine((v) => v <= systemDay(), 'Una fecha real no puede estar en el futuro'), z.literal(''), z.null()]).optional()
const nullableId = z.union([text, z.literal(''), z.null()]).optional()
const scopeSchema = z.object({ id: text.optional(), description: text, quantity: positive, unit: text, required: z.boolean(), notes: note }).strict()
const decimal = (places: number, max: string, positive = false) => z.string().max(40).transform((value, ctx) => {
  try { return decimalInput(value, places, max, positive) }
  catch (e) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: (e as Error).message }); return z.NEVER }
})
export const estimateSchema = z.object({ durationDays: decimal(3, '9999999', true), mechanical: decimal(0, '9999999'), electrical: decimal(0, '9999999'), mro: decimal(2, '999999999999'), services: decimal(2, '999999999999'), ownLabor: decimal(2, '999999999999') }).strict()
export const rexConfigSchema = z.object({ hoursPerDay: decimal(3, '24', true), hourlyRate: decimal(4, '999999999'), currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Usá un código de moneda como USD o ARS') }).strict()
export const taskSchema = z.object({ code: note, line: text.default('LC1C'), areaId: text, equipmentId: nullableId, name: text, description: note, specialty: z.enum(['MEC', 'ELE', 'LUB', 'MEC/ELE']), impact: note, criticality: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']), active: z.boolean().default(true), frequencyType: z.enum(['PERIODIC', 'CONDITION_BASED', 'COUNTER_BASED', 'NO_FIXED_FREQUENCY']), intervalMonths: z.number().int().min(1).max(1200).nullable().optional(), frequencyCriteria: note, referenceOt: note, technicalPlan: note, controlData: note, justification: note, interventionTime: note, estimate: estimateSchema.optional(), resources: z.record(z.string().max(500)).default({}), scope: z.array(scopeSchema).max(200), documents: z.array(z.object({ name: text, path: text.refine((v) => !/^\s*(javascript|data|vbscript):/i.test(v), 'Referencia no permitida'), type: note, notes: note }).strict()).max(100).default([]) }).strict().superRefine((v, ctx) => {
  if (v.frequencyType === 'PERIODIC' && !v.intervalMonths) ctx.addIssue({ code: 'custom', path: ['intervalMonths'], message: 'Indicá el intervalo periódico en meses' })
  const ids = v.scope.flatMap((i) => i.id ? [i.id] : [])
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['scope'], message: 'Hay actividades duplicadas' })
})
export const eventSchema = z.object({ name: text, type: z.enum(['REX', 'BO', 'SCHEDULED', 'EXTRAORDINARY', 'OTHER']), startDate: nullableDate, endDate: nullableDate, exercise: z.number().int().min(1900).max(9998).nullable().optional(), status: z.enum(['PLANNED', 'OPEN', 'CLOSED', 'CANCELLED']), notes: note }).strict().refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, 'El fin no puede preceder al inicio')
export const resultItemSchema = z.object({ id: text, completed: quantity, reason: z.enum(['', ...reasons]).default(''), notes: note }).strict()
const executionFields = { eventId: nullableId, performedAt: actualDate, startedAt: actualDate, ot: note, notes: note, responsibleId: nullableId }
export const executionSchema = z.object({ ...executionFields, taskId: text, mode: z.enum(['PLAN', 'RESULT']), items: z.array(resultItemSchema).max(200) }).strict().refine((v) => !v.startedAt || !v.performedAt || v.performedAt >= v.startedAt, 'El fin no puede preceder al inicio')
export const finalizeSchema = z.object({ ...executionFields, items: z.array(resultItemSchema).min(1).max(200) }).strict().refine((v) => !v.startedAt || !v.performedAt || v.performedAt >= v.startedAt, 'El fin no puede preceder al inicio')
export const resolutionSchema = z.object({ eventId: nullableId, performedAt: civil.refine((v) => v <= systemDay(), 'La resolución no puede estar en el futuro'), quantity: positive, ot: note, notes: text }).strict()
export const date = (v?: string | null) => v ? new Date(`${v}T00:00:00Z`) : null

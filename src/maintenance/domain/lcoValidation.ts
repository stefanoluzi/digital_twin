import { z } from 'zod'
import { COUPLING_CONDITION_CODES, isLcoCouplingId, type LcoCouplingEvent, type LcoCouplingModuleData } from './lcoCouplings'

const id = z.string().min(1).max(200)
const text = z.string().max(20000)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s, 'Fecha inválida')
const timestamp = z.string().datetime({ offset: true })
const couplingId = id.refine(isLcoCouplingId, 'Posición de acoplamiento inexistente')
const wear = z.number().int().min(1).max(5)
const photo = z.object({ id, fileName: id, mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']), dataUrl: z.string().max(20_000_000), createdAt: timestamp, caption: text }).strict().refine((p) => p.dataUrl.startsWith(`data:${p.mimeType};base64,`) && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(p.dataUrl), 'Foto inválida')
const base = { id, date, createdAt: timestamp, updatedAt: timestamp.optional(), attachments: z.array(photo).max(100) }
const reading = z.object({ couplingId, wearLevel: wear, note: text, conditionCode: z.enum(COUPLING_CONDITION_CODES as [string, ...string[]]).optional(), attachments: z.array(photo).max(100).optional() }).strict()
export const lcoEventSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('INSPECTION'), inspector: text, observations: text, readings: z.array(reading).min(1).max(32).refine((r) => new Set(r.map((x) => x.couplingId)).size === r.length, 'Lecturas duplicadas') }).strict(),
  z.object({ ...base, type: z.literal('COUPLING_REPLACEMENT'), couplingId, inspector: text.optional(), reason: text, sapWorkOrder: text, notes: text, wearAtRemoval: wear.nullable() }).strict(),
  z.object({ ...base, type: z.literal('SHAFT_REPLACEMENT'), cageNumber: z.number().int().min(1).max(8), shaftPosition: z.enum(['UPPER', 'LOWER']), inspector: text.optional(), reason: text, sapWorkOrder: text, notes: text }).strict(),
])
const days = z.number().int().positive().max(36500)
export const lcoConfigSchema = z.object({
  cageAssetIds: z.record(z.string().regex(/^J[1-8]$/), id),
  inspectionFreshnessThresholds: z.object({ staleDays: days, veryStaleDays: days }).strict().refine((v) => v.veryStaleDays >= v.staleDays, 'Umbrales de frescura inválidos'),
  inspectionAgeThresholds: z.object({ recentDays: days, dueDays: days, oldDays: days }).strict().refine((v) => v.recentDays < v.dueDays && v.dueDays < v.oldDays, 'Umbrales deben ser crecientes'),
  migratedLegacyFingerprints: z.array(z.string().max(1_000_000)),
}).strict()
const dataSchema = lcoConfigSchema.extend({ events: z.array(lcoEventSchema).refine((events) => new Set(events.map((e) => e.id)).size === events.length, 'IDs de eventos duplicados') })
export const validateLcoEvent = (input: unknown) => lcoEventSchema.parse(input) as LcoCouplingEvent
export const validateLcoData = (input: unknown) => dataSchema.parse(input) as LcoCouplingModuleData

// Stable content identity, independent of key order and optional empty fields.
export function canonicalLco(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalLco).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalLco(v)}`).join(',')}}`
  return JSON.stringify(value)
}

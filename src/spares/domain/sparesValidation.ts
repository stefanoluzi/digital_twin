import { z } from 'zod'
import { OPERATIONAL_PLANT_AREAS } from '../../config/areas'
import { normalizeCriticalSparesData } from '../data/sparesNormalizer'
import type { CriticalSparesData } from '../types'

const id = z.string().min(1).max(160)
const text = z.string().max(20000)
const name = z.string().trim().min(1).max(500)
const date = z.string().refine((value) => /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value.slice(0, 10), 'Fecha inválida')
const optionalDate = z.union([date, z.literal('')]).optional()
const image = z.string().max(20_000_000).regex(/^data:image\/(png|jpeg|jpg|webp|gif|bmp);base64,[a-zA-Z0-9+/=\r\n]+$/, 'Imagen inválida').optional()
const areaCode = z.enum(OPERATIONAL_PLANT_AREAS.map((area) => area.code) as [string, ...string[]])
export const statusSchema = z.enum(['WAREHOUSE', 'MACHINE_SIDE', 'INSTALLED', 'IN_REPAIR', 'ON_ORDER'])
export const spareDraftSchema = z.object({
  sapNumber: z.string().max(160), name, description: text, categoryId: id, area: areaCode,
  compatibleEquipmentIds: z.array(id), drawingNumber: text,
  drawingPdf: z.string().max(40_000_000).regex(/^data:application\/pdf;base64,[a-zA-Z0-9+/=\r\n]+$/, 'PDF inválido').optional(),
  drawingPdfName: text.optional(), referencePhoto: image, comments: text,
}).strict()
export const unitDraftSchema = z.object({
  status: statusSchema, statusSince: date, comment: text, location: text,
  installedEquipmentId: z.union([id, z.literal('')]).optional(), installationDate: optionalDate,
  sapNotice: text.optional(), repairStartDate: optionalDate, solp: text.optional(),
  purchaseOrder: text.optional(), eta: optionalDate, photo: image,
}).strict()
export const areaSchema = z.object({ id: areaCode, code: areaCode, name, responsibleGmbId: id.optional(), migrationCandidateIds: z.array(id).optional() }).strict()
export const responsibleSchema = z.object({ id, name, active: z.boolean() }).strict()
export const equipmentSchema = z.object({ id, area: areaCode, name }).strict()
export const configSchema = z.object({
  areas: z.array(areaSchema), categories: z.array(z.object({ id, name }).strict()),
  equipment: z.array(equipmentSchema), responsibles: z.array(responsibleSchema),
  users: z.array(z.object({ id, name, role: z.enum(['ADMIN', 'SUPERVISOR']) }).strict()).min(1), currentUserId: id,
}).strict()
const unitSchema = unitDraftSchema.extend({ id, spareTypeId: id })
const historySchema = z.object({
  id, unitId: id, spareTypeId: id, timestamp: date, user: name,
  previousStatus: statusSchema.optional(), nextStatus: statusSchema,
  equipmentId: z.string().optional(), comment: text, snapshot: unitSchema.partial(),
}).strict()
const dataSchema = z.object({
  schemaVersion: z.literal(2), config: configSchema,
  spareTypes: z.array(spareDraftSchema.extend({ id, createdAt: date, updatedAt: date, uncoveredAt: date.nullable().optional() })),
  units: z.array(unitSchema), history: z.array(historySchema),
}).strict()

export class SparesValidationError extends Error {
  constructor(public issues: string[]) { super(issues.slice(0, 20).join('\n')) }
}

export function validateSparesData(input: unknown): CriticalSparesData {
  const parsed = dataSchema.safeParse(input)
  if (!parsed.success) throw new SparesValidationError(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`))
  const data = parsed.data as CriticalSparesData
  const issues: string[] = []
  const unique = (rows: { id: string }[], label: string) => {
    const seen = new Set<string>()
    for (const row of rows) { if (seen.has(row.id)) issues.push(`${label}: ID duplicado ${row.id}`); seen.add(row.id) }
    return seen
  }
  const areas = unique(data.config.areas, 'Áreas')
  const categories = unique(data.config.categories, 'Categorías')
  const equipment = unique(data.config.equipment, 'Equipos')
  const people = unique(data.config.responsibles, 'GMB')
  const users = unique(data.config.users, 'Usuarios')
  const spares = unique(data.spareTypes, 'Repuestos')
  unique(data.units, 'Unidades'); unique(data.history, 'Historial')
  if (!users.has(data.config.currentUserId)) issues.push('Usuario actual inexistente')
  for (const area of data.config.areas) {
    if (area.code !== area.id) issues.push(`Área ${area.id}: código inconsistente`)
    if (area.responsibleGmbId && !people.has(area.responsibleGmbId)) issues.push(`Área ${area.id}: GMB inexistente`)
    if (area.responsibleGmbId && !data.config.responsibles.find((person) => person.id === area.responsibleGmbId)?.active) issues.push(`Área ${area.id}: GMB inactivo`)
    if (area.migrationCandidateIds?.length) issues.push(`Área ${area.id}: resolver responsables ambiguos antes de importar`)
  }
  for (const eq of data.config.equipment) if (!areas.has(eq.area)) issues.push(`Equipo ${eq.id}: área inexistente`)
  for (const spare of data.spareTypes) {
    if (!areas.has(spare.area)) issues.push(`Repuesto ${spare.id}: área inexistente`)
    if (!data.config.areas.find((area) => area.id === spare.area)?.responsibleGmbId) issues.push(`Repuesto ${spare.id}: el área requiere GMB activo`)
    if (!categories.has(spare.categoryId)) issues.push(`Repuesto ${spare.id}: categoría inexistente`)
    if (new Set(spare.compatibleEquipmentIds).size !== spare.compatibleEquipmentIds.length) issues.push(`Repuesto ${spare.id}: equipos duplicados`)
    for (const eq of spare.compatibleEquipmentIds) {
      if (!equipment.has(eq)) issues.push(`Repuesto ${spare.id}: equipo ${eq} inexistente`)
      else if (data.config.equipment.find((item) => item.id === eq)?.area !== spare.area) issues.push(`Repuesto ${spare.id}: equipo ${eq} de otra área`)
    }
  }
  for (const unit of data.units) {
    const spare = data.spareTypes.find((item) => item.id === unit.spareTypeId)
    if (!spare) issues.push(`Unidad ${unit.id}: repuesto inexistente`)
    if (unit.installedEquipmentId && !equipment.has(unit.installedEquipmentId)) issues.push(`Unidad ${unit.id}: equipo inexistente`)
    if (unit.installedEquipmentId && spare && !spare.compatibleEquipmentIds.includes(unit.installedEquipmentId)) issues.push(`Unidad ${unit.id}: equipo no compatible`)
  }
  for (const event of data.history) {
    if (!spares.has(event.spareTypeId)) issues.push(`Historial ${event.id}: repuesto inexistente`)
    const unit = data.units.find((item) => item.id === event.unitId)
    if (unit && unit.spareTypeId !== event.spareTypeId) issues.push(`Historial ${event.id}: unidad de otro repuesto`)
    if (event.snapshot.id && event.snapshot.id !== event.unitId) issues.push(`Historial ${event.id}: snapshot de otra unidad`)
    if (event.snapshot.spareTypeId && event.snapshot.spareTypeId !== event.spareTypeId) issues.push(`Historial ${event.id}: snapshot de otro repuesto`)
  }
  // SAP was never unique in the existing app (one catalog entry per area is valid).
  // Do not collapse duplicate SAPs or impose a new rule during migration.
  if (issues.length) throw new SparesValidationError(issues)
  return data
}

export function parseBackup(input: unknown): CriticalSparesData {
  const envelope = z.object({ format: z.literal('LACO1_CRITICAL_SPARES'), version: z.union([z.literal(1), z.literal(2)]), exportedAt: date.optional(), data: z.unknown() }).strict().parse(input)
  if (envelope.version === 2) return validateSparesData(envelope.data)
  // Validate the legacy shape BEFORE invoking the permissive historical normalizer.
  const legacySpare = spareDraftSchema.extend({ id, createdAt: date, updatedAt: date, uncoveredAt: date.nullable().optional(), responsibleId: id.optional(), gmbId: id.optional(), gmbResponsable: id.optional(), responsableGmb: id.optional() })
  const legacy = dataSchema.extend({ schemaVersion: z.literal(1).optional(), spareTypes: z.array(legacySpare), config: configSchema.extend({ areas: z.array(areaSchema).optional(), responsibles: z.array(responsibleSchema.extend({ active: z.boolean().optional() })) }) }).parse(envelope.data)
  return validateSparesData(normalizeCriticalSparesData(legacy))
}

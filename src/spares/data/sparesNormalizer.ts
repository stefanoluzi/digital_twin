import { createDemoSparesData } from './demoSpares'
import type { CriticalSparesData, SpareType } from '../types'
import { getUncoveredAt } from '../domain/spareSelectors'
import { OPERATIONAL_PLANT_AREAS } from '../../config/areas'

type LegacySpare = SpareType & { responsibleId?: string; gmbId?: string; gmbResponsable?: string; responsableGmb?: string }

export function normalizeCriticalSparesData(input: unknown): CriticalSparesData {
  if (!input || typeof input !== 'object') return createDemoSparesData()
  const value = input as Partial<CriticalSparesData>
  if (Number(value.schemaVersion) > 2) throw new Error('Esta versión de Repuestos no puede abrir un formato de datos más nuevo.')
  const fallback = createDemoSparesData()
  const legacySpares: LegacySpare[] = Array.isArray(value.spareTypes) ? structuredClone(value.spareTypes) : fallback.spareTypes
  const config = value.config && Array.isArray(value.config.categories) && Array.isArray(value.config.equipment) && Array.isArray(value.config.responsibles) && Array.isArray(value.config.users)
    ? structuredClone(value.config) : fallback.config
  config.responsibles = config.responsibles.map((person) => ({ ...person, active: person.active !== false, name:
    person.id === 'gmb-mecanica' && person.name === 'GMB Mecánica' ? 'Juan Pérez DEMO' :
    person.id === 'gmb-hidraulica' && person.name === 'GMB Hidráulica' ? 'Martín Gómez DEMO' : person.name }))

  // No volver a inferir asignaciones cuando ya existe una configuración por áreas,
  // incluso si un área quedó deliberadamente sin responsable.
  const hasAreas = Array.isArray(config.areas)
  config.areas = OPERATIONAL_PLANT_AREAS.map((definition) => {
    const existing = hasAreas ? config.areas.find((area) => area.id === definition.code || area.code === definition.code) : undefined
    const candidates = hasAreas ? [] : [...new Set(legacySpares.filter((spare) => spare.area === definition.code)
      .map((spare) => spare.responsibleId || spare.gmbId || spare.gmbResponsable || spare.responsableGmb).filter((id): id is string => typeof id === 'string' && Boolean(id)))]
    const responsibleGmbId = existing?.responsibleGmbId || (candidates.length === 1 ? candidates[0] : undefined)
    const migrationCandidateIds = existing?.migrationCandidateIds || (candidates.length > 1 ? candidates : undefined)
    for (const id of [responsibleGmbId, ...(migrationCandidateIds || [])]) {
      if (id && !config.responsibles.some((person) => person.id === id)) config.responsibles.push({ id, name: `Responsable migrado (${id})`, active: false })
    }
    return { id: definition.code, code: definition.code, name: definition.name, responsibleGmbId, migrationCandidateIds }
  })
  const data: CriticalSparesData = {
    schemaVersion: 2,
    spareTypes: legacySpares.map(({ responsibleId, gmbId, gmbResponsable, responsableGmb, ...spare }) => spare),
    units: Array.isArray(value.units) ? structuredClone(value.units) : fallback.units,
    history: Array.isArray(value.history) ? structuredClone(value.history) : fallback.history,
    config,
  }
  data.spareTypes = data.spareTypes.map((spare) => ({ ...spare, uncoveredAt: getUncoveredAt(data, spare.id) }))
  return data
}

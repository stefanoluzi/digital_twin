import type { CriticalSparesData, GmbResponsible, SpareType } from '../types'

/** Etiqueta de presentación: no renombra ni reasigna datos migrados. */
export function responsibleDisplayName(person?: Pick<GmbResponsible, 'name' | 'active'>) {
  if (!person?.name?.trim() || /^Responsable migrado\s*\(/i.test(person.name.trim())) return 'Sin responsable asignado'
  return `${person.name}${person.active ? '' : ' (inactivo)'}`
}

export function areaResponsibleId(data: CriticalSparesData, areaId: string) {
  return data.config.areas.find((area) => area.id === areaId)?.responsibleGmbId
}

export function spareResponsibleId(data: CriticalSparesData, spare: Pick<SpareType, 'area'>) {
  return areaResponsibleId(data, spare.area)
}

export function areaResponsibleName(data: CriticalSparesData, areaId: string) {
  const id = areaResponsibleId(data, areaId)
  const person = data.config.responsibles.find((item) => item.id === id)
  return person ? responsibleDisplayName(person) : 'Sin responsable GMB'
}

export function responsibleAreas(data: CriticalSparesData, id: string) {
  return data.config.areas.filter((area) => (area.responsibleGmbId || 'UNASSIGNED') === id)
}

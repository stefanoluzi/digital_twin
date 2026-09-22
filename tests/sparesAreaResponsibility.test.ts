import { describe, expect, it } from 'vitest'
import { createDemoSparesData } from '../src/spares/data/demoSpares'
import { normalizeCriticalSparesData } from '../src/spares/data/sparesNormalizer'
import { areaResponsibleName, responsibleAreas, spareResponsibleId } from '../src/spares/domain/areaResponsibility'
import { groupedCoverage, spareCoverage } from '../src/spares/domain/spareSelectors'
import { useCriticalSparesStore } from '../src/spares/store/criticalSparesStore'

function legacyData() {
  const current = createDemoSparesData()
  const { areas, ...config } = current.config
  return {
    ...current, schemaVersion: 1,
    config: { ...config, responsibles: config.responsibles.map(({ active, ...person }) => person) },
    spareTypes: current.spareTypes.map((spare) => ({ ...spare, responsibleId: areas.find((area) => area.id === spare.area)?.responsibleGmbId })),
  }
}

describe('Responsabilidad de GMB por área', () => {
  it('migra el responsable único a su área preservando datos operacionales y documentos', () => {
    const legacy = legacyData()
    legacy.spareTypes[0].drawingPdf = 'data:application/pdf;base64,ZGVtbw=='
    legacy.spareTypes[0].referencePhoto = 'data:image/png;base64,ZGVtbw=='
    legacy.history[0].user = 'Técnico original'
    const migrated = normalizeCriticalSparesData(legacy)
    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.config.areas).toHaveLength(11)
    expect(migrated.config.areas.find((area) => area.code === 'LCO')?.responsibleGmbId).toBe('gmb-mecanica')
    expect(migrated.spareTypes.every((spare) => !('responsibleId' in spare) && !('gmbId' in spare))).toBe(true)
    expect(migrated.units).toEqual(legacy.units)
    expect(migrated.history).toEqual(legacy.history)
    expect(migrated.spareTypes[0]).toMatchObject({ drawingPdf: legacy.spareTypes[0].drawingPdf, referencePhoto: legacy.spareTypes[0].referencePhoto, compatibleEquipmentIds: legacy.spareTypes[0].compatibleEquipmentIds })
    expect(normalizeCriticalSparesData(migrated)).toEqual(migrated)
  })

  it('no elige arbitrariamente en áreas con responsables contradictorios', () => {
    const legacy = legacyData()
    legacy.spareTypes.find((spare) => spare.id === 'sp-acople-lco')!.responsibleId = 'gmb-hidraulica'
    const migrated = normalizeCriticalSparesData(legacy)
    const area = migrated.config.areas.find((item) => item.code === 'LCO')!
    expect(area.responsibleGmbId).toBeUndefined()
    expect(area.migrationCandidateIds).toEqual(['gmb-mecanica', 'gmb-hidraulica'])
    expect(migrated.units).toEqual(legacy.units)
    expect(migrated.history).toEqual(legacy.history)
    expect(normalizeCriticalSparesData(migrated).config.areas).toEqual(migrated.config.areas)
  })

  it('una reasignación actualiza agrupación y consultas sin modificar ningún repuesto ni historial', () => {
    useCriticalSparesStore.getState().hydrate(createDemoSparesData())
    const before = useCriticalSparesStore.getState()
    const coverage = before.spareTypes.map((spare) => spareCoverage(before, spare.id))
    useCriticalSparesStore.getState().updateConfig({ ...before.config, areas: before.config.areas.map((area) => area.id === 'LCO' ? { ...area, responsibleGmbId: 'gmb-hidraulica' } : area) })
    const after = useCriticalSparesStore.getState()
    expect(after.spareTypes).toBe(before.spareTypes)
    expect(after.units).toBe(before.units)
    expect(after.history).toBe(before.history)
    expect(after.spareTypes.map((spare) => spareCoverage(after, spare.id))).toEqual(coverage)
    expect(areaResponsibleName(after, 'LCO')).toBe('Martín Gómez DEMO')
    expect(after.spareTypes.filter((spare) => spareResponsibleId(after, spare) === 'gmb-hidraulica')).toHaveLength(4)
    expect(responsibleAreas(after, 'gmb-hidraulica').map((area) => area.code)).toEqual(['HG', 'LP', 'LCO'])
    expect(groupedCoverage(after, after.config.responsibles, 'gmb').find((person) => person.id === 'gmb-hidraulica')).toMatchObject({ total: 4, covered: 2, uncovered: 2, percent: 50, repair: 2, purchase: 1 })
    expect(normalizeCriticalSparesData(after).config.areas).toEqual(after.config.areas)
  })

  it('conserva un área deliberadamente sin responsable y permite GMB inactivos sin borrar asignaciones', () => {
    const data = createDemoSparesData()
    data.config.areas.find((area) => area.code === 'LCO')!.responsibleGmbId = undefined
    data.config.responsibles[0].active = false
    const normalized = normalizeCriticalSparesData(data)
    expect(areaResponsibleName(normalized, 'LCO')).toBe('Sin responsable GMB')
    expect(areaResponsibleName(normalized, 'PENF')).toBe('Juan Pérez DEMO (inactivo)')
  })
})

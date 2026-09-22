import { describe, expect, it } from 'vitest'
import { createDemoSparesData } from '../src/spares/data/demoSpares'
import { coverageSummary, getRecoveryAction, getSpareAlerts, spareCoverage, groupedCoverage, selectSpares, trackingSituations, daysSince } from '../src/spares/domain/spareSelectors'
import { normalizeCriticalSparesData } from '../src/spares/data/sparesNormalizer'
import { OPERATIONAL_PLANT_AREAS } from '../src/config/areas'
import { useCriticalSparesStore } from '../src/spares/store/criticalSparesStore'

describe('Repuestos Críticos', () => {
  it('agrupa tipos por área y responsable sin contar unidades como tipos', () => {
    const data = createDemoSparesData()
    const areas = groupedCoverage(data, OPERATIONAL_PLANT_AREAS.map((area) => ({ id: area.code, name: area.name })), 'area')
    expect(areas.map((area) => area.id)).toEqual(['COBA','HG','LP','REMA','LCO','ZTREF','HBM','LRE','PENF','SHA','CESTOS'])
    expect(areas.find((area) => area.id === 'LCO')).toMatchObject({ total: 2, covered: 2, percent: 100, repair: 1 })
    const people = groupedCoverage(data, data.config.responsibles, 'gmb')
    expect(people.find((person) => person.id === 'gmb-hidraulica')).toMatchObject({ total: 2, covered: 0, uncovered: 2, repair: 1, purchase: 1 })
    const scoped = selectSpares(data, data.spareTypes.filter((spare) => spare.area === 'LCO'))
    expect(coverageSummary(scoped)).toMatchObject({ total: 2, covered: 2, purchase: 0, repair: 1 })
  })

  it('distingue 70 días de reparación de 15 días sin cobertura y conserva el período al cambiar reparación por compra', () => {
    const data = createDemoSparesData()
    data.units.find((unit) => unit.id === 'LC1C-RED-0002')!.statusSince = '2026-07-08'
    useCriticalSparesStore.getState().hydrate(data)
    const available = useCriticalSparesStore.getState().units.find((unit) => unit.id === 'LC1C-RED-0003')!
    useCriticalSparesStore.getState().updateUnit(available.id, { ...available, status: 'INSTALLED', statusSince: '2026-09-01' })
    const now = new Date('2026-09-16T12:00:00')
    expect(spareCoverage(useCriticalSparesStore.getState(), 'sp-red-transfer', now).uncoveredSince).toBe(15)
    expect(daysSince('2026-07-08', now)).toBe(70)
    const repair = useCriticalSparesStore.getState().units.find((unit) => unit.id === 'LC1C-RED-0002')!
    useCriticalSparesStore.getState().updateUnit(repair.id, { ...repair, status: 'ON_ORDER', statusSince: '2026-09-14' })
    expect(spareCoverage(useCriticalSparesStore.getState(), 'sp-red-transfer', now).uncoveredSince).toBe(15)
    useCriticalSparesStore.getState().updateUnit(available.id, { ...available, status: 'WAREHOUSE', statusSince: '2026-09-15' })
    expect(spareCoverage(useCriticalSparesStore.getState(), 'sp-red-transfer', now)).toMatchObject({ covered: true, uncoveredAt: null, uncoveredSince: 0 })
    useCriticalSparesStore.getState().updateUnit(available.id, { ...available, status: 'INSTALLED', statusSince: '2026-09-16' })
    expect(spareCoverage(useCriticalSparesStore.getState(), 'sp-red-transfer', now).uncoveredSince).toBe(0)
  })

  it('reconstruye un quiebre anterior desde el historial al migrar y conserva nombres personalizados', () => {
    const data = createDemoSparesData()
    const unit = data.units.find((item) => item.id === 'LC1C-RED-0003')!
    unit.status = 'INSTALLED'; unit.statusSince = '2026-09-01'
    data.history.push({ id: 'loss', unitId: unit.id, spareTypeId: unit.spareTypeId, timestamp: '2026-09-02T10:00:00Z', user: 'Demo', previousStatus: 'WAREHOUSE', nextStatus: 'INSTALLED', comment: '', snapshot: { ...unit } })
    data.config.responsibles[0].name = 'GMB Mecánica'
    data.config.responsibles[1].name = 'Responsable personalizado'
    const migrated = normalizeCriticalSparesData(data)
    expect(spareCoverage(migrated, unit.spareTypeId, new Date('2026-09-16T12:00:00')).uncoveredSince).toBe(15)
    expect(migrated.config.responsibles.map((item) => item.name)).toEqual(['Juan Pérez DEMO', 'Responsable personalizado'])
    expect(migrated.units).toEqual(data.units)
    expect(migrated.history).toEqual(data.history)
  })

  it('prioriza situaciones sin cobertura y filtra el estado de la unidad', () => {
    const data = createDemoSparesData()
    const rows = trackingSituations(data)
    expect(rows.at(-1)?.coverage.covered).toBe(true)
    const purchases = trackingSituations(data, 'ON_ORDER')
    expect(purchases).toHaveLength(2)
    expect(purchases.every((row) => row.unit.status === 'ON_ORDER')).toBe(true)
  })
  it('calcula cobertura solo con almacén o pie de máquina', () => {
    const data = createDemoSparesData()
    expect(spareCoverage(data, 'sp-red-transfer').covered).toBe(true)
    expect(spareCoverage(data, 'sp-red-transfer').available).toBe(1)
    expect(spareCoverage(data, 'sp-cil-piercer').covered).toBe(false)
  })

  it('resume tipos cubiertos y situaciones abiertas', () => {
    const summary = coverageSummary(createDemoSparesData())
    expect(summary.total).toBe(6)
    expect(summary.covered).toBe(3)
    expect(summary.uncovered).toBe(3)
    expect(summary.repair).toBe(2)
    expect(summary.purchase).toBe(2)
  })

  it('explica la acción de recuperación sin editar la cobertura', () => {
    const data = createDemoSparesData()
    const units = data.units.filter((unit) => unit.spareTypeId === 'sp-bomba-hg')
    expect(getRecoveryAction(units).text).toContain('Aviso 400987-DEMO')
  })

  it('marca ETA vencida y reparaciones demoradas', () => {
    const data = createDemoSparesData()
    const cylinder = data.spareTypes.find((item) => item.id === 'sp-cil-piercer')!
    const pump = data.spareTypes.find((item) => item.id === 'sp-bomba-hg')!
    expect(getSpareAlerts(data, cylinder).some((alert) => alert.text.includes('ETA vencida'))).toBe(true)
    expect(getSpareAlerts(data, pump).some((alert) => alert.text.includes('60 días'))).toBe(true)
  })

  it('asigna ID y registra automáticamente cada cambio de estado', () => {
    const initial = createDemoSparesData()
    useCriticalSparesStore.getState().hydrate(initial)
    const id = useCriticalSparesStore.getState().addUnit('sp-red-transfer', { status: 'MACHINE_SIDE', statusSince: '2026-09-10', comment: 'Lista para uso', location: 'Estantería demo' })
    expect(id).toMatch(/^LC1C-RED-\d{4}$/)
    useCriticalSparesStore.getState().updateUnit(id, { status: 'INSTALLED', statusSince: '2026-09-16', comment: 'Cambio demo', location: '', installedEquipmentId: 'eq-transfer-6', installationDate: '2026-09-16' })
    const events = useCriticalSparesStore.getState().history.filter((event) => event.unitId === id)
    expect(events).toHaveLength(2)
    expect(events[1]).toMatchObject({ previousStatus: 'MACHINE_SIDE', nextStatus: 'INSTALLED', equipmentId: 'eq-transfer-6' })
  })
})

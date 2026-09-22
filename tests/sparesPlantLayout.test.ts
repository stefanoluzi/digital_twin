import { describe, expect, it } from 'vitest'
import { OPERATIONAL_PLANT_AREAS } from '../src/config/areas'
import { createDemoSparesData } from '../src/spares/data/demoSpares'
import { normalizeCriticalSparesData } from '../src/spares/data/sparesNormalizer'
import { dashboardSelections, DEFAULT_DASHBOARD_FILTERS } from '../src/spares/domain/dashboardFilters'
import { coverageByArea } from '../src/spares/domain/dashboardSelectors'
import { PLANT_LAYOUT_AREAS } from '../src/spares/plantLayoutAreas'

describe('Cobertura por Layout', () => {
  it('tiene exactamente las once áreas operacionales y geometría porcentual válida', () => {
    expect(PLANT_LAYOUT_AREAS.map((area) => area.id).sort()).toEqual(OPERATIONAL_PLANT_AREAS.map((area) => area.code).sort())
    expect(new Set(PLANT_LAYOUT_AREAS.map((area) => area.id)).size).toBe(11)
    for (const area of PLANT_LAYOUT_AREAS) {
      expect(area.x).toBeGreaterThanOrEqual(0)
      expect(area.y).toBeGreaterThanOrEqual(0)
      expect(area.width).toBeGreaterThan(0)
      expect(area.height).toBeGreaterThan(0)
      expect(area.x + area.width).toBeLessThanOrEqual(100)
      expect(area.y + area.height).toBeLessThanOrEqual(100)
    }
  })

  it('alinea REMA/LCO y el borde inferior de SHA/PENF', () => {
    const area = (id: string) => PLANT_LAYOUT_AREAS.find((item) => item.id === id)!
    expect(area('REMA').y).toBe(area('LCO').y)
    expect(area('REMA').height).toBe(area('LCO').height)
    expect(area('SHA').y + area('SHA').height).toBe(area('PENF').y + area('PENF').height)
    expect(area('SHA').x + area('SHA').width).toBeCloseTo(area('PENF').x, 8)
  })

  it('usa el contorno irregular del HG sin superponer LP, REMA ni los demás rectángulos', () => {
    const area = (id: string) => PLANT_LAYOUT_AREAS.find((item) => item.id === id)!
    expect(area('HG').path).toMatch(/^M 421 139 H 628 V 267 H 487 A 120 120/)
    expect(area('LP').x * 18.38).toBeGreaterThan(489 + 2.5)
    expect(area('LP').y * 5.7).toBeGreaterThan(280 + 2.5)
    expect(area('REMA').x * 18.38).toBeGreaterThan(455)
    expect(area('REMA').y).toBeGreaterThan(area('LP').y + area('LP').height)
    const rectangles = PLANT_LAYOUT_AREAS.filter((item) => !item.path)
    for (let i = 0; i < rectangles.length; i++) for (let j = i + 1; j < rectangles.length; j++) {
      const a = rectangles[i], b = rectangles[j]
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
      expect(overlapX > 0.001 && overlapY > 0.001, `${a.id} y ${b.id} se superponen`).toBe(false)
    }
  })

  it('usa los mismos selectores de cobertura que el gráfico y admite HBM en respaldos anteriores', () => {
    const data = createDemoSparesData()
    const graphRows = coverageByArea(dashboardSelections(data, DEFAULT_DASHBOARD_FILTERS).area, 'operational')
    expect(graphRows.find((row) => row.id === 'LCO')).toMatchObject({ total: 2, covered: 2, uncovered: 0, percent: 100 })
    expect(graphRows.find((row) => row.id === 'HBM')).toMatchObject({ total: 0, percent: 0 })
    const previous = createDemoSparesData()
    previous.config.areas = previous.config.areas.filter((area) => area.code !== 'HBM')
    expect(normalizeCriticalSparesData(previous).config.areas.find((area) => area.code === 'HBM')).toMatchObject({ code: 'HBM', name: 'Horno de Barras Móviles' })
  })
})

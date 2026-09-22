import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createDemoSparesData } from '../src/spares/data/demoSpares'
import { areaResponsibleName, responsibleDisplayName } from '../src/spares/domain/areaResponsibility'
import { coverageByGmb } from '../src/spares/domain/dashboardSelectors'
import { coverageSummary } from '../src/spares/domain/spareSelectors'
import { readSparesTextSize, saveSparesTextSize } from '../src/spares/services/textSizePreference'

describe('Presentación visual de Repuestos Críticos', () => {
  it('recuerda el tamaño de letra y usa Grande como valor inicial', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) })
    try {
      expect(readSparesTextSize()).toBe('comfortable')
      saveSparesTextSize('large')
      expect(readSparesTextSize()).toBe('large')
      saveSparesTextSize('compact')
      expect(readSparesTextSize()).toBe('compact')
    } finally { vi.unstubAllGlobals() }
  })

  it('oculta etiquetas técnicas sin modificar responsables ni asignaciones', () => {
    const data = createDemoSparesData()
    const person = data.config.responsibles[0]
    person.name = `Responsable migrado (${person.id})`
    person.active = false
    const original = JSON.stringify(data)
    expect(responsibleDisplayName(person)).toBe('Sin responsable asignado')
    expect(areaResponsibleName(data, 'LCO')).toBe('Sin responsable asignado')
    expect(coverageByGmb(data).find((row) => row.id === person.id)?.name).toBe('Sin responsable asignado')
    expect(responsibleDisplayName({ name: 'María Pérez', active: true })).toBe('María Pérez')
    expect(responsibleDisplayName({ name: 'María Pérez', active: false })).toBe('María Pérez (inactivo)')
    expect(JSON.stringify(data)).toBe(original)
  })

  it('deja sin áreas al final, reduce prioridad de inactivos y conserva los totales', () => {
    const data = createDemoSparesData()
    data.config.responsibles.push({ id: 'unassigned-person', name: 'Ana Demo', active: true })
    data.config.responsibles[0].active = false
    const before = coverageSummary(data)
    const rows = coverageByGmb(data)
    expect(rows[0].id).toBe('gmb-hidraulica')
    expect(rows[rows.length - 1]).toMatchObject({ id: 'unassigned-person', areas: [], total: 0 })
    expect(rows.find((row) => row.id === 'gmb-mecanica')?.inactive).toBe(true)
    expect(rows.reduce((sum, row) => sum + row.total, 0)).toBe(before.total)
    expect(rows.reduce((sum, row) => sum + row.covered, 0)).toBe(before.covered)
    expect(coverageSummary(data)).toEqual(before)
  })

  it('centraliza colores CSS y mantiene contraste semántico en ambos temas', () => {
    for (const path of ['criticalSpares.css', 'components/coverageCharts.css']) {
      expect(readFileSync(`src/spares/${path}`, 'utf8')).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    }
    const css = readFileSync('src/spares/sparesPalette.css', 'utf8')
    const colors = (source: string) => Object.fromEntries([...source.matchAll(/--(sp-[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((match) => [match[1], match[2]]))
    const [darkSource, lightSource] = css.split('.spares-app.theme-light')
    const dark = colors(darkSource)
    const light = { ...dark, ...colors(lightSource) }
    for (const theme of [dark, light]) {
      for (const token of ['sp-brand', 'sp-success', 'sp-risk', 'sp-warning', 'sp-info', 'sp-soft', 'sp-text']) {
        expect(contrast(theme[token], theme['sp-panel']), token).toBeGreaterThanOrEqual(4.5)
      }
      expect(contrast(theme['sp-risk'], theme['sp-risk-surface'])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(theme['sp-on-primary'], theme['sp-primary'])).toBeGreaterThanOrEqual(4.5)
      const red = theme['sp-risk']
      // Rojo cálido: no invertir verde/azul hacia magenta.
      expect(parseInt(red.slice(3, 5), 16)).toBeGreaterThan(parseInt(red.slice(5, 7), 16))
    }
  })
})

function contrast(a: string, b: string) {
  const luminance = (hex: string) => hex.slice(1).match(/../g)!.map((value) => parseInt(value, 16) / 255)
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0)
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05)
}

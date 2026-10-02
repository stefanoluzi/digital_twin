import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RepairPlanLegend } from '../src/repairs/RepairPlanLegend'

describe('Referencias visuales del plan', () => {
  it('ofrece cinco filtros accesibles conservando colores e iconos', () => {
    const html = renderToStaticMarkup(createElement(RepairPlanLegend))
    for (const label of ['Pendiente', 'En curso', 'Bloqueada', 'Entregada', 'Vencida']) expect(html).toContain(label)
    for (const tone of ['planned', 'progress', 'blocked', 'delivered', 'late']) expect(html).toContain(`repair-status ${tone}`)
    expect(html.match(/<button /g)).toHaveLength(5)
    expect(html).not.toContain('Cómo leer el plan')
    expect(html).not.toContain('el rojo tiene prioridad')
    expect(html).not.toContain('1/3')
    expect(html).not.toContain('repair-legend-help')
    expect(html).not.toContain('title=')
    expect(html).not.toContain('<small')
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(5)
    expect(html).toContain('aria-label="Filtrar por estados"')
  })
})

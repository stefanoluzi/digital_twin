import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RepairPlanLegend } from '../src/repairs/RepairPlanLegend'

describe('Referencias visuales del plan', () => {
  it('identifica los cinco colores con texto e iconos sin ofrecer cambios de estado', () => {
    const html = renderToStaticMarkup(createElement(RepairPlanLegend))
    for (const label of ['Pendiente', 'En curso', 'Bloqueada', 'Entregada', 'Vencida']) expect(html).toContain(label)
    for (const tone of ['planned', 'progress', 'blocked', 'delivered', 'late']) expect(html).toContain(`repair-status ${tone}`)
    expect(html.match(/<li /g)).toHaveLength(5)
    expect(html).toContain('el rojo tiene prioridad')
    expect(html).toContain('1/3')
    expect(html).not.toContain('<button')
    expect(html).toContain('aria-label="Referencias de colores del plan"')
  })
})

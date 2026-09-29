import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BusyButton, ChartSkeleton, ModuleLoading, PageTransition, RefreshStatus, TableSkeleton } from '../src/shared/ux/LoadingFeedback'

describe('industrial loading feedback', () => {
  it('locks a busy submit while retaining both labels for stable dimensions', () => {
    const html = renderToStaticMarkup(<BusyButton type="submit" busy>Guardar</BusyButton>)
    expect(html).toContain('type="submit"')
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('visibility:hidden')
    expect(html).toContain('Guardar')
    expect(html).toContain('Guardando…')
  })
  it('does not make idle buttons submit accidentally and respects validation', () => {
    const html = renderToStaticMarkup(<BusyButton disabled>Exportar</BusyButton>)
    expect(html).toContain('type="button"')
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-busy="false"')
  })
  it('reserves a quiet status region without announcing activity when idle', () => {
    const idle = renderToStaticMarkup(<RefreshStatus active={false} />)
    expect(idle).toContain('role="status"')
    expect(idle).not.toContain('Actualizando')
    expect(renderToStaticMarkup(<RefreshStatus active />)).toContain('Actualizando…')
  })
  it('starts with the loader hidden to avoid flashes on fast requests', () => {
    const html = renderToStaticMarkup(<ModuleLoading />)
    expect(html).toContain('visibility:hidden')
    expect(html).toContain('aria-busy="true"')
    expect(html).not.toContain('%')
  })
  it('sizes table and chart placeholders without exposing fake data', () => {
    const table = renderToStaticMarkup(<TableSkeleton rows={5} />)
    expect(table.match(/class="ux-skeleton-row"/g)).toHaveLength(5)
    expect(renderToStaticMarkup(<ChartSkeleton height={320} />)).toContain('height:320px')
    expect(table).toContain('aria-hidden="true"')
  })
  it('keeps the real content in the transition container', () => {
    expect(renderToStaticMarkup(<PageTransition transitionKey="TRACKING"><table><tbody><tr><td>Dato confirmado</td></tr></tbody></table></PageTransition>)).toContain('Dato confirmado')
  })
})

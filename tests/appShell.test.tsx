import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppShell, readAppTheme, useAppTheme } from '../src/shared/AppShell'

afterEach(() => vi.unstubAllGlobals())
function Module() { return <main data-theme={useAppTheme()}>Contenido del módulo</main> }
describe('shared industrial app shell', () => {
  it('renders one global header with informational identity, not authentication', () => {
    const html = renderToStaticMarkup(<AppShell><Module /></AppShell>)
    expect(html.match(/<header/g)).toHaveLength(1)
    expect(html).toContain('LACO 1')
    expect(html).toContain('Usuario local · ADMIN')
    expect(html).toContain('Sin autenticación ni control de acceso')
    expect(html).not.toContain('<select')
    expect(html).not.toContain('Actualizar datos')
    expect(html).not.toContain('Guardado')
    expect(html).not.toContain('PostgreSQL')
  })
  it('shares the persisted theme with module content', () => {
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'maintenance-app-theme' ? 'dark' : null })
    const html = renderToStaticMarkup(<AppShell><Module /></AppShell>)
    expect(html).toContain('global-app-shell theme-dark')
    expect(html).toContain('data-theme="dark"')
    expect(html).toContain('Activar modo claro')
  })
  it('respects the new preference over legacy per-module preferences', () => {
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'maintenance-app-theme' ? 'light' : 'dark' })
    expect(readAppTheme()).toBe('light')
  })
  it('preserves a previous dark preference when no global preference exists', () => {
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'critical-spares-theme' ? 'dark' : null })
    expect(readAppTheme()).toBe('dark')
  })
  it('works when preference storage is unavailable', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') } })
    expect(readAppTheme()).toBe('light')
  })
})

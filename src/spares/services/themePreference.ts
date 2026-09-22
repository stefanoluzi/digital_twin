export type SparesTheme = 'light' | 'dark'
const KEY = 'critical-spares-theme'
export function readSparesTheme(): SparesTheme {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}
export function saveSparesTheme(theme: SparesTheme) {
  try { localStorage.setItem(KEY, theme) } catch { /* El tema sigue funcionando si el navegador bloquea preferencias. */ }
}

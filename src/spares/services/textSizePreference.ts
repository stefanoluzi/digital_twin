export type SparesTextSize = 'compact' | 'comfortable' | 'large'
const KEY = 'critical-spares-text-size'

export function readSparesTextSize(): SparesTextSize {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'compact' || value === 'large' ? value : 'comfortable'
  } catch { return 'comfortable' }
}

export function saveSparesTextSize(size: SparesTextSize) {
  try { localStorage.setItem(KEY, size) } catch { /* La preferencia sigue activa durante esta sesión. */ }
}

import { useEffect, useState } from 'react'
import { LcoCouplingsScreen } from './LcoCouplingsScreen'

type LcoTheme = 'light' | 'dark'

const LCO_THEME_STORAGE_KEY = 'laco1-lco-theme'

function initialTheme(): LcoTheme {
  try {
    return window.localStorage.getItem(LCO_THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function StandaloneLcoCouplingsApp() {
  const [theme, setTheme] = useState<LcoTheme>(initialTheme)

  useEffect(() => {
    try { window.localStorage.setItem(LCO_THEME_STORAGE_KEY, theme) } catch { /* Storage can be unavailable in private contexts. */ }
  }, [theme])

  return <div className={`lco-standalone-app theme-${theme}`}>
    <LcoCouplingsScreen
      standalone
      standaloneThemeControl={<button
        className="lco-theme-toggle"
        type="button"
        aria-label={`Cambiar a modo ${theme === 'light' ? 'oscuro' : 'claro'}`}
        aria-pressed={theme === 'light'}
        title={`Cambiar a modo ${theme === 'light' ? 'oscuro' : 'claro'}`}
        onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
      ><span aria-hidden="true">{theme === 'light' ? '☀' : '☾'}</span> Modo {theme === 'light' ? 'claro' : 'oscuro'}</button>}
    />
  </div>
}

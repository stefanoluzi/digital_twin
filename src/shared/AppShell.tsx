import { createContext, lazy, Suspense, useContext, useEffect, useState, type ReactNode } from 'react'
import { ModuleLoading } from './ux/LoadingFeedback'
import './appShell.css'

export type AppTheme = 'light' | 'dark'
const THEME_KEY = 'maintenance-app-theme'
const GeneralConfiguration = lazy(() => import('./GeneralConfiguration'))
export function readAppTheme(): AppTheme {
  try { return (localStorage.getItem(THEME_KEY) ?? localStorage.getItem('critical-spares-theme') ?? localStorage.getItem('laco1-lco-theme') ?? localStorage.getItem('industrial-twin-theme')) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}
const ShellContext = createContext({ theme: 'light' as AppTheme, setUser: (_user: string) => {} })
export const useAppTheme = () => useContext(ShellContext).theme
export function useAppUser(label: string | undefined) {
  const { setUser } = useContext(ShellContext)
  useEffect(() => { if (label) setUser(label); return () => setUser('Usuario local · ADMIN') }, [label, setUser])
}

export function AppShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState(readAppTheme)
  const [user, setUser] = useState('Usuario local · ADMIN')
  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* La preferencia funciona también sin almacenamiento. */ }
  }, [theme])
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === THEME_KEY) setTheme(readAppTheme()) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  return <ShellContext.Provider value={{ theme, setUser }}>
    <div className={`global-app-shell theme-${theme}`}>
      <header className="global-topbar">
        <a className="global-topbar-brand" href="/">Planta <span>Maintenance Management</span></a>
        <div className="global-topbar-controls">
          <a className="global-user-chip" href="/configuracion">Configuración general</a>
          <button type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'} aria-pressed={theme === 'dark'}><span aria-hidden="true">{theme === 'light' ? '☾' : '☀'}</span> {theme === 'light' ? 'Modo oscuro' : 'Modo claro'}</button>
          <span className="global-user-chip" title="Usuario informativo. Sin autenticación ni control de acceso.">{user}</span>
        </div>
      </header>
      <div className="global-app-content">{typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/configuracion' ? <Suspense fallback={<ModuleLoading title="Configuración general" />}><GeneralConfiguration /></Suspense> : children}</div>
    </div>
  </ShellContext.Provider>
}

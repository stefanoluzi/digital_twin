import { lazy, Suspense } from 'react'
import './platform.css'

const Spares = lazy(() => import('../spares/CriticalSparesApp'))
const Couplings = lazy(() => import('../apps/maintenance/StandaloneLcoCouplingsApp').then((m) => ({ default: m.StandaloneLcoCouplingsApp })))
export const criticalControls = [{ path: '/controles-criticos/acoplamientos', title: 'Acoplamientos', description: 'Seguimiento y registro histórico de controles de acoplamientos.', Component: Couplings }]

export default function MaintenancePlatform() {
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  const control = criticalControls.find((item) => item.path === path)
  const spares = path === '/repuestos'
  const controls = path === '/controles-criticos'
  const home = path === '/'
  return <div className="maintenance-platform">
    <nav className="platform-nav" aria-label="Navegación de la plataforma"><a href="/">Mantenimiento LC1C</a>{spares && <span> / Repuestos Críticos</span>}{(controls || control) && <><span> / </span><a href="/controles-criticos">Controles Críticos</a></>}{control && <span> / {control.title}</span>}</nav>
    <Suspense fallback={<p className="platform-loading" role="status">Cargando módulo…</p>}>
      {spares ? <Spares /> : control ? <control.Component /> : home || controls ? <main className="platform-home">
        <small>LC1C · MANTENIMIENTO</small><h1>{home ? 'Mantenimiento LC1C' : 'Controles Críticos'}</h1><p>{home ? 'Gestión de activos y controles críticos' : 'Seleccioná el tipo de control'}</p>
        <div className="platform-cards">{(home ? [
          { path: '/repuestos', title: 'Repuestos Críticos', description: 'Gestión de cobertura de repuestos críticos.' },
          { path: '/controles-criticos', title: 'Controles Críticos', description: 'Seguimiento periódico de condiciones y controles críticos.' },
        ] : criticalControls).map((item) => <a className="platform-card" key={item.path} href={item.path}><h2>{item.title}</h2><p>{item.description}</p><span>INGRESAR →</span></a>)}</div>
      </main> : <main className="platform-home"><h1>Página no encontrada</h1><a href="/">Volver al inicio</a></main>}
    </Suspense>
  </div>
}

import { lazy, Suspense } from 'react'
import './platform.css'
import { ModuleLoading } from '../shared/ux/LoadingFeedback'

const Spares = lazy(() => import('../spares/CriticalSparesApp'))
const Repairs = lazy(() => import('../repairs/RepairsApp'))
const Rex = lazy(() => import('../rex/RexApp'))
const Couplings = lazy(() => import('../apps/maintenance/StandaloneLcoCouplingsApp').then((m) => ({ default: m.StandaloneLcoCouplingsApp })))
export const criticalControls = [{ path: '/controles-criticos/acoplamientos', title: 'Acoplamientos', description: 'Seguimiento y registro histórico de controles de acoplamientos.', Component: Couplings }]

export default function MaintenancePlatform() {
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  const control = criticalControls.find((item) => item.path === path)
  const spares = path === '/repuestos'
  const repairs = path === '/reparaciones-taller'
  const rex = path === '/tareas-globales-rex'
  const controls = path === '/controles-criticos'
  const home = path === '/'
  return <div className="maintenance-platform ux-enter">
    {(controls || control) && <nav className="module-breadcrumb" aria-label="Contexto del módulo"><a href="/">Inicio</a>{control && <><span> / </span><a href="/controles-criticos">Controles Críticos</a></>}</nav>}
    <Suspense fallback={<ModuleLoading title={rex ? 'Tareas Globales REX' : spares ? 'Repuestos Críticos - LC1C' : repairs ? 'Reparaciones Taller' : control ? 'Acoplamientos LCO' : undefined} />}>
      {rex ? <Rex /> : spares ? <Spares /> : repairs ? <Repairs /> : control ? <control.Component /> : home || controls ? <main className="platform-home">
        <small>LC1C · MANTENIMIENTO</small><h1>{home ? 'Mantenimiento LC1C' : 'Controles Críticos'}</h1><p>{home ? 'Gestión de activos y controles críticos' : 'Seleccioná el tipo de control'}</p>
        <div className="platform-cards">{(home ? [
          { path: '/repuestos', title: 'Repuestos Críticos', description: 'Gestión de cobertura de repuestos críticos.' },
          { path: '/reparaciones-taller', title: 'Reparaciones Taller', description: 'Plan mensual, entregas, compromisos y bloqueos de equipos en taller.' },
          { path: '/tareas-globales-rex', title: 'Tareas Globales REX', description: 'Historial, frecuencia y cumplimiento de tareas globales de mantenimiento.' },
          { path: '/controles-criticos', title: 'Controles Críticos', description: 'Seguimiento periódico de condiciones y controles críticos.' },
        ] : criticalControls).map((item) => <a className="platform-card" key={item.path} href={item.path}><h2>{item.title}</h2><p>{item.description}</p><span>INGRESAR →</span></a>)}</div>
      </main> : <main className="platform-home"><h1>Página no encontrada</h1><a href="/">Volver al inicio</a></main>}
    </Suspense>
  </div>
}

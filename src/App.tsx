import { lazy, Suspense } from 'react'
import { useAppLocation } from './shared/navigation'
import { StandaloneLcoCouplingsApp } from './apps/maintenance/StandaloneLcoCouplingsApp'

const PlatformApp = lazy(() => import('./apps/PlatformApp'))
const PlannerApp = lazy(() => import('./planner/PlannerApp'))

export default function App() {
  const location = useAppLocation()
  const pathname = location.split('?')[0]
  if (pathname === '/lco-couplings') return <StandaloneLcoCouplingsApp />
  if (pathname === '/planner') return <Suspense fallback={<main className="app-route-loading">Cargando Planner…</main>}><PlannerApp /></Suspense>
  return <Suspense fallback={<main className="app-route-loading">Cargando plataforma…</main>}><PlatformApp location={location} /></Suspense>
}

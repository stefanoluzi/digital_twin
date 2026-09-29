import { lazy, Suspense } from 'react'
import { ModuleLoading } from './shared/ux/LoadingFeedback'
import { useAppLocation } from './shared/navigation'
import { StandaloneLcoCouplingsApp } from './apps/maintenance/StandaloneLcoCouplingsApp'

const PlatformApp = lazy(() => import('./apps/PlatformApp'))
const PlannerApp = lazy(() => import('./planner/PlannerApp'))
const CriticalSparesApp = lazy(() => import('./spares/CriticalSparesApp'))

export default function App() {
  const location = useAppLocation()
  const pathname = location.split('?')[0]
  if (pathname === '/lco-couplings') return <StandaloneLcoCouplingsApp />
  if (pathname === '/planner') return <Suspense fallback={<ModuleLoading title="Planner" />}><PlannerApp /></Suspense>
  if (pathname === '/critical-spares') return <Suspense fallback={<ModuleLoading title="Repuestos Críticos - LC1C" />}><CriticalSparesApp /></Suspense>
  return <Suspense fallback={<ModuleLoading />}><PlatformApp location={location} /></Suspense>
}

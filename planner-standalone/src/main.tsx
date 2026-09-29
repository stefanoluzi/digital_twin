import { AppShell } from '../../src/shared/AppShell'
import React from 'react'
import ReactDOM from 'react-dom/client'
import PlannerApp from '../../src/planner/PlannerApp'
import '../../src/styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppShell><PlannerApp /></AppShell>
  </React.StrictMode>,
)

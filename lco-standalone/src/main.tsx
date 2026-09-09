import React from 'react'
import ReactDOM from 'react-dom/client'
import { StandaloneLcoCouplingsApp } from '../../src/apps/maintenance/StandaloneLcoCouplingsApp'
import '../../src/styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StandaloneLcoCouplingsApp />
  </React.StrictMode>,
)

import { useRef, useState } from 'react'
import { openProjectFile, saveProjectFile, saveProjectFileAs } from '../../services/projectSessionService'
import { AppNavigation } from '../../shared/AppNavigation'
import { navigate } from '../../shared/navigation'
import { useProjectStore } from '../../store/projectStore'
import { getActiveMaintenanceModule, MAINTENANCE_MODULES } from './maintenanceModules'

export function MaintenanceTopBar({ query, onQueryChange }: { query: string; onQueryChange: (value: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('Listo')
  const project = useProjectStore()
  const activeModule = getActiveMaintenanceModule(window.location.pathname)
  const save = (saveAs = false) => { const result = saveAs ? saveProjectFileAs() : saveProjectFile(); if (result) setMessage(result.message) }
  const open = async (file?: File) => { if (!file) return; try { setMessage((await openProjectFile(file)).message) } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo abrir') } }

  return <>
    <AppNavigation active="MAINTENANCE" />
    <header className="maintenance-topbar">
      <div className="maintenance-title">
        <strong>LACO 1 Maintenance</strong>
        <small>{project.hasActiveProject ? `${project.metadata.name}${project.isDirty ? ' *' : ''}` : 'Sin proyecto'}</small>
      </div>
      <nav className="maintenance-module-nav" aria-label="Módulos de Maintenance">
        {MAINTENANCE_MODULES.map((module) => <button key={module.id} className={activeModule.id === module.id ? 'active' : ''} onClick={() => navigate(module.path)}>{module.label}</button>)}
      </nav>
      {activeModule.id === 'TWIN' && <div className="maintenance-global-search">
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar equipo, ID, posición, OT SAP..." />
        {query && <button onClick={() => onQueryChange('')}>×</button>}
      </div>}
      <div className="maintenance-file-actions">
        <button onClick={() => fileRef.current?.click()}>Abrir</button>
        <button disabled={!project.hasActiveProject} onClick={() => save(false)}>Guardar</button>
        <button disabled={!project.hasActiveProject} onClick={() => save(true)}>Guardar como</button>
      </div>
      <span className="maintenance-save-status">{message}</span>
      <input ref={fileRef} hidden type="file" accept=".laco3d,.json,application/json" onChange={(event) => { void open(event.target.files?.[0]); event.target.value = '' }} />
    </header>
  </>
}

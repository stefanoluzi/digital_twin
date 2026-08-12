import { useRef, useState } from 'react'
import { openProjectFile, saveProjectFile, saveProjectFileAs } from '../../services/projectSessionService'
import { AppNavigation } from '../../shared/AppNavigation'
import { navigate } from '../../shared/navigation'
import { useProjectStore } from '../../store/projectStore'

export function MaintenanceTopBar({ query, onQueryChange }: { query: string; onQueryChange: (value: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null); const [message, setMessage] = useState('Listo'); const project = useProjectStore(); const replacements = window.location.pathname === '/maintenance/replacements'
  const save = (saveAs = false) => { const result = saveAs ? saveProjectFileAs() : saveProjectFile(); if (result) setMessage(result.message) }
  const open = async (file?: File) => { if (!file) return; try { setMessage((await openProjectFile(file)).message) } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo abrir') } }
  return <><AppNavigation active="MAINTENANCE" /><header className="maintenance-topbar"><div className="maintenance-title"><strong>LACO 1 Maintenance</strong><small>{project.metadata.name}{project.isDirty ? ' *' : ''}</small></div><nav className="maintenance-module-nav"><button className={!replacements ? 'active' : ''} onClick={() => navigate('/maintenance/twin')}>Twin</button><button className={replacements ? 'active' : ''} onClick={() => navigate('/maintenance/replacements')}>Recambios</button></nav>{!replacements && <div className="maintenance-global-search"><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar equipo, ID, posición, OT SAP..." />{query && <button onClick={() => onQueryChange('')}>×</button>}</div>}<div className="maintenance-file-actions"><button onClick={() => fileRef.current?.click()}>Abrir</button><button onClick={() => save(false)}>Guardar</button><button onClick={() => save(true)}>Guardar como</button></div><span className="maintenance-save-status">{message}</span><input ref={fileRef} hidden type="file" accept=".laco3d,.json,application/json" onChange={(event) => { void open(event.target.files?.[0]); event.target.value = '' }} /></header></>
}

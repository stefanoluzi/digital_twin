import { useEffect, useRef, useState } from 'react'
import { HttpCriticalSparesRepository, SparesApiError, type CentralSparesState } from '../spares/repositories/HttpCriticalSparesRepository'
import type { CriticalSparesConfig } from '../spares/types'
import { createUuid } from '../spares/domain/createUuid'
import { ModuleLoading } from './ux/LoadingFeedback'
import './generalConfiguration.css'

const repository = new HttpCriticalSparesRepository()

export default function GeneralConfiguration() {
  const [state, setState] = useState<CentralSparesState>()
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState('')
  const [stale, setStale] = useState(false)
  const [notice, setNotice] = useState('')
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string>()
  const [editedName, setEditedName] = useState('')

  async function load() {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { setState(await repository.load()); setStale(false) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la configuración.') }
    finally { lock.current = false; setBusy(false) }
  }
  useEffect(() => { void load() }, [])
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(timer) } }, [notice])

  async function save(config: CriticalSparesConfig): Promise<boolean> {
    if (!state || lock.current || stale) return false
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      setState(await repository.updateConfig(config, state.revision))
      setNotice('Cambios guardados. Se aplican al catálogo compartido de la planta.')
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la configuración.')
      if (e instanceof SparesApiError && [0, 409, 428].includes(e.status)) setStale(true)
      return false
    } finally { lock.current = false; setBusy(false) }
  }

  const config = state?.data.config
  return <main className="general-configuration ux-enter">
    <a href="/">← Inicio</a>
    <header><small>ADMINISTRACIÓN DE PLANTA</small><h1>Configuración general</h1><p>Responsables GMB y áreas a cargo, compartidos por todos los módulos.</p></header>
    {error && <div className="general-config-error" role="alert">{error}{(!state || stale) && <button disabled={busy} onClick={() => void load()}>Recargar configuración</button>}</div>}
    <div role="status" aria-live="polite">{busy && state ? 'Guardando / consultando configuración…' : notice}</div>
    {!config && !error ? <ModuleLoading title="Configuración general" /> : config && <fieldset disabled={busy || stale}>
      <section><h2>Responsables GMB</h2><p>Reasigná sus áreas antes de inactivarlos. Los inactivos se conservan para trazabilidad y no aparecen en la cobertura.</p>
        <form className="general-config-add" onSubmit={async (event) => { event.preventDefault(); const value = name.trim(); if (!value) return; if (await save({ ...config, responsibles: [...config.responsibles, { id: `responsible-${createUuid()}`, name: value, active: true }] })) setName('') }}>
          <label>Nuevo responsable<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" /></label><button type="submit">Agregar GMB</button>
        </form>
        <div className="general-config-table"><table><thead><tr><th>Responsable</th><th>Áreas a cargo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
          {config.responsibles.map((person) => {
            const areas = config.areas.filter((area) => area.responsibleGmbId === person.id)
            return <tr key={person.id}><td>{editing === person.id ? <input aria-label={`Nombre de ${person.name}`} value={editedName} onChange={(e) => setEditedName(e.target.value)} /> : person.name}</td>
              <td>{areas.length ? areas.map((area) => <span className="general-area-chip" key={area.id}>{area.code}</span>) : 'Sin áreas a cargo'}</td><td>{person.active ? 'Activo' : 'Inactivo'}</td>
              <td><div className="general-config-actions">{editing === person.id ? <><button disabled={!editedName.trim()} onClick={async () => { if (await save({ ...config, responsibles: config.responsibles.map((p) => p.id === person.id ? { ...p, name: editedName.trim() } : p) })) setEditing(undefined) }}>Guardar nombre</button><button onClick={() => setEditing(undefined)}>Cancelar</button></> : <button onClick={() => { setEditing(person.id); setEditedName(person.name) }}>Editar nombre</button>}
                <button disabled={person.active && areas.length > 0} title={person.active && areas.length ? 'Reasigná primero las áreas en la tabla inferior' : undefined} onClick={() => void save({ ...config, responsibles: config.responsibles.map((p) => p.id === person.id ? { ...p, active: !p.active } : p) })}>{person.active ? 'Inactivar' : 'Activar'}</button>
                {!person.active && !areas.length && <button onClick={() => { if (confirm(`¿Eliminar definitivamente a ${person.name}? Solo es posible si no tiene registros vinculados.`)) void save({ ...config, responsibles: config.responsibles.filter((p) => p.id !== person.id) }) }}>Eliminar</button>}
              </div></td></tr>
          })}
          {!config.responsibles.length && <tr><td colSpan={4}>Agregá el primer responsable para asignarle áreas.</td></tr>}
        </tbody></table></div>
        <p>Solo se pueden eliminar responsables inactivos sin registros vinculados. Las asignaciones históricas de Taller y REX no se modifican al reasignar un área.</p>
      </section>
      <section><h2>Áreas y responsables</h2><p>Cada área tiene un responsable GMB actual. Un responsable puede abarcar varias áreas. Los cambios se guardan al seleccionar.</p>
        <div className="general-config-table"><table><thead><tr><th>Área</th><th>Nombre</th><th>Responsable GMB</th></tr></thead><tbody>{config.areas.map((area) => <tr key={area.id}><td><strong>{area.code}</strong></td><td>{area.name}</td><td>
          <select aria-label={`Responsable de ${area.code}`} value={area.responsibleGmbId || ''} onChange={(e) => void save({ ...config, areas: config.areas.map((a) => a.id === area.id ? { ...a, responsibleGmbId: e.target.value, migrationCandidateIds: undefined } : a) })}>
            <option value="" disabled>Seleccionar GMB…</option>{config.responsibles.filter((p) => p.active || p.id === area.responsibleGmbId).map((p) => <option key={p.id} value={p.id} disabled={!p.active}>{p.name}{!p.active ? ' (inactivo)' : ''}</option>)}
          </select>{Boolean(area.migrationCandidateIds?.length) && <small>Asignación anterior ambigua: seleccioná el responsable actual.</small>}
        </td></tr>)}</tbody></table></div>
      </section>
    </fieldset>}
  </main>
}

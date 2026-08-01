import type { DigitalTwinProject } from '../types/project'
import { normalizeProjectFile } from './projectSerializer'

export function parseProjectFile(text: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('El archivo seleccionado no es una sesion valida de LACO3D.')
  }
  return normalizeProjectFile(parsed)
}

export function serializeProject(project: DigitalTwinProject) {
  return JSON.stringify(project, null, 2)
}

export function estimateProjectSize(text: string) {
  return new Blob([text]).size
}

export function sanitizeProjectFileName(name: string) {
  const safe = name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\s+/g, '_') || 'proyecto-laco3d'
  return safe.toLowerCase().endsWith('.laco3d') ? safe : `${safe}.laco3d`
}

export function downloadProjectFile(text: string, fileName: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = sanitizeProjectFileName(fileName)
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

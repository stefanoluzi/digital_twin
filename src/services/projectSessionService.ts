import { useMaintenanceStore } from '../maintenance/store/maintenanceStore'
import { useProjectStore } from '../store/projectStore'
import { useSceneStore } from '../store/sceneStore'
import { createProjectFile, projectToMaintenanceData, projectToSceneDocument } from './projectSerializer'
import { downloadProjectFile, estimateProjectSize, parseProjectFile, sanitizeProjectFileName, serializeProject } from './projectFileService'

export interface ProjectSessionResult { message: string; size?: number }

export function confirmDiscardProjectChanges() { return !useProjectStore.getState().isDirty || window.confirm('Hay cambios sin guardar. ¿Deseas descartarlos?') }

export async function openProjectFile(file: File): Promise<ProjectSessionResult> {
  if (!confirmDiscardProjectChanges()) throw new Error('Apertura cancelada.')
  const document = parseProjectFile(await file.text()); const projects = useProjectStore.getState()
  projects.beginHydration()
  try { useSceneStore.getState().loadScene(projectToSceneDocument(document)); useMaintenanceStore.getState().loadMaintenance(projectToMaintenanceData(document)); projects.replaceProject(document.project, document.scene.camera, file.name) } finally { projects.endHydration() }
  return { message: 'Sesión LACO3D abierta' }
}

export function saveProjectFile(): ProjectSessionResult | null { return save(false) }
export function saveProjectFileAs(): ProjectSessionResult | null { return save(true) }

function save(saveAs: boolean): ProjectSessionResult | null {
  const projects = useProjectStore.getState(); let name = projects.metadata.name
  if (saveAs || !projects.fileName) { const requested = window.prompt('Nombre del proyecto', name); if (requested === null) return null; name = requested.trim() || 'Proyecto LACO3D' }
  const scene = useSceneStore.getState(); const metadata = { ...projects.metadata, name, updatedAt: new Date().toISOString() }
  const document = createProjectFile({ objects: scene.objects, referenceLayout: scene.referenceLayout, snap: scene.snap, view: scene.view, plantLevels: scene.plantLevels, activeLevel: scene.activeLevel, visibleLevelFilter: scene.visibleLevelFilter, showLevel0Grid: scene.showLevel0Grid, showLevel1Grid: scene.showLevel1Grid }, metadata, projects.camera, useMaintenanceStore.getState().exportMaintenance())
  const text = serializeProject(document); const size = estimateProjectSize(text)
  if (size > 50 * 1024 * 1024 && !window.confirm(`La sesión ocupa ${(size / 1024 / 1024).toFixed(1)} MB. ¿Deseas continuar?`)) return null
  const fileName = sanitizeProjectFileName(saveAs || !projects.fileName ? name : projects.fileName); downloadProjectFile(text, fileName); projects.markSaved(fileName, document.project)
  return { message: `Sesión guardada (${(size / 1024 / 1024).toFixed(1)} MB)`, size }
}

export function createNewProjectSession(): ProjectSessionResult | null {
  if (!confirmDiscardProjectChanges()) return null
  const projects = useProjectStore.getState(); projects.beginHydration()
  try { useSceneStore.getState().resetProject(); useMaintenanceStore.getState().resetMaintenance(); projects.createNewProject() } finally { projects.endHydration() }
  return { message: 'Nuevo proyecto creado' }
}

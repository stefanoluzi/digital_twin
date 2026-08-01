import { PROJECT_FORMAT, PROJECT_SCHEMA_VERSION, type DigitalTwinProject } from '../types/project'

export function validateProjectFile(data: unknown): asserts data is DigitalTwinProject {
  if (!data || typeof data !== 'object') throw new Error('El archivo seleccionado no es una sesion valida de LACO3D.')
  const project = data as Partial<DigitalTwinProject>
  if (project.format !== PROJECT_FORMAT) throw new Error('El archivo seleccionado no es una sesion valida de LACO3D.')
  if (project.schemaVersion !== PROJECT_SCHEMA_VERSION) throw new Error(`Version de sesion no soportada: ${String(project.schemaVersion)}.`)
  if (!project.scene || typeof project.scene !== 'object' || !Array.isArray(project.scene.objects)) {
    throw new Error('La sesion LACO3D no contiene una escena valida.')
  }
  if (!project.project || typeof project.project !== 'object') throw new Error('La sesion LACO3D no contiene metadatos de proyecto.')
}

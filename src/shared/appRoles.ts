export type ApplicationRole = 'EDITOR' | 'MAINTENANCE'

export const MODULE_ACCESS: Record<ApplicationRole, readonly string[]> = {
  EDITOR: ['/editor'],
  MAINTENANCE: ['/maintenance'],
}

import { MenuSection, ToolbarMenu } from './ToolbarMenu'

export function FileMenu({ open, onToggle, onAction, onNew, onOpen, onSave, onSaveAs, onImportLayout, onExportJson, onImportJson }: {
  open: boolean
  onToggle: (id: string) => void
  onAction: (action: () => void) => void
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  onImportLayout: () => void
  onExportJson: () => void
  onImportJson: () => void
}) {
  return (
    <ToolbarMenu id="file" label="Archivo" title="Proyecto e intercambio de archivos" open={open} onToggle={onToggle}>
      <MenuSection title="Proyecto">
        <button role="menuitem" onClick={() => onAction(onNew)}>Nuevo proyecto</button>
        <button role="menuitem" onClick={() => onAction(onOpen)}>Abrir sesión…</button>
        <button role="menuitem" onClick={() => onAction(onSave)}>Guardar sesión</button>
        <button role="menuitem" onClick={() => onAction(onSaveAs)}>Guardar sesión como…</button>
      </MenuSection>
      <MenuSection title="Intercambio">
        <button role="menuitem" onClick={() => onAction(onImportLayout)}>Importar Layout…</button>
        <button role="menuitem" onClick={() => onAction(onExportJson)}>Exportar JSON</button>
        <button role="menuitem" onClick={() => onAction(onImportJson)}>Importar JSON…</button>
      </MenuSection>
    </ToolbarMenu>
  )
}

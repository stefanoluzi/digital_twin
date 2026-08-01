import { MenuSection, ToolbarMenu } from './ToolbarMenu'

export function EditMenu({ open, canCopy, canPaste, onToggle, onAction, onCopy, onPaste }: {
  open: boolean
  canCopy: boolean
  canPaste: boolean
  onToggle: (id: string) => void
  onAction: (action: () => void) => void
  onCopy: () => void
  onPaste: () => void
}) {
  return (
    <ToolbarMenu id="edit" label="Editar" title="Acciones de edición" open={open} onToggle={onToggle}>
      <MenuSection title="Portapapeles">
        <button role="menuitem" disabled={!canCopy} title="Copiar selección (Ctrl+C)" onClick={() => onAction(onCopy)}>Copiar <kbd>Ctrl+C</kbd></button>
        <button role="menuitem" disabled={!canPaste} title="Pegar objetos (Ctrl+V)" onClick={() => onAction(onPaste)}>Pegar <kbd>Ctrl+V</kbd></button>
      </MenuSection>
    </ToolbarMenu>
  )
}

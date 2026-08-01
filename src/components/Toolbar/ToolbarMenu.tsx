import type { ReactNode } from 'react'

export function ToolbarMenu({ id, label, title, open, active = false, disabled = false, align = 'left', onToggle, children }: {
  id: string
  label: string
  title: string
  open: boolean
  active?: boolean
  disabled?: boolean
  align?: 'left' | 'right'
  onToggle: (id: string) => void
  children: ReactNode
}) {
  return (
    <div className={`toolbar-menu toolbar-menu--${align}`}>
      <button
        type="button"
        className={active || open ? 'active' : undefined}
        disabled={disabled}
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => { event.stopPropagation(); onToggle(id) }}
      >
        {label} <span aria-hidden="true" className="menu-caret">▾</span>
      </button>
      {open && <div className="toolbar-popover" role="menu" onPointerDown={(event) => event.stopPropagation()}>{children}</div>}
    </div>
  )
}

export function MenuSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="toolbar-menu-section"><strong>{title}</strong>{children}</section>
}

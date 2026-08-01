import type { EditMode } from '../../types/plant'

export function TransformModeControl({ mode, onChange }: { mode: EditMode; onChange: (mode: EditMode) => void }) {
  return (
    <div className="toolbar-segmented" role="group" aria-label="Modo de transformación">
      {([['move', 'Mover'], ['rotate', 'Rotar'], ['scale', 'Escalar']] as const).map(([value, label]) => (
        <button key={value} className={mode === value ? 'active' : undefined} aria-pressed={mode === value} title={`${label} objeto`} onClick={() => onChange(value)}>{label}</button>
      ))}
    </div>
  )
}

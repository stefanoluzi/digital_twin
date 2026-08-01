import { useEffect, useRef, useState } from 'react'

interface ValidatedNumberInputProps {
  value: number
  onCommit: (value: number) => void
  min?: number
  max?: number
  step?: number
  integer?: boolean
  unit?: string
  disabled?: boolean
  resetKey?: string | number
  ariaLabel?: string
  autoFocus?: boolean
  validate?: (value: number) => string
}

function formatValue(value: number) {
  return Number.isFinite(value) ? String(value) : ''
}

export function getNumberValidationMessage(draft: string, min?: number, max?: number, integer?: boolean, unit?: string) {
  const trimmed = draft.trim()
  if (!trimmed) return 'Este valor es obligatorio.'
  const normalized = trimmed.replace(',', '.')
  const value = Number(normalized)
  if (!Number.isFinite(value)) return 'Ingresá un número válido.'
  if (integer && !Number.isInteger(value)) return 'Debe ser un número entero.'
  if (min !== undefined && value < min) {
    if (min > 0 && value <= 0) return 'Debe ser mayor que 0.'
    return `Debe ser como mínimo ${min}${unit ? ` ${unit}` : ''}.`
  }
  if (max !== undefined && value > max) {
    if (min !== undefined) return `Debe estar entre ${min} y ${max}${unit ? ` ${unit}` : ''}.`
    return `Debe ser como máximo ${max}${unit ? ` ${unit}` : ''}.`
  }
  return ''
}

export function ValidatedNumberInput({
  value,
  onCommit,
  min,
  max,
  step,
  integer = false,
  unit,
  disabled = false,
  resetKey,
  ariaLabel,
  autoFocus = false,
  validate,
}: ValidatedNumberInputProps) {
  const [draft, setDraft] = useState(() => formatValue(value))
  const [error, setError] = useState('')
  const focusedRef = useRef(false)
  const cancelBlurRef = useRef(false)

  useEffect(() => {
    if (focusedRef.current) return
    setDraft(formatValue(value))
    setError('')
  }, [value])

  useEffect(() => {
    focusedRef.current = false
    cancelBlurRef.current = false
    setDraft(formatValue(value))
    setError('')
  }, [resetKey])

  const validationMessage = (nextDraft: string) => {
    const baseError = getNumberValidationMessage(nextDraft, min, max, integer, unit)
    if (baseError) return baseError
    return validate?.(Number(nextDraft.trim().replace(',', '.'))) ?? ''
  }

  const commit = () => {
    const nextError = validationMessage(draft)
    setError(nextError)
    if (nextError) return false
    const nextValue = Number(draft.trim().replace(',', '.'))
    setDraft(formatValue(nextValue))
    onCommit(nextValue)
    return true
  }

  return (
    <div className={`numeric-field${error ? ' numeric-field--error' : ''}`}>
      <input
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        aria-label={ariaLabel}
        aria-invalid={Boolean(error)}
        autoFocus={autoFocus}
        disabled={disabled}
        value={draft}
        data-step={step}
        onFocus={() => { focusedRef.current = true }}
        onChange={(event) => {
          const nextDraft = event.currentTarget.value
          setDraft(nextDraft)
          setError(validationMessage(nextDraft))
        }}
        onBlur={() => {
          focusedRef.current = false
          if (cancelBlurRef.current) {
            cancelBlurRef.current = false
            return
          }
          commit()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            if (commit()) {
              cancelBlurRef.current = true
              event.currentTarget.blur()
            }
          } else if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            cancelBlurRef.current = true
            focusedRef.current = false
            setDraft(formatValue(value))
            setError('')
            event.currentTarget.blur()
          }
        }}
      />
      {error && <span className="numeric-field__message">{error}</span>}
    </div>
  )
}

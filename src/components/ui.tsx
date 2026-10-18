import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

/** Panneau qui monte du bas de l'écran. */
export function Sheet({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [onClose])
  // Rendu dans <body> : un parent avec backdrop-filter piégerait le position: fixed.
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/** Fenêtre de confirmation (les dialogues natifs ne marchent pas partout). */
export function Confirm({
  title,
  message,
  confirmLabel = 'Confirmer',
  danger,
  onConfirm,
  onCancel,
}: {
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm(): void
  onCancel(): void
}) {
  return (
    <Sheet title={title} onClose={onCancel}>
      <p className="muted">{message}</p>
      <div className="row-actions">
        <button className="btn" onClick={onCancel}>
          Annuler
        </button>
        <button className={danger ? 'btn danger' : 'btn primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size,
}: {
  value: T | undefined
  options: { value: T; label: ReactNode; tone?: 'win' | 'loss' | 'draw' }[]
  onChange(v: T): void
  size?: 'sm'
}) {
  return (
    <div className={`segmented ${size ?? ''}`} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`seg ${value === o.value ? 'on' : ''} ${o.tone ?? ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chips({
  options,
  selected,
  onToggle,
}: {
  options: { id: string; name: string; hint?: 'win' | 'loss' | 'both' }[]
  selected: string[]
  onToggle(id: string): void
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`chip ${selected.includes(o.id) ? 'on' : ''} ${o.hint ?? ''}`}
          aria-pressed={selected.includes(o.id)}
          onClick={() => onToggle(o.id)}
        >
          {o.name}
        </button>
      ))}
    </div>
  )
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 20,
  label,
}: {
  value: number | undefined
  onChange(v: number | undefined): void
  min?: number
  max?: number
  label: string
}) {
  return (
    <div className="stepper" aria-label={label}>
      <button type="button" onClick={() => onChange(value == null ? min : Math.max(min, value - 1))} aria-label={`${label} moins`}>
        −
      </button>
      <input
        inputMode="numeric"
        value={value ?? ''}
        placeholder="–"
        aria-label={label}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '')
          onChange(v === '' ? undefined : Math.min(max, Number(v)))
        }}
      />
      <button type="button" onClick={() => onChange(value == null ? 8 : Math.min(max, value + 1))} aria-label={`${label} plus`}>
        +
      </button>
    </div>
  )
}

/** Sélecteur dans une liste (légendes, battlefields…) avec recherche et ajout rapide. */
export function PickerField({
  label,
  value,
  items,
  onChange,
  onAdd,
  placeholder = 'Choisir…',
  allowClear,
}: {
  label: string
  value: string | undefined
  items: { id: string; name: string; sub?: string }[]
  onChange(id: string | undefined): void
  onAdd?(name: string): string
  placeholder?: string
  allowClear?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const current = items.find((i) => i.id === value)
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase()
    return n ? items.filter((i) => i.name.toLowerCase().includes(n) || i.sub?.toLowerCase().includes(n)) : items
  }, [items, q])
  const exact = items.some((i) => i.name.toLowerCase() === q.trim().toLowerCase())
  const close = () => {
    setOpen(false)
    setQ('')
  }
  return (
    <>
      <button type="button" className={`picker ${current ? '' : 'empty'}`} onClick={() => setOpen(true)}>
        <span className="picker-label">{label}</span>
        <span className="picker-value">{current ? current.name : placeholder}</span>
        {current?.sub && <span className="picker-sub">{current.sub}</span>}
      </button>
      {open && (
        <Sheet title={label} onClose={close}>
          <div className="search">
            <Icon name="search" size={18} />
            <input autoFocus placeholder="Rechercher ou ajouter…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="pick-grid">
            {allowClear && (
              <button
                className="pick muted"
                onClick={() => {
                  onChange(undefined)
                  close()
                }}
              >
                Aucun
              </button>
            )}
            {filtered.map((i) => (
              <button
                key={i.id}
                className={`pick ${i.id === value ? 'on' : ''}`}
                onClick={() => {
                  onChange(i.id)
                  close()
                }}
              >
                {i.name}
                {i.sub && <small>{i.sub}</small>}
              </button>
            ))}
          </div>
          {onAdd && q.trim() && !exact && (
            <button
              className="btn primary block"
              onClick={() => {
                onChange(onAdd(q.trim()))
                close()
              }}
            >
              <Icon name="plus" size={18} /> Ajouter « {q.trim()} »
            </button>
          )}
          {!filtered.length && !onAdd && <p className="muted">Aucun résultat.</p>}
        </Sheet>
      )}
    </>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children}
    </div>
  )
}

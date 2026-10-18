import type { CustomField, CustomValue, CustomValues } from '../data/schema'
import { Chips, Field } from './ui'

function FieldInput({ field, value, onChange }: { field: CustomField; value: CustomValue | undefined; onChange(v: CustomValue | undefined): void }) {
  switch (field.type) {
    case 'text':
      return <input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />
    case 'number':
      return (
        <input
          inputMode="decimal"
          value={value == null ? '' : String(value)}
          onChange={(e) => {
            const v = e.target.value.replace(',', '.')
            onChange(v === '' || isNaN(Number(v)) ? undefined : Number(v))
          }}
        />
      )
    case 'boolean':
      return (
        <div className="segmented sm">
          {[
            [true, 'Oui'],
            [false, 'Non'],
          ].map(([v, label]) => (
            <button
              key={String(v)}
              type="button"
              className={`seg ${value === v ? 'on' : ''}`}
              onClick={() => onChange(value === v ? undefined : (v as boolean))}
            >
              {label as string}
            </button>
          ))}
        </div>
      )
    case 'select':
      return (
        <Chips
          options={field.options.map((o) => ({ id: o, name: o }))}
          selected={value ? [value as string] : []}
          onToggle={(o) => onChange(value === o ? undefined : o)}
        />
      )
    case 'tags': {
      const arr = Array.isArray(value) ? value : []
      return (
        <Chips
          options={field.options.map((o) => ({ id: o, name: o }))}
          selected={arr}
          onToggle={(o) => {
            const next = arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]
            onChange(next.length ? next : undefined)
          }}
        />
      )
    }
  }
}

/** Affiche tous les champs personnalisés d'une portée (match ou game). */
export function CustomFieldsForm({
  fields,
  values,
  onChange,
}: {
  fields: CustomField[]
  values: CustomValues
  onChange(values: CustomValues): void
}) {
  if (!fields.length) return null
  return (
    <div className="custom-fields">
      {fields.map((f) => (
        <Field key={f.id} label={`★ ${f.label}`}>
          <FieldInput
            field={f}
            value={values[f.id]}
            onChange={(v) => {
              const next = { ...values }
              if (v === undefined) delete next[f.id]
              else next[f.id] = v
              onChange(next)
            }}
          />
        </Field>
      ))}
    </div>
  )
}

export function formatCustomValue(v: CustomValue): string {
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  return String(v)
}

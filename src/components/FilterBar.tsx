import { useState } from 'react'
import { useStore } from '../data/store'
import { deckLabel } from '../data/matchUtils'
import { DEFAULT_FILTERS, PERIOD_LABEL, filtersActive, filtersSummary, type Period } from '../stats/filters'
import { Chips, Segmented, Sheet } from './ui'
import { Icon } from './Icon'

const toggle = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])

export function FilterBar({ count }: { count: number }) {
  const { data, filters, setFilters } = useStore()
  const [open, setOpen] = useState(false)
  const active = filtersActive(filters)
  return (
    <>
      <div className="filter-bar">
        <button className={`filter-btn ${active ? 'active' : ''}`} onClick={() => setOpen(true)}>
          <Icon name="filter" size={16} />
          <span>{filtersSummary(data, filters)}</span>
        </button>
        <span className="muted small">{count} matchs</span>
        {active && (
          <button className="link small" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Réinitialiser
          </button>
        )}
      </div>
      {open && (
        <Sheet title="Filtres" onClose={() => setOpen(false)}>
          <span className="field-label">Période</span>
          <Segmented<Period>
            size="sm"
            value={filters.period}
            options={(Object.keys(PERIOD_LABEL) as Period[]).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))}
            onChange={(period) => setFilters({ ...filters, period })}
          />
          <span className="field-label">Types de tournoi</span>
          <Chips
            options={data.tournamentTypes}
            selected={filters.tournamentTypeIds}
            onToggle={(id) => setFilters({ ...filters, tournamentTypeIds: toggle(filters.tournamentTypeIds, id) })}
          />
          <span className="field-label">Mes decks</span>
          {data.decks.length ? (
            <Chips
              options={data.decks.map((d) => ({ id: d.id, name: deckLabel(data, d.id) }))}
              selected={filters.myDeckIds}
              onToggle={(id) => setFilters({ ...filters, myDeckIds: toggle(filters.myDeckIds, id) })}
            />
          ) : (
            <p className="muted small">Aucun deck.</p>
          )}
          <div className="row-actions">
            <button className="btn" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Tout effacer
            </button>
            <button className="btn primary" onClick={() => setOpen(false)}>
              Voir les stats
            </button>
          </div>
        </Sheet>
      )}
    </>
  )
}

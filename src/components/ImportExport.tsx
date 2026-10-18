import { useRef, useState } from 'react'
import { useStore } from '../data/store'
import { backupSummary, parseBackup, serializeBackup } from '../data/backup'
import { serializeAiExport } from '../data/aiExport'
import { copyText, shareOrDownload, downloadFile } from '../data/storage'
import type { AppData } from '../data/schema'
import { todayISO } from '../data/ids'
import { applyFilters, filtersActive, filtersSummary } from '../stats/filters'
import { Sheet } from './ui'
import { Icon } from './Icon'
import { toast } from './toast'

export function formatDate(iso?: string): string {
  if (!iso) return 'jamais'
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function daysSince(iso?: string): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

/** Les deux boutons Exporter / Importer, réutilisés dans l'en-tête et les réglages. */
export function ImportExportButtons({ compact }: { compact?: boolean }) {
  const [mode, setMode] = useState<'export' | 'import' | null>(null)
  return (
    <>
      <div className={compact ? 'ie-buttons compact' : 'ie-buttons'}>
        <button className={compact ? 'icon-btn' : 'btn'} onClick={() => setMode('export')} aria-label="Exporter">
          <Icon name="upload" size={compact ? 20 : 18} />
          {!compact && 'Exporter'}
        </button>
        <button className={compact ? 'icon-btn' : 'btn'} onClick={() => setMode('import')} aria-label="Importer">
          <Icon name="download" size={compact ? 20 : 18} />
          {!compact && 'Importer'}
        </button>
      </div>
      {mode === 'export' && <ExportSheet onClose={() => setMode(null)} />}
      {mode === 'import' && <ImportSheet onClose={() => setMode(null)} />}
    </>
  )
}

function ExportSheet({ onClose }: { onClose(): void }) {
  const { data, filters, markExported } = useStore()
  const [aiScope, setAiScope] = useState<'all' | 'filtered'>('all')
  const date = todayISO()
  const hasFilter = filtersActive(filters)
  const aiMatches = aiScope === 'filtered' ? applyFilters(data.matches, filters) : data.matches

  const backup = async () => {
    const res = await shareOrDownload(`riftbound-sauvegarde-${date}.json`, serializeBackup(data))
    if (res !== 'cancelled') {
      markExported()
      toast(res === 'shared' ? 'Sauvegarde partagée' : 'Sauvegarde téléchargée')
    }
  }
  const aiText = () => serializeAiExport(data, aiMatches)

  return (
    <Sheet title="Exporter" onClose={onClose}>
      <section className="export-block">
        <h3>Sauvegarde complète</h3>
        <p className="muted">
          Tout le contenu de l’appli ({data.matches.length} match{data.matches.length > 1 ? 's' : ''}, decks, réglages). À garder dans tes fichiers ou ton
          cloud pour récupérer tes données plus tard (ou sur un autre téléphone). Dernier export : {formatDate(data.meta.lastExportAt)}.
        </p>
        <button className="btn primary block" onClick={backup}>
          <Icon name="share" size={18} /> Enregistrer la sauvegarde (.json)
        </button>
      </section>

      <section className="export-block">
        <h3>
          <Icon name="sparkle" size={18} /> Pour une IA
        </h3>
        <p className="muted">
          Version lisible avec les noms en clair, un résumé des stats et une consigne d’analyse. Colle-la dans Claude ou
          une autre IA pour une analyse détaillée. Ce format ne sert pas à restaurer tes données.
        </p>
        {hasFilter && (
          <div className="segmented sm" role="radiogroup">
            <button className={`seg ${aiScope === 'all' ? 'on' : ''}`} onClick={() => setAiScope('all')}>
              Tous ({data.matches.length})
            </button>
            <button className={`seg ${aiScope === 'filtered' ? 'on' : ''}`} onClick={() => setAiScope('filtered')}>
              Filtre : {filtersSummary(data, filters)}
            </button>
          </div>
        )}
        <div className="row-actions">
          <button
            className="btn primary"
            onClick={async () => toast((await copyText(aiText())) ? 'Copié ! Colle-le dans ton chat IA' : 'Copie impossible')}
          >
            <Icon name="copy" size={18} /> Copier
          </button>
          <button
            className="btn"
            onClick={async () => {
              const res = await shareOrDownload(`riftbound-ia-${date}.json`, aiText())
              if (res === 'downloaded') toast('Fichier téléchargé')
            }}
          >
            <Icon name="share" size={18} /> Partager
          </button>
          <button className="btn" onClick={() => downloadFile(`riftbound-ia-${date}.json`, aiText())}>
            <Icon name="download" size={18} /> Fichier
          </button>
        </div>
      </section>
    </Sheet>
  )
}

function ImportSheet({ onClose }: { onClose(): void }) {
  const { data, replaceAll, mergeIn } = useStore()
  const input = useRef<HTMLInputElement>(null)
  const [incoming, setIncoming] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      setIncoming(parseBackup(await file.text()))
    } catch (e) {
      setIncoming(null)
      setError((e as Error).message)
    }
  }
  const summary = incoming ? backupSummary(incoming) : null
  const newMatches = incoming ? incoming.matches.filter((m) => !data.matches.some((x) => x.id === m.id)).length : 0

  return (
    <Sheet title="Importer" onClose={onClose}>
      <p className="muted">Choisis un fichier de sauvegarde (.json) exporté depuis l’appli.</p>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <button className="btn block" onClick={() => input.current?.click()}>
        <Icon name="download" size={18} /> Choisir un fichier
      </button>
      {error && <p className="error">{error}</p>}
      {incoming && summary && (
        <div className="import-preview">
          <p>
            <strong>{summary.matches} matchs</strong>
            {summary.from && (
              <>
                {' '}
                du {summary.from} au {summary.to}
              </>
            )}
            , {incoming.decks.length} decks. Dont <strong>{newMatches}</strong> nouveaux matchs par rapport à tes données.
          </p>
          {!confirmReplace ? (
            <div className="stack">
              <button
                className="btn primary block"
                onClick={() => {
                  mergeIn(incoming)
                  toast(`Fusion faite : ${newMatches} matchs ajoutés`)
                  onClose()
                }}
              >
                Fusionner avec mes données
              </button>
              <button className="btn danger block" onClick={() => setConfirmReplace(true)}>
                Remplacer toutes mes données
              </button>
            </div>
          ) : (
            <div className="confirm-inline">
              <p>
                Tes {data.matches.length} matchs actuels seront effacés et remplacés. Pense à exporter une sauvegarde
                avant si besoin.
              </p>
              <div className="row-actions">
                <button className="btn" onClick={() => setConfirmReplace(false)}>
                  Annuler
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    replaceAll(incoming)
                    toast('Données remplacées')
                    onClose()
                  }}
                >
                  Remplacer
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}

import { useRoute, navigate } from './router'
import { MatchList } from './screens/MatchList'
import { MatchForm } from './screens/MatchForm'
import { MatchDetail } from './screens/MatchDetail'
import { Analysis } from './screens/analysis/Analysis'
import { MatchupDetail } from './screens/analysis/MatchupDetail'
import { Settings } from './screens/Settings'
import { Companion } from './screens/Companion'
import { Icon } from './components/Icon'
import { ToastHost } from './components/toast'

function Screen({ parts }: { parts: string[] }) {
  const [a, b, c] = parts
  switch (a) {
    case 'new':
      return <MatchForm key="new" />
    case 'match':
      return c === 'edit' ? <MatchForm key={`edit-${b}`} matchId={b} /> : <MatchDetail matchId={b} />
    case 'analysis':
      return <Analysis tab={b} />
    case 'matchup':
      return <MatchupDetail legendId={b} />
    case 'settings':
      return <Settings />
    case 'play':
      return <Companion />
    default:
      return <MatchList />
  }
}

const TABS = [
  { id: 'matches', label: 'Matchs', icon: 'list', match: ['matches', 'match', undefined] },
  { id: 'play', label: 'Partie', icon: 'swords', match: ['play'] },
  { id: 'new', label: 'Nouveau', icon: 'plus', match: ['new'] },
  { id: 'analysis', label: 'Analyse', icon: 'chart', match: ['analysis', 'matchup'] },
  { id: 'settings', label: 'Réglages', icon: 'settings', match: ['settings'] },
]

export function App() {
  const parts = useRoute()
  const section = parts[0]
  const editing = section === 'new' || parts[2] === 'edit'
  return (
    <div className={`app ${editing ? 'editing' : ''}`}>
      <main>
        <Screen parts={parts} />
      </main>
      {!editing && (
        <nav className="tab-bar" aria-label="Navigation principale">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab-item ${t.id === 'new' ? 'cta' : ''} ${t.match.includes(section) ? 'on' : ''}`}
              onClick={() => navigate(t.id)}
              aria-current={t.match.includes(section) ? 'page' : undefined}
            >
              <span className="tab-icon">
                <Icon name={t.icon} size={t.id === 'new' ? 26 : 22} />
              </span>
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </nav>
      )}
      <ToastHost />
    </div>
  )
}

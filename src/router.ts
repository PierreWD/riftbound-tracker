import { useEffect, useState } from 'react'

/** Routage minimal par hash (#/matches, #/match/abc…), compatible hébergement statique. */
export function useRoute(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  const [parts, setParts] = useState(read)
  useEffect(() => {
    const onChange = () => {
      setParts(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return parts
}

export function navigate(path: string, replace = false) {
  const hash = '#/' + path.replace(/^\//, '')
  if (replace) {
    history.replaceState(null, '', hash)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = hash
  }
}

export function goBack(fallback: string) {
  if (history.length > 1) history.back()
  else navigate(fallback, true)
}

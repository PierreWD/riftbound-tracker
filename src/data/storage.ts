import { get, set } from 'idb-keyval'
import type { AppData } from './schema'
import { createDefaultData } from './defaults'
import { migrate } from './migrations'

const KEY = 'riftbound-data'

export async function loadData(): Promise<AppData> {
  const raw = await get(KEY)
  if (!raw) return createDefaultData()
  return migrate(raw)
}

export async function saveData(data: AppData): Promise<void> {
  await set(KEY, data)
}

/** Demande au navigateur de ne pas effacer les données en cas de manque de place. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

/** Partage un fichier (feuille de partage du téléphone) ou le télécharge. */
export async function shareOrDownload(filename: string, content: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([content], filename, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
      // sinon on retombe sur le téléchargement
    }
  }
  downloadFile(filename, content)
  return 'downloaded'
}

export function downloadFile(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // vieux navigateurs : textarea + execCommand
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

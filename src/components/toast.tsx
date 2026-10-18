import { useEffect, useState } from 'react'

type Listener = (msg: string) => void
const listeners = new Set<Listener>()

export function toast(msg: string) {
  listeners.forEach((l) => l(msg))
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const l: Listener = (m) => {
      setMsg(m)
      clearTimeout(timer)
      timer = setTimeout(() => setMsg(null), 2600)
    }
    listeners.add(l)
    return () => {
      listeners.delete(l)
      clearTimeout(timer)
    }
  }, [])
  if (!msg) return null
  return (
    <div className="toast" role="status">
      {msg}
    </div>
  )
}

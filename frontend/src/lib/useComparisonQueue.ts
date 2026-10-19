import { useEffect, useMemo, useReducer } from 'react'
import { saveComparison } from './api'
import { ComparisonQueue } from './comparisonQueue'
import { draftScope, getToken, subscribeToSession } from './session'

type Entry = { queue: ComparisonQueue; listeners: Set<() => void>; token: string | null }
// Keep the same writer across SPA navigation. A second queue could otherwise PUT an
// older DRAFT after a returning page has already submitted that comparison.
const queues = new Map<string, Entry>()
// Session cleanup remains active when the evaluation page is no longer mounted.
subscribeToSession(() => {
  for (const [key, value] of queues) {
    if (value.token !== getToken()) { value.queue.cancelTimers(); queues.delete(key) }
  }
})

export function useComparisonQueue(assignmentId: string) {
  const [, update] = useReducer((v: number) => v + 1, 0)
  const token = getToken()
  const entry = useMemo(() => {
    const key = `paireval.answers.${draftScope()}.${assignmentId}`
    const existing = queues.get(key)
    if (existing?.token === token) return existing
    let initial: Record<string, number> = {}
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '{}')
      if (stored && typeof stored === 'object') {
        initial = Object.fromEntries(Object.entries(stored).filter(([, value]) => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 6))
      }
    } catch { /* An unreadable draft must not prevent opening the assignment. */ }
    const listeners = new Set<() => void>()
    const queue = new ComparisonQueue(async (id, choice, timeOnTaskMs) => {
      if (!token || getToken() !== token) throw new Error('กรุณาเข้าสู่ระบบอีกครั้ง')
      return saveComparison(id, choice, timeOnTaskMs)
    }, () => { for (const listener of listeners) listener() }, (pending) => {
      if (getToken() !== token) return
      // No session tokens or names are written into the answer queue.
      if (Object.keys(pending).length) localStorage.setItem(key, JSON.stringify(pending))
      else localStorage.removeItem(key)
    }, initial)
    const created = { queue, listeners, token }
    queues.set(key, created)
    return created
  }, [assignmentId, token])

  useEffect(() => {
    const { queue, listeners } = entry
    listeners.add(update)
    const retry = () => { void queue.flush().catch(() => {}) }
    retry()
    window.addEventListener('online', retry)
    // Online events do not cover a temporary API outage while the connection stays up.
    const timer = window.setInterval(() => { void queue.retryFailed().catch(() => {}) }, 10000)
    return () => {
      listeners.delete(update)
      window.removeEventListener('online', retry)
      window.clearInterval(timer)
      queue.cancelTimers()
      // Persisted drafts survive navigation; also finish a pending save when possible.
      retry()
    }
  }, [entry])
  return entry.queue
}

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComparisonQueue } from './comparisonQueue'

afterEach(() => vi.useRealTimers())

describe('comparison save coordination (EVAL-001 / GAP-008)', () => {
  it('removes drafts belonging to retired pairs after a new generation is loaded', async () => {
    let finish!: () => void
    const save = vi.fn().mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    const persist = vi.fn()
    const queue = new ComparisonQueue(save, () => {}, persist, { retired: 6 })
    const pending = queue.flush()
    queue.retain(new Set(['current']))
    finish(); await pending
    expect(queue.drafts.size).toBe(0)
    expect(persist).toHaveBeenLastCalledWith({})
  })
  it('writes the newer choice even when the older in-flight request fails', async () => {
    let fail!: (error: Error) => void
    const save = vi.fn().mockImplementationOnce(() => new Promise<void>((_, reject) => { fail = reject })).mockResolvedValue({})
    const queue = new ComparisonQueue(save, () => {}, () => {})
    queue.select('pair', 1)
    const old = queue.flush().catch(() => {})
    queue.select('pair', 6)
    const current = queue.flush()
    fail(new Error('temporary outage'))
    await Promise.all([old, current])
    expect(save.mock.calls).toEqual([['pair', 1], ['pair', 6]])
    expect(queue.drafts.get('pair')).toMatchObject({ choice: 6, state: 'saved' })
    queue.cancelTimers()
  })
  it('reconciles acknowledged answers without deleting a new selection made during refresh', async () => {
    const queue = new ComparisonQueue(vi.fn().mockResolvedValue({}), () => {}, () => {})
    queue.select('pair', 1)
    await queue.flush()
    const snapshot = queue.savedSnapshot()
    queue.select('pair', 6)
    queue.reconcile(snapshot)
    expect(queue.drafts.get('pair')).toMatchObject({ choice: 6, state: 'pending' })
    await queue.flush()
    queue.reconcile(queue.savedSnapshot())
    expect(queue.drafts.size).toBe(0)
    queue.cancelTimers()
  })

  it('flushes a selection immediately, before the debounce can fire', async () => {
    vi.useFakeTimers()
    const save = vi.fn().mockResolvedValue({})
    const persist = vi.fn()
    const queue = new ComparisonQueue(save, () => {}, persist)
    queue.select('pair', 5)
    expect(save).not.toHaveBeenCalled()
    expect(persist).toHaveBeenLastCalledWith({ pair: 5 })
    await queue.flush()
    expect(save).toHaveBeenCalledWith('pair', 5)
    expect(queue.drafts.get('pair')?.state).toBe('saved')
    expect(persist).toHaveBeenLastCalledWith({})
  })

  it('serializes rapid changes while a previous save is still in flight', async () => {
    let finish!: () => void
    const save = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve })).mockResolvedValue({})
    const queue = new ComparisonQueue(save, () => {}, () => {})
    queue.select('pair', 1)
    const pending = queue.flush()
    queue.select('pair', 6)
    finish()
    await pending
    expect(save.mock.calls).toEqual([['pair', 1], ['pair', 6]])
    expect(queue.drafts.get('pair')).toMatchObject({ choice: 6, state: 'saved' })
    queue.cancelTimers()
  })

  it('retains a failed draft across reload, retries it and propagates failures to submit', async () => {
    const persist = vi.fn()
    const first = new ComparisonQueue(vi.fn().mockRejectedValue(new Error('offline')), () => {}, persist)
    first.select('pair', 3)
    await expect(first.flush()).rejects.toThrow('offline')
    expect(persist).toHaveBeenLastCalledWith({ pair: 3 })
    const save = vi.fn().mockResolvedValue({})
    const reloaded = new ComparisonQueue(save, () => {}, () => {}, persist.mock.lastCall?.[0])
    await reloaded.flush()
    expect(save).toHaveBeenCalledWith('pair', 3)
    first.cancelTimers()
  })
})

export type Draft = { choice: number; timeOnTaskMs?: number; state: 'pending' | 'saving' | 'saved' | 'error'; error?: string; retryable?: boolean }

/** One serial writer per comparison: an older response cannot overwrite a newer choice. */
export class ComparisonQueue {
  readonly drafts = new Map<string, Draft>()
  storageError = false
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private writes = new Map<string, Promise<void>>()

  constructor(
    private save: (id: string, choice: number, timeOnTaskMs?: number) => Promise<unknown>,
    private changed: () => void,
    private persist: (pending: Record<string, number>) => void,
    initial: Record<string, number> = {},
  ) {
    for (const [id, choice] of Object.entries(initial)) this.drafts.set(id, { choice, state: 'pending' })
  }

  select(id: string, choice: number, timeOnTaskMs?: number) {
    this.drafts.set(id, { choice, timeOnTaskMs, state: 'pending' })
    this.notify()
    clearTimeout(this.timers.get(id))
    this.timers.set(id, setTimeout(() => { void this.write(id).catch(() => {}) }, 2000))
  }

  private notify() {
    try {
      this.persist(Object.fromEntries([...this.drafts].filter(([, d]) => d.state !== 'saved').map(([id, d]) => [id, d.choice])))
      this.storageError = false
    } catch {
      this.storageError = true
    }
    this.changed()
  }

  private async write(id: string): Promise<void> {
    clearTimeout(this.timers.get(id))
    const existing = this.writes.get(id)
    if (existing) {
      try { await existing }
      catch (error) {
        // An older failed request must not strand a newer pending choice.
        if (this.drafts.get(id)?.state !== 'pending') throw error
      }
      return this.write(id)
    }
    const draft = this.drafts.get(id)
    if (!draft || draft.state === 'saved') return
    draft.state = 'saving'
    this.notify()
    const request = draft.timeOnTaskMs === undefined ? this.save(id, draft.choice) : this.save(id, draft.choice, draft.timeOnTaskMs)
    const operation = request.then(() => {
      if (this.drafts.get(id) === draft) draft.state = 'saved'
    }).catch((error: unknown) => {
      if (this.drafts.get(id) === draft) {
        draft.state = 'error'
        draft.error = error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ'
        const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0
        draft.retryable = !status || status >= 500 || status === 429
      }
      throw error
    }).finally(() => {
      this.writes.delete(id)
      this.notify()
    })
    this.writes.set(id, operation)
    await operation
    if (this.drafts.get(id) !== draft) await this.write(id)
  }

  async flush() {
    await Promise.all([...this.drafts.keys()].map((id) => this.write(id)))
  }

  async retryFailed() {
    await Promise.all([...this.drafts].filter(([, draft]) => draft.state === 'error' && draft.retryable !== false).map(([id]) => this.write(id)))
  }

  savedSnapshot() {
    return new Map([...this.drafts].filter(([, draft]) => draft.state === 'saved'))
  }

  retain(activeIds: Set<string>) {
    for (const id of this.drafts.keys()) {
      if (!activeIds.has(id)) { clearTimeout(this.timers.get(id)); this.timers.delete(id); this.drafts.delete(id) }
    }
    this.notify()
  }

  reconcile(snapshot: Map<string, Draft>) {
    for (const [id, draft] of snapshot) {
      if (this.drafts.get(id) === draft) this.drafts.delete(id)
    }
    this.notify()
  }

  cancelTimers() {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
  }
}

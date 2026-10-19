import type { EvaluationItem } from './api'

/** Preserve each comparison's randomized orientation, including across criteria. */
export function evaluationPairs(items: EvaluationItem[]) {
  const pairs = new Map<string, EvaluationItem[]>()
  for (const item of items) {
    const key = `${item.leftId}:${item.rightId}`
    if (!pairs.has(key)) pairs.set(key, [])
    pairs.get(key)!.push(item)
  }
  return [...pairs].map(([key, entries]) => ({ key, items: entries }))
}

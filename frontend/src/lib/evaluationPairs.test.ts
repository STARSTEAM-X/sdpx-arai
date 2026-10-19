import { describe, expect, it } from 'vitest'
import { evaluationPairs } from './evaluationPairs'
import type { EvaluationItem } from './api'

describe('pair presentation', () => {
  it('groups matching pairs across criteria while retaining every comparison and randomized orientation', () => {
    const make = (id: string, leftId: string, rightId: string, criterionId: string): EvaluationItem => ({ pairAssignmentId: id, criterionId, criterionName: criterionId, leftId, rightId, leftLabel: leftId, rightLabel: rightId, completed: false, choice: 2 })
    const source = [make('1', 'a', 'b', 'ux'), make('2', 'b', 'a', 'quality'), make('3', 'a', 'b', 'quality')]
    const pairs = evaluationPairs(source)
    expect(pairs.map((pair) => pair.items.map((item) => item.pairAssignmentId))).toEqual([['1', '3'], ['2']])
    expect(pairs.flatMap((pair) => pair.items)).toHaveLength(source.length)
    expect(pairs[1].items[0]).toMatchObject({ leftId: 'b', rightId: 'a', choice: 2 })
  })
})

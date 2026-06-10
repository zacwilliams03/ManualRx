import { describe, it, expect } from 'vitest'
import { buildSessionItems } from './supersetUtils'

const makeGroup = (id, orderIndex) => ({
  id,
  label: `Superset ${id}`,
  set_count: 3,
  order_index: orderIndex,
  created_at: '2026-01-01T00:00:00Z',
})

const makeEx = (id, groupId, orderIndex, position = null) => ({
  id,
  group_id: groupId,
  position_in_group: position,
  order_index: orderIndex,
  created_at: '2026-01-01T00:00:00Z',
  exercises: { id: `ex-${id}`, name: 'Test', video_url: null },
})

describe('buildSessionItems', () => {
  it('returns empty array for empty inputs', () => {
    expect(buildSessionItems([], [])).toEqual([])
  })

  it('returns standalone exercises sorted by order_index', () => {
    const exercises = [makeEx('e2', null, 2), makeEx('e1', null, 1)]
    const items = buildSessionItems([], exercises)
    expect(items).toHaveLength(2)
    expect(items[0].ex.id).toBe('e1')
    expect(items[1].ex.id).toBe('e2')
  })

  it('places superset at correct order_index among standalones', () => {
    const groups = [makeGroup('g1', 2)]
    const exercises = [
      makeEx('e1', null, 1),
      makeEx('e3', null, 3),
      makeEx('ea', 'g1', null, 0),
      makeEx('eb', 'g1', null, 1),
    ]
    const items = buildSessionItems(groups, exercises)
    expect(items.map(i => i.type)).toEqual(['exercise', 'superset', 'exercise'])
    expect(items[0].ex.id).toBe('e1')
    expect(items[2].ex.id).toBe('e3')
  })

  it('sorts superset members by position_in_group', () => {
    const groups = [makeGroup('g1', 1)]
    const exercises = [makeEx('eb', 'g1', null, 1), makeEx('ea', 'g1', null, 0)]
    const items = buildSessionItems(groups, exercises)
    expect(items[0].exercises[0].id).toBe('ea')
    expect(items[0].exercises[1].id).toBe('eb')
  })

  it('attaches group metadata to superset item', () => {
    const groups = [makeGroup('g1', 1)]
    const exercises = [makeEx('ea', 'g1', null, 0), makeEx('eb', 'g1', null, 1)]
    const items = buildSessionItems(groups, exercises)
    expect(items[0].group.id).toBe('g1')
    expect(items[0].group.set_count).toBe(3)
  })

  it('places null order_index standalones last', () => {
    const exercises = [makeEx('e1', null, 1), makeEx('e2', null, null)]
    const items = buildSessionItems([], exercises)
    expect(items[0].ex.id).toBe('e1')
    expect(items[1].ex.id).toBe('e2')
  })

  it('returns type exercise for standalone items', () => {
    const exercises = [makeEx('e1', null, 1)]
    const items = buildSessionItems([], exercises)
    expect(items[0].type).toBe('exercise')
    expect(items[0].ex.id).toBe('e1')
  })
})

import { formatTempo } from './formatTempo'

describe('formatTempo', () => {
  test('returns null when any value is null', () => {
    expect(formatTempo(null, 1, 2, 1)).toBeNull()
    expect(formatTempo(3, null, 2, 1)).toBeNull()
    expect(formatTempo(3, 1, null, 1)).toBeNull()
    expect(formatTempo(3, 1, 2, null)).toBeNull()
  })

  test('returns compact string for valid inputs', () => {
    expect(formatTempo(3, 1, 2, 1).compact).toBe('3-1-2-1')
    expect(formatTempo(4, 0, 2, 0).compact).toBe('4-0-2-0')
  })

  test('returns 4-item breakdown array with correct labels', () => {
    const { breakdown } = formatTempo(3, 1, 2, 1)
    expect(breakdown).toHaveLength(4)
    expect(breakdown[0]).toEqual({ value: 3, label: 'sec on the way down' })
    expect(breakdown[1]).toEqual({ value: 1, label: 'sec hold at the bottom' })
    expect(breakdown[2]).toEqual({ value: 2, label: 'sec on the way up' })
    expect(breakdown[3]).toEqual({ value: 1, label: 'sec hold at the top' })
  })

  test('allows zero for pause phases', () => {
    const result = formatTempo(3, 0, 2, 0)
    expect(result).not.toBeNull()
    expect(result.compact).toBe('3-0-2-0')
  })

  test('returns null when any value is NaN', () => {
    expect(formatTempo(NaN, 1, 2, 1)).toBeNull()
    expect(formatTempo(3, NaN, 2, 1)).toBeNull()
  })
})

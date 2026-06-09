import { formatPerSetSummary } from './formatPerSetSummary'

describe('formatPerSetSummary', () => {
  test('returns empty string for null or empty sets', () => {
    expect(formatPerSetSummary(null, 'kg')).toBe('')
    expect(formatPerSetSummary([], 'kg')).toBe('')
  })

  test('compact: reps×weight with unit at end', () => {
    const sets = [
      { set_number: 1, reps: 10, weight: 40 },
      { set_number: 2, reps: 8,  weight: 55 },
      { set_number: 3, reps: 6,  weight: 70 },
    ]
    expect(formatPerSetSummary(sets, 'kg')).toBe('10×40 · 8×55 · 6×70 kg')
  })

  test('compact: all bodyweight shows reps only', () => {
    const sets = [
      { set_number: 1, reps: 12, weight: null },
      { set_number: 2, reps: 10, weight: null },
    ]
    expect(formatPerSetSummary(sets, 'kg')).toBe('12 · 10 reps')
  })

  test('compact: mixed bodyweight and weighted uses BW placeholder', () => {
    const sets = [
      { set_number: 1, reps: 10, weight: null },
      { set_number: 2, reps: 8,  weight: 20 },
    ]
    expect(formatPerSetSummary(sets, 'kg')).toBe('10×BW · 8×20 kg')
  })

  test('pdf: builds Set N: reps × weight format', () => {
    const sets = [
      { set_number: 1, reps: 10, weight: 40 },
      { set_number: 2, reps: 8,  weight: 55 },
    ]
    expect(formatPerSetSummary(sets, 'kg', { pdf: true }))
      .toBe('Set 1: 10 × 40 kg  ·  Set 2: 8 × 55 kg')
  })

  test('pdf: omits weight when null', () => {
    const sets = [{ set_number: 1, reps: 12, weight: null }]
    expect(formatPerSetSummary(sets, 'kg', { pdf: true })).toBe('Set 1: 12 reps')
  })

  test('compact: single set', () => {
    const sets = [{ set_number: 1, reps: 10, weight: 60 }]
    expect(formatPerSetSummary(sets, 'kg')).toBe('10×60 kg')
  })
})

import { describe, test, expect } from 'vitest'
import { getCurrentPeriodStartDate, isFormActive } from './checkInUtils'

function makeForm(overrides = {}) {
  return {
    day_of_week: 1, // Monday
    start_date: '2026-06-02', // A Monday
    duration_weeks: null,
    ...overrides,
  }
}

describe('getCurrentPeriodStartDate', () => {
  test('returns null when start_date is in the future', () => {
    const form = makeForm({ start_date: '2099-01-01' })
    expect(getCurrentPeriodStartDate(form, new Date('2026-06-04'))).toBeNull()
  })

  test('returns start_date when today IS the first scheduled day', () => {
    const form = makeForm({ start_date: '2026-06-01', day_of_week: 1 }) // Jun 1 = Monday
    const result = getCurrentPeriodStartDate(form, new Date('2026-06-01'))
    expect(result.toISOString().split('T')[0]).toBe('2026-06-01')
  })

  test('returns the most recent past occurrence of the day', () => {
    // start_date is Jun 2 (Tuesday), day_of_week is 1 (Monday), today is Jun 11 (Thursday)
    // First Monday on or after Jun 2 is Jun 8; next is Jun 15 > Jun 11 → most recent is Jun 8
    const form = makeForm({ start_date: '2026-06-02', day_of_week: 1 })
    const result = getCurrentPeriodStartDate(form, new Date('2026-06-11'))
    expect(result.toISOString().split('T')[0]).toBe('2026-06-08')
  })

  test('returns null when day_of_week has not yet occurred since start_date', () => {
    // start_date is Jun 3 (Wednesday), day_of_week is 1 (Monday)
    // First Monday on or after Jun 3 is Jun 8 — but today is Jun 4
    const form = makeForm({ start_date: '2026-06-03', day_of_week: 1 })
    const result = getCurrentPeriodStartDate(form, new Date('2026-06-04'))
    expect(result).toBeNull()
  })
})

describe('isFormActive', () => {
  test('returns true when duration_weeks is null (indefinite)', () => {
    expect(isFormActive(makeForm({ duration_weeks: null, start_date: '2026-01-01' }))).toBe(true)
  })

  test('returns true when within duration', () => {
    // start_date 4 weeks ago, duration 8 weeks
    const start = new Date()
    start.setDate(start.getDate() - 28)
    const form = makeForm({ duration_weeks: 8, start_date: start.toISOString().split('T')[0] })
    expect(isFormActive(form)).toBe(true)
  })

  test('returns false when past duration', () => {
    expect(isFormActive(makeForm({ duration_weeks: 1, start_date: '2020-01-01' }))).toBe(false)
  })
})

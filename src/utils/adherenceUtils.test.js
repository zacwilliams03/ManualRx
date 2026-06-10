import { describe, it, expect } from 'vitest'
import { generateSlots } from './adherenceUtils'

describe('generateSlots', () => {
  it('returns empty array when frequency_days is null', () => {
    expect(generateSlots({ frequency_days: null, start_date: null }, [])).toEqual([])
  })

  it('returns empty array when frequency_days is undefined', () => {
    expect(generateSlots({ start_date: null }, [])).toEqual([])
  })

  it('slot count is Math.floor(14 / frequency_days) for weekly prescription', () => {
    const slots = generateSlots({ frequency_days: 7, start_date: null }, [])
    expect(slots).toHaveLength(2)
  })

  it('slot count is Math.floor(14 / frequency_days) for 3-day prescription', () => {
    const slots = generateSlots({ frequency_days: 3, start_date: null }, [])
    expect(slots).toHaveLength(4)
  })

  it('current slot is pending when no recent log exists', () => {
    const slots = generateSlots({ frequency_days: 7, start_date: null }, [])
    expect(slots[0].status).toBe('pending')
  })

  it('current slot is done when a log exists within current window', () => {
    const recent = new Date()
    recent.setDate(recent.getDate() - 1)
    const slots = generateSlots(
      { frequency_days: 7, start_date: null },
      [{ completed_at: recent.toISOString() }]
    )
    expect(slots[0].status).toBe('done')
  })

  it('past slot is missed when no log exists in that window', () => {
    // start_date: null is load-bearing here — it disables the start-gate check,
    // making slot[1] always 'missed' regardless of calendar date.
    const slots = generateSlots({ frequency_days: 7, start_date: null }, [])
    expect(slots[1].status).toBe('missed')
  })

  it('returns pending for slots before start_date', () => {
    const future = new Date()
    future.setDate(future.getDate() + 30)
    const slots = generateSlots(
      { frequency_days: 7, start_date: future.toISOString() },
      []
    )
    expect(slots.every(s => s.status === 'pending')).toBe(true)
  })
})

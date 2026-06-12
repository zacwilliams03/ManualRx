import { describe, it, expect } from 'vitest'
import {
  computeCompletionStats,
  computeExerciseVolume,
  computePainData,
  computeVolumeData,
  computeWeeklyData,
} from './progressUtils'

describe('computeCompletionStats', () => {
  it('returns null expected when start_date is null', () => {
    const p = { id: 'p1', start_date: null, duration_weeks: 8, frequency_days: 7 }
    expect(computeCompletionStats(p, [{ prescription_id: 'p1' }, { prescription_id: 'p1' }]))
      .toEqual({ completed: 2, expected: null })
  })

  it('returns null expected when duration_weeks is null', () => {
    const p = { id: 'p1', start_date: '2025-01-01', duration_weeks: null, frequency_days: 7 }
    expect(computeCompletionStats(p, [{ prescription_id: 'p1' }]))
      .toEqual({ completed: 1, expected: null })
  })

  it('returns null expected when frequency_days is null', () => {
    const p = { id: 'p1', start_date: '2025-01-01', duration_weeks: 4, frequency_days: null }
    expect(computeCompletionStats(p, [])).toEqual({ completed: 0, expected: null })
  })

  it('calculates expected sessions from duration and frequency', () => {
    const p = { id: 'p1', start_date: '2025-01-01', duration_weeks: 4, frequency_days: 7 }
    const logs = [{ prescription_id: 'p1' }, { prescription_id: 'p1' }, { prescription_id: 'p1' }]
    // Math.round((4 * 7) / 7) = 4
    expect(computeCompletionStats(p, logs)).toEqual({ completed: 3, expected: 4 })
  })

  it('only counts logs belonging to the given prescription', () => {
    const p = { id: 'p1', start_date: '2025-01-01', duration_weeks: 4, frequency_days: 7 }
    const logs = [{ prescription_id: 'p1' }, { prescription_id: 'p2' }]
    expect(computeCompletionStats(p, logs)).toEqual({ completed: 1, expected: 4 })
  })
})

describe('computeExerciseVolume', () => {
  it('returns null for a fully bodyweight sets_data (zero weight)', () => {
    expect(computeExerciseVolume({ sets_data: [{ reps: 10, weight: 0 }, { reps: 10, weight: null }] }))
      .toBeNull()
  })

  it('calculates volume from sets_data', () => {
    expect(computeExerciseVolume({ sets_data: [{ reps: 10, weight: 50 }, { reps: 8, weight: 50 }] }))
      .toBe(900) // 10*50 + 8*50
  })

  it('skips bodyweight sets within mixed sets_data', () => {
    expect(computeExerciseVolume({ sets_data: [{ reps: 10, weight: 50 }, { reps: 10, weight: 0 }] }))
      .toBe(500) // only first set counts
  })

  it('falls back to weight_completed for old logs with no sets_data', () => {
    expect(computeExerciseVolume({ sets_data: null, reps_completed: 10, weight_completed: 60 }))
      .toBe(600)
  })

  it('returns null for old logs with zero weight_completed', () => {
    expect(computeExerciseVolume({ sets_data: null, reps_completed: 10, weight_completed: 0 }))
      .toBeNull()
  })

  it('returns null for old logs with null weight_completed', () => {
    expect(computeExerciseVolume({ sets_data: null, reps_completed: 10, weight_completed: null }))
      .toBeNull()
  })
})

describe('computePainData', () => {
  it('excludes sessions where all exercise logs have null pain_rating', () => {
    const logs = [
      { completed_at: '2025-01-01T10:00:00Z', exercise_logs: [{ pain_rating: null }] },
      { completed_at: '2025-01-08T10:00:00Z', exercise_logs: [{ pain_rating: 5 }] },
    ]
    const result = computePainData(logs)
    expect(result).toHaveLength(1)
    expect(result[0].pain).toBe(5)
    expect(result[0].date).toBe('2025-01-08T10:00:00Z')
  })

  it('averages non-null pain ratings within a session', () => {
    const logs = [
      { completed_at: '2025-01-01T10:00:00Z', exercise_logs: [{ pain_rating: 4 }, { pain_rating: 6 }, { pain_rating: null }] },
    ]
    expect(computePainData(logs)[0].pain).toBe(5)
  })

  it('returns empty array when no sessions have any pain data', () => {
    const logs = [{ completed_at: '2025-01-01T10:00:00Z', exercise_logs: [] }]
    expect(computePainData(logs)).toHaveLength(0)
  })
})

describe('computeVolumeData', () => {
  it('excludes sessions where all exercise logs are bodyweight', () => {
    const logs = [
      { completed_at: '2025-01-01T10:00:00Z', exercise_logs: [{ sets_data: [{ reps: 10, weight: 0 }] }] },
      { completed_at: '2025-01-08T10:00:00Z', exercise_logs: [{ sets_data: [{ reps: 10, weight: 60 }] }] },
    ]
    const result = computeVolumeData(logs, 'kg')
    expect(result).toHaveLength(1)
    expect(result[0].volume).toBe(600)
  })

  it('converts total volume to lb when weightUnit is lb', () => {
    const logs = [
      { completed_at: '2025-01-01T10:00:00Z', exercise_logs: [{ sets_data: [{ reps: 1, weight: 100 }] }] },
    ]
    // Math.round(100 * 2.20462) = 220
    expect(computeVolumeData(logs, 'lb')[0].volume).toBe(220)
  })

  it('sums volume across all exercise logs in a session', () => {
    const logs = [{
      completed_at: '2025-01-01T10:00:00Z',
      exercise_logs: [
        { sets_data: [{ reps: 10, weight: 50 }] },
        { sets_data: [{ reps: 8, weight: 60 }] },
      ],
    }]
    // 500 + 480 = 980
    expect(computeVolumeData(logs, 'kg')[0].volume).toBe(980)
  })

  it('returns empty array when all sessions are bodyweight only', () => {
    const logs = [{ completed_at: '2025-01-01T10:00:00Z', exercise_logs: [{ sets_data: [{ reps: 10, weight: 0 }] }] }]
    expect(computeVolumeData(logs, 'kg')).toHaveLength(0)
  })
})

describe('computeWeeklyData', () => {
  it('returns [] when startDate is null', () => {
    expect(computeWeeklyData([], 'kg', null)).toEqual([])
  })

  it('returns [] when sessionLogs is empty', () => {
    expect(computeWeeklyData([], 'kg', '2025-01-01')).toEqual([])
  })

  it('assigns a session on the start date to week 1', () => {
    const logs = [{ completed_at: '2025-01-01T10:00:00Z', exercise_logs: [] }]
    const result = computeWeeklyData(logs, 'kg', '2025-01-01')
    expect(result[0].week).toBe(1)
    expect(result[0].label).toBe('Wk 1')
  })

  it('assigns sessions in different 7-day windows to different weeks', () => {
    const logs = [
      { completed_at: '2025-01-01T10:00:00Z', exercise_logs: [] },
      { completed_at: '2025-01-08T10:00:00Z', exercise_logs: [] },
      { completed_at: '2025-01-15T10:00:00Z', exercise_logs: [] },
    ]
    expect(computeWeeklyData(logs, 'kg', '2025-01-01').map(r => r.week)).toEqual([1, 2, 3])
  })

  it('averages per-session pain averages (not all exercise logs equally)', () => {
    // Session A: exercises with pain 2, 8 → session avg 5
    // Session B: exercise with pain 3 → session avg 3
    // Weekly avgPain = (5 + 3) / 2 = 4, NOT (2+8+3)/3 = 4.33
    const logs = [
      {
        completed_at: '2025-01-01T10:00:00Z',
        exercise_logs: [
          { pain_rating: 2, sets_data: null, weight_completed: null, reps_completed: null },
          { pain_rating: 8, sets_data: null, weight_completed: null, reps_completed: null },
        ],
      },
      {
        completed_at: '2025-01-03T10:00:00Z',
        exercise_logs: [
          { pain_rating: 3, sets_data: null, weight_completed: null, reps_completed: null },
        ],
      },
    ]
    const result = computeWeeklyData(logs, 'kg', '2025-01-01')
    expect(result).toHaveLength(1)
    expect(result[0].avgPain).toBe(4)
  })

  it('sets avgPain to null when no session in the week has pain data', () => {
    const logs = [{
      completed_at: '2025-01-01T10:00:00Z',
      exercise_logs: [{ pain_rating: null, sets_data: null, weight_completed: null, reps_completed: null }],
    }]
    expect(computeWeeklyData(logs, 'kg', '2025-01-01')[0].avgPain).toBeNull()
  })

  it('sums volume across all sessions in a week', () => {
    const logs = [
      {
        completed_at: '2025-01-01T10:00:00Z',
        exercise_logs: [{ sets_data: [{ reps: 10, weight: 50 }], weight_completed: null, reps_completed: null }],
      },
      {
        completed_at: '2025-01-03T10:00:00Z',
        exercise_logs: [{ sets_data: [{ reps: 8, weight: 60 }], weight_completed: null, reps_completed: null }],
      },
    ]
    // 10*50=500, 8*60=480, total=980
    expect(computeWeeklyData(logs, 'kg', '2025-01-01')[0].volume).toBe(980)
  })

  it('sets volume to null when no weighted exercises in the week', () => {
    const logs = [{
      completed_at: '2025-01-01T10:00:00Z',
      exercise_logs: [{ sets_data: [{ reps: 10, weight: 0 }], weight_completed: null, reps_completed: null }],
    }]
    expect(computeWeeklyData(logs, 'kg', '2025-01-01')[0].volume).toBeNull()
  })

  it('converts volume to lb when weightUnit is lb', () => {
    const logs = [{
      completed_at: '2025-01-01T10:00:00Z',
      exercise_logs: [{ sets_data: [{ reps: 1, weight: 100 }], weight_completed: null, reps_completed: null }],
    }]
    // Math.round(100 * 2.20462) = 220
    expect(computeWeeklyData(logs, 'lb', '2025-01-01')[0].volume).toBe(220)
  })

  it('omits weeks with no sessions (sparse gaps are fine)', () => {
    const logs = [
      { completed_at: '2025-01-01T10:00:00Z', exercise_logs: [] },
      { completed_at: '2025-01-15T10:00:00Z', exercise_logs: [] }, // week 3, week 2 absent
    ]
    expect(computeWeeklyData(logs, 'kg', '2025-01-01').map(r => r.week)).toEqual([1, 3])
  })

  it('buckets sessions by UTC calendar date of completed_at (not local time)', () => {
    // Implementation slices completed_at to UTC date string — week assignment is based on
    // UTC calendar date, not the client's local date. This is consistent across all sessions
    // in a prescription, so relative week numbers are stable.
    // completed_at '2025-01-01T23:59:00Z' → UTC date '2025-01-01' → week 1
    const logs = [{ completed_at: '2025-01-01T23:59:00Z', exercise_logs: [] }]
    expect(computeWeeklyData(logs, 'kg', '2025-01-01')[0].week).toBe(1)
  })
})

const KG_TO_LB = 2.20462

export function computeCompletionStats(prescription, sessionLogs) {
  const { id, start_date, duration_weeks, frequency_days } = prescription
  const completed = sessionLogs.filter(l => l.prescription_id === id).length
  if (!start_date || !duration_weeks || !frequency_days) {
    return { completed, expected: null }
  }
  return { completed, expected: Math.round((duration_weeks * 7) / frequency_days) }
}

export function computeExerciseVolume(exerciseLog) {
  const sets = exerciseLog.sets_data
  if (Array.isArray(sets) && sets.length > 0) {
    const allBodyweight = sets.every(s => !s.weight || Number(s.weight) === 0)
    if (allBodyweight) return null
    return sets.reduce((sum, s) => {
      const w = Number(s.weight) || 0
      return w === 0 ? sum : sum + (Number(s.reps) || 0) * w
    }, 0)
  }
  const w = Number(exerciseLog.weight_completed) || 0
  if (w === 0) return null
  return (Number(exerciseLog.reps_completed) || 0) * w
}

export function computePainData(sessionLogs) {
  return sessionLogs
    .map(log => {
      const ratings = (log.exercise_logs ?? [])
        .map(el => el.pain_rating)
        .filter(r => r !== null && r !== undefined)
      if (ratings.length === 0) return null
      const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      return { date: log.completed_at, pain: Math.round(avg * 10) / 10 }
    })
    .filter(Boolean)
}

export function computeVolumeData(sessionLogs, weightUnit = 'kg') {
  return sessionLogs
    .map(log => {
      let totalKg = 0
      for (const el of (log.exercise_logs ?? [])) {
        const vol = computeExerciseVolume(el)
        if (vol !== null) totalKg += vol
      }
      if (totalKg === 0) return null
      const volume = weightUnit === 'lb'
        ? Math.round(totalKg * KG_TO_LB)
        : Math.round(totalKg)
      return { date: log.completed_at, volume }
    })
    .filter(Boolean)
}

export function computeWeeklyData(sessionLogs, weightUnit = 'kg', startDate) {
  if (!startDate || !sessionLogs.length) return []

  const anchorDay = new Date(startDate + 'T00:00:00Z')
  const weekMap = new Map()

  for (const log of sessionLogs) {
    const sessionDay = new Date(log.completed_at.slice(0, 10) + 'T00:00:00Z')
    const week = Math.floor((sessionDay - anchorDay) / (7 * 86400000)) + 1
    if (week < 1) continue

    if (!weekMap.has(week)) {
      weekMap.set(week, { sessionPainAvgs: [], volumeKg: 0, hasVolume: false })
    }

    const entry = weekMap.get(week)

    const exLogs = log.exercise_logs ?? []

    // Per-session average pain first, then average those weekly
    const ratings = exLogs
      .map(el => el.pain_rating)
      .filter(r => r !== null && r !== undefined)
    if (ratings.length > 0) {
      entry.sessionPainAvgs.push(ratings.reduce((s, r) => s + r, 0) / ratings.length)
    }

    // Sum volume across all exercises in the session
    for (const el of exLogs) {
      const vol = computeExerciseVolume(el)
      if (vol !== null && vol > 0) {
        entry.volumeKg += vol
        entry.hasVolume = true
      }
    }
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([week, { sessionPainAvgs, volumeKg, hasVolume }]) => {
      const avgPain = sessionPainAvgs.length > 0
        ? Math.round((sessionPainAvgs.reduce((s, p) => s + p, 0) / sessionPainAvgs.length) * 10) / 10
        : null
      const volume = hasVolume
        ? (weightUnit === 'lb' ? Math.round(volumeKg * KG_TO_LB) : Math.round(volumeKg))
        : null
      return { week, label: `Wk ${week}`, avgPain, volume }
    })
}

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

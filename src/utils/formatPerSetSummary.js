import { fromCanonical } from './weightUtils'

export function formatPerSetSummary(sets, weightUnit, { pdf = false } = {}) {
  if (!sets?.length) return ''

  if (pdf) {
    return sets.map(s => {
      if (s.weight != null) {
        const w = parseFloat(fromCanonical(s.weight, weightUnit).toFixed(1))
        return `Set ${s.set_number}: ${s.reps} × ${w} ${weightUnit}`
      }
      return `Set ${s.set_number}: ${s.reps} reps`
    }).join('  ·  ')
  }

  const allBodyweight = sets.every(s => s.weight == null)
  if (allBodyweight) {
    return sets.map(s => s.reps).join(' · ') + ' reps'
  }

  const parts = sets.map(s => {
    const w = s.weight != null
      ? String(parseFloat(fromCanonical(s.weight, weightUnit).toFixed(1)))
      : 'BW'
    return `${s.reps}×${w}`
  })
  return `${parts.join(' · ')} ${weightUnit}`
}

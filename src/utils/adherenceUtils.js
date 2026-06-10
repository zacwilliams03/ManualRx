/**
 * Generates a slot array representing session adherence for a prescription.
 * Slot 0 = current period, slot 1 = previous period, etc.
 * Status: 'done' | 'missed' | 'pending'
 */
export function generateSlots(prescription, sessionLogs) {
  const { frequency_days, start_date } = prescription
  if (!frequency_days) return []

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const numSlots = Math.min(Math.floor(14 / frequency_days), 14)
  const logDates = (sessionLogs || []).map(l => new Date(l.completed_at))

  return Array.from({ length: numSlots }, (_, k) => {
    if (k === 0) {
      const windowStart = new Date(today)
      windowStart.setDate(today.getDate() - frequency_days)
      if (start_date && today <= new Date(start_date)) return { status: 'pending' }
      const done = logDates.some(d => d >= windowStart)
      return { status: done ? 'done' : 'pending' }
    }

    const windowEnd = new Date(today)
    windowEnd.setDate(today.getDate() - k * frequency_days)
    const windowStart = new Date(windowEnd)
    windowStart.setDate(windowEnd.getDate() - frequency_days)

    if (start_date && windowEnd <= new Date(start_date)) return { status: 'pending' }

    const done = logDates.some(d => d >= windowStart && d < windowEnd)
    return { status: done ? 'done' : 'missed' }
  })
}

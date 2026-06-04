// Normalise a Date to UTC midnight (strips time component in UTC)
function toUTCMidnight(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

// Parse a YYYY-MM-DD string as UTC midnight
function parseUTCDate(dateStr) {
  return new Date(dateStr + 'T00:00:00.000Z')
}

export function getCurrentPeriodStartDate(form, today = new Date()) {
  const t = toUTCMidnight(today)

  const startDate = parseUTCDate(form.start_date)

  if (startDate > t) return null

  // Find first occurrence of day_of_week on or after start_date
  const daysUntilTarget = (form.day_of_week - startDate.getUTCDay() + 7) % 7
  let periodStart = new Date(startDate)
  periodStart.setUTCDate(periodStart.getUTCDate() + daysUntilTarget)

  if (periodStart > t) return null

  // Advance by 7-day increments until the next would exceed today
  while (true) {
    const next = new Date(periodStart)
    next.setUTCDate(next.getUTCDate() + 7)
    if (next > t) break
    periodStart = next
  }

  return periodStart
}

export function isFormActive(form) {
  if (!form.duration_weeks) return true
  const expiry = parseUTCDate(form.start_date)
  expiry.setUTCDate(expiry.getUTCDate() + form.duration_weeks * 7)
  return expiry >= new Date()
}

export function formatPeriodDate(dateStr) {
  return parseUTCDate(dateStr).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    timeZone: 'UTC',
  })
}

export function weekNumber(periodStartDate, formStartDate) {
  const period = parseUTCDate(periodStartDate).getTime()
  const start = parseUTCDate(formStartDate).getTime()
  return Math.floor((period - start) / (1000 * 60 * 60 * 24 * 7)) + 1
}

export function frequencyLabel(days) {
  if (!days) return 'No repeat'
  if (days === 1) return 'Daily'
  if (days === 7) return 'Weekly'
  return `Every ${days} days`
}

export function freqLabel(days) {
  if (days === 1) return 'daily'
  if (days === 7) return 'weekly'
  return `every ${days} days`
}

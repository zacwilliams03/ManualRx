import { formatWeight } from './weightUtils'

export function sanitise(str) {
  return str
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function weightDisplay(kgValue, unit) {
  if (!kgValue) return 'Bodyweight'
  return formatWeight(kgValue, unit)
}

export function formatPdfDate(date) {
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

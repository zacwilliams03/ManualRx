const KG_TO_LB = 2.20462
const LB_TO_KG = 0.453592

export function toCanonical(value, unit) {
  return unit === 'lb' ? value * LB_TO_KG : value
}

export function fromCanonical(kgValue, unit) {
  return unit === 'lb' ? kgValue * KG_TO_LB : kgValue
}

export function formatWeight(kgValue, unit) {
  const val = fromCanonical(kgValue, unit)
  return `${parseFloat(val.toFixed(1))} ${unit}`
}

export function CompletionStat({ completed, expected }) {
  if (expected === null) {
    return (
      <p className="text-sm text-gray-700">
        <span className="text-2xl font-semibold text-gray-900">{completed}</span>
        {' '}session{completed !== 1 ? 's' : ''} completed
      </p>
    )
  }
  return (
    <p className="text-sm text-gray-700">
      <span className="text-2xl font-semibold text-gray-900">{completed}</span>
      {' '}of {expected} sessions completed
    </p>
  )
}

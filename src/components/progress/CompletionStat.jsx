export function CompletionStat({ completed, expected }) {
  if (expected === null) {
    return (
      <p className="text-sm text-dark-muted">
        <span className="text-2xl font-semibold text-dark-text">{completed}</span>
        {' '}session{completed !== 1 ? 's' : ''} completed
      </p>
    )
  }
  return (
    <p className="text-sm text-dark-muted">
      <span className="text-2xl font-semibold text-dark-text">{completed}</span>
      {' '}of {expected} sessions completed
    </p>
  )
}

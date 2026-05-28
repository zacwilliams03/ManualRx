export function CompletionStat({ completed, expected }) {
  if (expected === null) {
    return (
      <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
        <span style={{ fontSize: '28px', fontWeight: 600, color: '#f0f0f0' }}>{completed}</span>
        {' '}session{completed !== 1 ? 's' : ''} completed
      </p>
    )
  }
  return (
    <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
      <span style={{ fontSize: '28px', fontWeight: 600, color: '#f0f0f0' }}>{completed}</span>
      {' '}of {expected} sessions completed
    </p>
  )
}

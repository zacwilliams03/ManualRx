export function formatTempo(eccentric, bottomPause, concentric, topPause) {
  if ([eccentric, bottomPause, concentric, topPause].some(v => v == null || (typeof v === 'number' && isNaN(v)))) return null
  return {
    compact: `${eccentric}-${bottomPause}-${concentric}-${topPause}`,
    breakdown: [
      { value: eccentric,   label: 'sec on the way down' },
      { value: bottomPause, label: 'sec hold at the bottom' },
      { value: concentric,  label: 'sec on the way up' },
      { value: topPause,    label: 'sec hold at the top' },
    ],
  }
}

import React, { useState, useEffect } from 'react'

const R = 40
const C = 2 * Math.PI * R  // ≈ 251.33

const btnBase = {
  border: 'none', borderRadius: '7px', padding: '8px 14px',
  fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
const primaryBtn = { ...btnBase, background: 'var(--color-accent-bg)', border: '1px solid rgba(41,181,204,0.3)', color: 'var(--color-accent)' }
const resetLink = { background: 'none', border: 'none', fontSize: '12px', color: 'var(--color-muted)', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }

/**
 * Requires parent to set key={currentSet} (or equivalent) so this component
 * remounts on each new set — the done-effect captures onComplete/targetSeconds
 * via closure at mount time.
 */
export default function SetTimer({ targetSeconds, onComplete, onReset }) {
  const [timeLeft, setTimeLeft] = useState(targetSeconds)
  const [phase, setPhase] = useState('idle') // 'idle' | 'running' | 'paused' | 'done'

  // Tick — decrements timeLeft every second while running
  useEffect(() => {
    if (phase !== 'running') return
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) return 0
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase])

  // Transition to done when timeLeft hits 0 while running
  useEffect(() => {
    if (phase === 'running' && timeLeft === 0) {
      setPhase('done')
      try { navigator.vibrate(200) } catch (_) {}
      onComplete(targetSeconds)
    }
  }, [timeLeft, phase]) // eslint-disable-line react-hooks/exhaustive-deps
  // ^ onComplete/targetSeconds omitted: component is always remounted via key= on set/round change

  function handleReset() {
    setTimeLeft(targetSeconds)
    setPhase('idle')
    onReset()
  }

  // Draining ring: starts fully drawn (offset=0), empties as time runs out (offset=C)
  const offset = targetSeconds > 0
    ? C * (1 - timeLeft / targetSeconds)
    : 0
  const ringColor = phase === 'done' ? 'var(--color-success)' : 'var(--color-accent)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      {targetSeconds > 0 ? (
        <>
          <svg width="96" height="96" viewBox="0 0 96 96">
            {/* Track */}
            <circle cx="48" cy="48" r={R} fill="none" stroke="var(--color-elevated)" strokeWidth="8" />
            {/* Progress arc — starts at 12 o'clock */}
            <circle
              cx="48" cy="48" r={R}
              fill="none"
              stroke={ringColor}
              strokeWidth="8"
              strokeDasharray={C}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 48 48)"
              style={{ transition: phase === 'running' ? 'stroke-dashoffset 1s linear' : 'none' }}
            />
            <text x="48" y="45" textAnchor="middle" fill="var(--color-text)" fontSize="22" fontWeight="700" fontFamily="system-ui">
              {timeLeft}
            </text>
            <text x="48" y="61" textAnchor="middle" fill="var(--color-muted)" fontSize="10" fontFamily="system-ui">
              of {targetSeconds}s
            </text>
          </svg>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {phase === 'idle' && (
              <button type="button" onClick={() => setPhase('running')} style={{ ...primaryBtn, padding: '8px 20px' }}>
                ▶ Start Timer
              </button>
            )}
            {phase === 'running' && (
              <>
                <button type="button" onClick={() => setPhase('paused')} style={{ ...primaryBtn }}>⏸ Pause</button>
                <button type="button" onClick={handleReset} style={resetLink}>↺ Reset</button>
              </>
            )}
            {phase === 'paused' && (
              <>
                <button type="button" onClick={() => setPhase('running')} style={{ ...primaryBtn }}>▶ Resume</button>
                <button type="button" onClick={handleReset} style={resetLink}>↺ Reset</button>
              </>
            )}
            {phase === 'done' && (
              <span style={{ fontSize: '13px', color: 'var(--color-success)', fontWeight: 600 }}>Done ✓</span>
            )}
          </div>
        </>
      ) : (
        // targetSeconds is 0/falsy — no ring; disable Start; client must type manually
        <button type="button" disabled style={{ ...primaryBtn, opacity: 0.4, cursor: 'not-allowed', padding: '8px 20px' }}>
          ▶ Start Timer
        </button>
      )}
    </div>
  )
}

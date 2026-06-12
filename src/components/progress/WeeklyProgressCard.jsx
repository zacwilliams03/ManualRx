import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTheme } from '../../context/ThemeContext'

export function WeeklyProgressCard({ data, weightUnit }) {
  const { theme } = useTheme()
  const chartColors = {
    accent: '#29B5CC',
    muted:  theme === 'dark' ? '#888888' : '#475569',
    grid:   theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)',
    text:   theme === 'dark' ? '#888888' : '#475569',
  }

  const painData   = (data ?? []).filter(d => d.avgPain !== null)
  const volumeData = (data ?? []).filter(d => d.volume !== null)
  const hasPain    = painData.length >= 2
  const hasVolume  = volumeData.length >= 2

  if (!hasPain && !hasVolume) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {hasPain && (
        <div>
          <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '8px' }}>
            Average Pain per Week (0–10)
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={painData} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartColors.text }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: chartColors.text }} />
              <Tooltip
                formatter={v => [v, 'Avg pain (0–10)']}
                contentStyle={{ background: 'rgba(14,17,23,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', fontSize: '12px', color: '#f0f0f0' }}
                itemStyle={{ color: chartColors.accent }}
                labelStyle={{ color: chartColors.muted }}
              />
              <Line
                type="monotone"
                dataKey="avgPain"
                stroke={chartColors.accent}
                strokeWidth={2}
                dot={{ r: 3, fill: chartColors.accent }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {hasVolume && (
        <div>
          <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '8px' }}>
            Total Volume per Week ({weightUnit})
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={volumeData} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartColors.text }} />
              <YAxis tick={{ fontSize: 11, fill: chartColors.text }} />
              <Tooltip
                formatter={v => [`${v} ${weightUnit}`, 'Total volume']}
                contentStyle={{ background: 'rgba(14,17,23,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', fontSize: '12px', color: '#f0f0f0' }}
                itemStyle={{ color: chartColors.accent }}
                labelStyle={{ color: chartColors.muted }}
              />
              <Line
                type="monotone"
                dataKey="volume"
                stroke={chartColors.accent}
                strokeWidth={2}
                dot={{ r: 3, fill: chartColors.accent }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

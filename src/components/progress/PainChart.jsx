import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTheme } from '../../context/ThemeContext'

function fmtDate(str) {
  return new Date(str).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function PainChart({ data }) {
  const { theme } = useTheme()
  const chartColors = {
    accent: '#29B5CC',
    muted:  theme === 'dark' ? '#888888' : '#475569',
    grid:   theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)',
    text:   theme === 'dark' ? '#888888' : '#475569',
  }

  if (!data || data.length < 2) {
    return (
      <p className="text-sm text-dark-muted">
        Not enough data to display pain chart (minimum 2 sessions with pain ratings needed).
      </p>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: chartColors.text }} />
        <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: chartColors.text }} />
        <Tooltip
          formatter={v => [v, 'Avg pain (0–10)']}
          labelFormatter={fmtDate}
          contentStyle={{ background: 'rgba(14,17,23,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', fontSize: '12px', color: '#f0f0f0' }}
          itemStyle={{ color: chartColors.accent }}
          labelStyle={{ color: chartColors.muted }}
        />
        <Line
          type="monotone"
          dataKey="pain"
          stroke={chartColors.accent}
          strokeWidth={2}
          dot={{ r: 3, fill: chartColors.accent }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

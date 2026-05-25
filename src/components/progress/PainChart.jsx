import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function fmtDate(str) {
  return new Date(str).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function PainChart({ data }) {
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
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#888888' }} />
        <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#888888' }} />
        <Tooltip formatter={v => [v, 'Avg pain (0–10)']} labelFormatter={fmtDate} />
        <Line
          type="monotone"
          dataKey="pain"
          stroke="#29B5CC"
          strokeWidth={2}
          dot={{ r: 3, fill: '#29B5CC' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function fmtDate(str) {
  return new Date(str).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function VolumeChart({ data, weightUnit }) {
  if (!data || data.length < 2) {
    return (
      <p className="text-sm text-gray-500">
        Not enough data to display volume chart (minimum 2 sessions with weighted exercises needed).
      </p>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <Tooltip formatter={v => [`${v} ${weightUnit}`, 'Total volume']} labelFormatter={fmtDate} />
        <Line
          type="monotone"
          dataKey="volume"
          stroke="#29B5CC"
          strokeWidth={2}
          dot={{ r: 3, fill: '#29B5CC' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

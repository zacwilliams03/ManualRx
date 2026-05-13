import { useParams } from 'react-router-dom'

export default function Prescribe() {
  const { clientId } = useParams()

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Prescribe Exercises</h1>
      <p className="mt-2 text-gray-500">Client ID: {clientId} — coming soon</p>
    </div>
  )
}

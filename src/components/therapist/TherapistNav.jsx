import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function TherapistNav() {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()

  const firstName = profile?.name?.split(' ')[0] ?? ''

  function navLink(to, label, activePrefixes) {
    const active = activePrefixes.some(p => pathname.startsWith(p))
    return (
      <Link
        to={to}
        className={`text-sm transition-colors pb-0.5 ${
          active
            ? 'text-white border-b border-white'
            : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <nav className="bg-gray-800 px-6 py-3 flex items-center justify-between">
      <Link to="/therapist" className="text-sm font-semibold text-white">
        ManualRx
      </Link>
      <div className="flex items-center gap-6">
        {navLink('/therapist/clients', 'Clients', ['/therapist/clients', '/therapist/prescribe'])}
        {navLink('/therapist/exercises', 'Exercises', ['/therapist/exercises'])}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400">{firstName}</span>
        {navLink('/account', 'Account', ['/account'])}
        {navLink('/settings', 'Settings', ['/settings'])}
        <button
          onClick={signOut}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          Log out
        </button>
      </div>
    </nav>
  )
}

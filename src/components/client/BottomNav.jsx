import { useLocation, Link } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'
import { LayoutList, History, Settings } from 'lucide-react'

const TABS = [
  { to: '/client',          icon: LayoutList, label: 'Sessions', exact: true  },
  { to: '/client/history',  icon: History,    label: 'History',  exact: false },
  { to: '/client/settings', icon: Settings,   label: 'Settings', exact: false },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const prefersReduced = useReducedMotion()

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 inset-x-0 z-40"
      style={{
        background: 'rgba(14,17,23,0.95)',
        borderTop: '1px solid rgba(41,181,204,0.08)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-stretch">
        {TABS.map(({ to, icon: Icon, label, exact }) => {
          const active = exact ? pathname === to : pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex flex-1 flex-col items-center justify-center gap-1 py-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dark-accent focus-visible:ring-inset',
                prefersReduced ? '' : 'transition-colors',
                active ? 'text-dark-accent' : 'text-dark-muted hover:text-dark-text',
              ].join(' ')}
              style={{ minHeight: '56px' }}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

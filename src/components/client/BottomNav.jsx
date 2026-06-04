import { useLocation, Link } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'
import { LayoutList, History, MessageSquare, Settings } from 'lucide-react'
import { useUnreadCount } from '../../hooks/useUnreadCount'

const TABS = [
  { to: '/client',          icon: LayoutList,    label: 'Sessions',  exact: true,  showBadge: false },
  { to: '/client/history',  icon: History,       label: 'History',   exact: false, showBadge: false },
  { to: '/client/messages', icon: MessageSquare, label: 'Messages',  exact: false, showBadge: true  },
  { to: '/client/settings', icon: Settings,      label: 'Settings',  exact: false, showBadge: false },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const prefersReduced = useReducedMotion()
  const unreadCount = useUnreadCount()

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 inset-x-0 z-40"
      style={{
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-stretch">
        {TABS.map(({ to, icon: Icon, label, exact, showBadge }) => {
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
              <div style={{ position: 'relative' }}>
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                {showBadge && unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-3px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#3b82f6',
                  }} />
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

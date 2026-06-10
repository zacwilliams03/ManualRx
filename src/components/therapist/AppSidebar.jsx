import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  FileText,
  Dumbbell,
  ClipboardList,
  MessageSquare,
  Settings,
  ChevronUp,
  LogOut,
  KeyRound,
  Check,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useUnreadCount } from '../../hooks/useUnreadCount'

// ─── Logo ────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <div
        style={{
          width: '3px',
          height: '20px',
          background: '#29B5CC',
          borderRadius: '2px',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: '"Outfit", sans-serif',
          fontWeight: 700,
          fontSize: '17px',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        <span style={{ color: 'var(--color-text)' }}>Manual</span>
        <span style={{ color: '#29B5CC' }}>Rx</span>
      </span>
    </div>
  )
}

// ─── NavItem ─────────────────────────────────────────────────────────────────

function NavItem({ to, icon: Icon, label, activePrefixes, exact, onClose, badge }) {
  const { pathname } = useLocation()
  const prefixes = activePrefixes ?? [to]
  const active = exact ? pathname === to : prefixes.some(p => pathname.startsWith(p))

  return (
    <div role="listitem">
      <Link
        to={to}
        onClick={onClose}
        className={[
          'flex items-center gap-3 rounded-lg transition-all duration-150 cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dark-accent',
          active
            ? 'text-dark-accent'
            : 'hover:text-dark-text',
        ].join(' ')}
        style={{
          minHeight: '40px',
          paddingLeft: active ? '22px' : '10px',
          paddingRight: '12px',
          marginLeft: active ? '-8px' : '0',
          marginRight: active ? '-8px' : '0',
          background: active ? 'rgba(41,181,204,0.08)' : 'transparent',
          borderLeft: active ? '2px solid #29B5CC' : '2px solid transparent',
          borderRadius: active ? '0 8px 8px 0' : '8px',
          color: active ? '#29B5CC' : 'var(--color-muted)',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--color-elevated)' }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
      >
        <Icon size={17} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
        <span className="text-sm font-medium flex-1">{label}</span>
        {badge > 0 && (
          <span style={{
            background: '#3b82f6', color: '#fff', borderRadius: '10px',
            padding: '1px 6px', fontSize: '11px', fontWeight: 700,
            flexShrink: 0, lineHeight: '16px',
          }}>
            {badge}
          </span>
        )}
      </Link>
    </div>
  )
}

// ─── AccountSection ───────────────────────────────────────────────────────────

function AccountSection() {
  const { profile, signOut } = useAuth()
  const reduceMotion = useReducedMotion()

  const [panelOpen, setPanelOpen] = useState(false)
  const [logoutStep, setLogoutStep] = useState('idle')  // 'idle' | 'confirming'
  const [pwStep, setPwStep] = useState('idle')           // 'idle' | 'open' | 'loading' | 'success' | 'error'
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const panelRef = useRef(null)

  const firstName = profile?.name?.split(' ')[0] ?? 'Account'
  const initial = firstName[0]?.toUpperCase() ?? '?'

  // Close panel on outside click — ref covers both trigger and panel
  useEffect(() => {
    if (!panelOpen) return
    function handle(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [panelOpen])

  // Reset logout state when panel closes
  useEffect(() => {
    if (!panelOpen) {
      setLogoutStep('idle')
    }
  }, [panelOpen])

  const panelMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 8 },
        transition: { duration: 0.18, ease: 'easeOut' },
      }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwError('')

    if (newPw !== confirmPw) {
      setPwError('Passwords don\'t match')
      return
    }
    if (newPw.length < 6) {
      setPwError('Password must be at least 6 characters')
      return
    }

    setPwStep('loading')
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) {
      setPwError(error.message)
      setPwStep('error')
    } else {
      setPwStep('success')
      setNewPw('')
      setConfirmPw('')
      setTimeout(() => setPwStep('idle'), 2000)
    }
  }

  async function handleLogout() {
    await signOut()
  }

  return (
    // panelRef wraps both the panel and the trigger so outside-click
    // doesn't conflict with the toggle onClick
    <div ref={panelRef} className="relative">
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            {...panelMotion}
            className="absolute bottom-full left-0 right-0 mb-2 rounded-xl overflow-hidden"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
          >
            {/* ── Change password ── */}
            <div className="p-1">
              <button
                type="button"
                onClick={() =>
                  setPwStep(s => (s === 'idle' || s === 'error' ? 'open' : 'idle'))
                }
                className="flex items-center gap-2.5 w-full px-3 rounded-lg text-dark-muted hover:bg-dark-elevated hover:text-dark-text transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dark-accent"
                style={{ minHeight: '40px' }}
              >
                <KeyRound size={15} aria-hidden="true" />
                <span className="text-sm flex-1 text-left">Change password</span>
                <ChevronUp
                  size={14}
                  aria-hidden="true"
                  className="transition-transform duration-150"
                  style={{
                    transform:
                      pwStep === 'open' || pwStep === 'loading' || pwStep === 'success'
                        ? 'rotate(0deg)'
                        : 'rotate(180deg)',
                  }}
                />
              </button>

              <AnimatePresence initial={false}>
                {(pwStep === 'open' || pwStep === 'loading' || pwStep === 'success' || pwStep === 'error') && (
                  <motion.div
                    key="pw-form"
                    initial={reduceMotion ? {} : { height: 0, opacity: 0 }}
                    animate={reduceMotion ? {} : { height: 'auto', opacity: 1 }}
                    exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    {pwStep === 'success' ? (
                      <div className="flex items-center gap-2 px-3 py-3 text-sm text-dark-accent">
                        <Check size={15} aria-hidden="true" />
                        Password updated
                      </div>
                    ) : (
                      <form onSubmit={handleChangePassword} className="px-3 pb-2 pt-1 flex flex-col gap-2">
                        <input
                          type="password"
                          placeholder="New password"
                          value={newPw}
                          onChange={e => setNewPw(e.target.value)}
                          required
                          className="w-full rounded-md px-3 text-sm text-dark-text placeholder-dark-subtle bg-dark-elevated border border-dark-border focus:outline-none focus:ring-1 focus:ring-dark-accent transition-colors duration-150"
                          style={{ minHeight: '36px' }}
                        />
                        <input
                          type="password"
                          placeholder="Confirm password"
                          value={confirmPw}
                          onChange={e => setConfirmPw(e.target.value)}
                          required
                          className="w-full rounded-md px-3 text-sm text-dark-text placeholder-dark-subtle bg-dark-elevated border border-dark-border focus:outline-none focus:ring-1 focus:ring-dark-accent transition-colors duration-150"
                          style={{ minHeight: '36px' }}
                        />
                        {pwError && (
                          <p className="text-xs text-red-400 px-0.5">{pwError}</p>
                        )}
                        <button
                          type="submit"
                          disabled={pwStep === 'loading'}
                          className="w-full rounded-md text-sm font-medium transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dark-accent disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            minHeight: '36px',
                            background: 'rgba(41,181,204,0.15)',
                            color: 'var(--color-accent)',
                          }}
                        >
                          {pwStep === 'loading' ? 'Saving…' : 'Save password'}
                        </button>
                      </form>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* divider */}
            <div className="border-t border-dark-border mx-1" />

            {/* ── Log out ── */}
            <div className="p-1">
              {logoutStep === 'idle' ? (
                <button
                  type="button"
                  onClick={() => setLogoutStep('confirming')}
                  className="flex items-center gap-2.5 w-full px-3 rounded-lg text-dark-muted hover:bg-dark-elevated hover:text-red-400 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dark-accent"
                  style={{ minHeight: '40px' }}
                >
                  <LogOut size={15} aria-hidden="true" />
                  <span className="text-sm">Log out</span>
                </button>
              ) : (
                <div className="px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-sm text-dark-muted">Log out?</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLogoutStep('idle')}
                      className="flex items-center justify-center rounded-md text-dark-muted hover:bg-dark-elevated hover:text-dark-text transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dark-accent"
                      style={{ minWidth: '44px', minHeight: '32px', fontSize: '13px' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center justify-center rounded-md font-medium transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                      style={{
                        minWidth: '44px',
                        minHeight: '32px',
                        fontSize: '13px',
                        background: 'rgba(239,68,68,0.12)',
                        color: 'var(--color-danger)',
                        padding: '0 10px',
                      }}
                    >
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setPanelOpen(p => !p)}
        aria-expanded={panelOpen}
        aria-haspopup="dialog"
        className="flex items-center gap-3 w-full px-3 rounded-lg text-dark-muted hover:bg-dark-elevated hover:text-dark-text transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dark-accent"
        style={{ minHeight: '44px' }}
      >
        {/* Avatar */}
        <div
          className="flex items-center justify-center rounded-full flex-shrink-0 text-xs font-bold"
          style={{
            width: '26px',
            height: '26px',
            background: 'rgba(41,181,204,0.18)',
            color: 'var(--color-accent)',
          }}
        >
          {initial}
        </div>
        <span className="text-sm font-medium flex-1 text-left truncate">{firstName}</span>
        <ChevronUp
          size={14}
          aria-hidden="true"
          className="transition-transform duration-200 flex-shrink-0"
          style={{ transform: panelOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}
        />
      </button>
    </div>
  )
}

// ─── AppSidebar ───────────────────────────────────────────────────────────────

export default function AppSidebar({ onClose }) {
  const unreadCount = useUnreadCount()
  return (
    <nav
      aria-label="Main navigation"
      className="fixed left-0 top-0 h-screen z-40 flex flex-col border-r border-dark-border"
      style={{
        width: '240px',
        background: 'linear-gradient(180deg, rgba(41,181,204,0.05) 0%, var(--color-bg) 8%, var(--color-bg) 100%)',
        borderRight: '1px solid rgba(41,181,204,0.10)',
      }}
    >
      {/* Logo */}
      <div className="px-5 py-5 flex-shrink-0">
        <Link to="/therapist" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dark-accent rounded-sm">
          <Logo />
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-4 mb-2" style={{ height: '1px', background: 'rgba(41,181,204,0.12)' }} />

      {/* Nav links */}
      <div role="list" className="flex-1 flex flex-col gap-0.5 px-3 py-2 overflow-y-auto">
        <NavItem
          to="/therapist"
          icon={LayoutDashboard}
          label="Dashboard"
          exact
          onClose={onClose}
        />
        <NavItem
          to="/therapist/clients"
          icon={Users}
          label="Clients"
          activePrefixes={['/therapist/clients', '/therapist/prescribe']}
          onClose={onClose}
        />
        <NavItem
          to="/therapist/templates"
          icon={FileText}
          label="Templates"
          onClose={onClose}
        />
        <NavItem
          to="/therapist/exercises"
          icon={Dumbbell}
          label="Exercise Library"
          onClose={onClose}
        />
        <NavItem
          to="/therapist/checkins"
          icon={ClipboardList}
          label="Check-Ins"
          activePrefixes={['/therapist/checkins']}
          onClose={onClose}
        />
        <NavItem
          to="/therapist/messages"
          icon={MessageSquare}
          label="Messages"
          activePrefixes={['/therapist/messages']}
          badge={unreadCount}
          onClose={onClose}
        />
      </div>

      {/* Bottom zone */}
      <div className="px-3 pb-4 pt-2 flex flex-col gap-0.5 flex-shrink-0" style={{ borderTop: '1px solid rgba(41,181,204,0.12)' }}>
        <NavItem
          to="/settings"
          icon={Settings}
          label="Settings"
          onClose={onClose}
        />
        <AccountSection />
      </div>
    </nav>
  )
}

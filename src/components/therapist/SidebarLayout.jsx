import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppSidebar from './AppSidebar'
import useIsMobile from '../../hooks/useIsMobile'

function Logo() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ width: '3px', height: '20px', background: '#29B5CC', borderRadius: '2px', flexShrink: 0 }} />
      <span style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, fontSize: '17px', letterSpacing: '-0.02em', lineHeight: 1 }}>
        <span style={{ color: '#e8edf5' }}>Manual</span>
        <span style={{ color: '#29B5CC' }}>Rx</span>
      </span>
    </div>
  )
}

function MobileTopBar({ drawerOpen, onToggle }) {
  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 47,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      background: '#0e1117',
      borderBottom: '1px solid rgba(41,181,204,0.10)',
    }}>
      <Link to="/therapist" style={{ textDecoration: 'none' }}>
        <Logo />
      </Link>
      <button
        onClick={onToggle}
        aria-label={drawerOpen ? 'Close navigation' : 'Open navigation'}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#aaaaaa', fontSize: '20px', lineHeight: 1 }}
      >
        {drawerOpen ? '✕' : '☰'}
      </button>
    </div>
  )
}

export default function SidebarLayout({ children }) {
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // ── Desktop — unchanged ────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div className="flex min-h-screen bg-dark-bg">
        <AppSidebar />
        <main className="flex-1 min-h-screen" style={{ marginLeft: '240px' }}>
          {children}
        </main>
      </div>
    )
  }

  // ── Mobile ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0e1117' }}>
      <MobileTopBar drawerOpen={drawerOpen} onToggle={() => setDrawerOpen(v => !v)} />

      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 48 }}
          />
          {/* Drawer panel */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: '240px',
            zIndex: 49,
            overflowY: 'auto',
          }}>
            <AppSidebar onClose={() => setDrawerOpen(false)} />
          </div>
        </>
      )}

      <main>{children}</main>
    </div>
  )
}

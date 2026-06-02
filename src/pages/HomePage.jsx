import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import Lenis from 'lenis'
import ParticleBackground from '../components/ParticleBackground'
import useIsMobile from '../hooks/useIsMobile'

// ─── Data (edit copy here) ─────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Features', id: '#features' },
  { label: 'How it works', id: '#how-it-works' },
  { label: 'Pricing', id: '#pricing' },
]

// Icon is stored as a component reference (not JSX) so hoisting isn't required
const FEATURES = [
  {
    title: 'Video Feedback Loop',
    description:
      'Attach demo videos to any exercise. Clients record their form and send it back — no WhatsApp needed.',
    Icon: FeedbackVideoIcon,
  },
  {
    title: 'Pain & Volume Tracking',
    description:
      'Session-by-session charts visible to you and your client. Watch them improve in real time.',
    Icon: TrackingIcon,
  },
  {
    title: 'Session Templates',
    description:
      'Build a program once and prescribe it to any client instantly. Edit per-patient without touching the original.',
    Icon: TemplatesIcon,
  },
  {
    title: 'Clinic Branding',
    description:
      'Your logo sits at the top of every client session. Every rep reinforces your practice.',
    Icon: BrandingIcon,
  },
  {
    title: 'Notes & Feedback',
    description:
      'Leave cues on each exercise. Clients respond with notes and pain ratings — per set, not just per session.',
    Icon: NotesIcon,
  },
  {
    title: 'Adherence at a Glance',
    description:
      "Dot-pattern compliance view across all clients. Know who's keeping up without opening a single chart.",
    Icon: AdherenceIcon,
  },
]

const STEPS = [
  {
    num: '01',
    title: 'Add your client',
    description:
      'Send an invite link. Your client sets up their account in 60 seconds — no app download required.',
  },
  {
    num: '02',
    title: 'Build their program',
    description:
      'Search the exercise library, configure reps and sets, add notes, and attach videos. Or apply a template to populate a full program in seconds.',
  },
  {
    num: '03',
    title: 'They do the work',
    description:
      'Clients log each session from their phone. You track their progress and adjust as they improve.',
  },
]

// TODO: confirm pricing before launch
const PLANS = [
  {
    id: 'solo',
    name: 'Solo',
    price: 29,
    sub: '1 therapist · billed monthly',
    features: [
      '1 therapist account',
      'Unlimited clients',
      'Full exercise library',
      'Custom video uploads',
      'Client progress tracking',
      'PDF export',
    ],
  },
  {
    id: 'clinic',
    name: 'Clinic',
    price: 70,
    sub: 'Up to 5 therapists · billed monthly',
    featured: true,
    features: [
      'Up to 5 therapist accounts',
      'Unlimited clients',
      'Shared custom video library',
      'Full exercise library',
      'Client progress tracking',
      'PDF export',
    ],
  },
  {
    id: 'practice',
    name: 'Practice',
    price: 120,
    sub: 'Unlimited therapists · billed monthly',
    features: [
      'Unlimited therapist accounts',
      'Unlimited clients',
      'Shared custom video library',
      'Full exercise library',
      'Client progress tracking',
      'PDF export',
      'Priority support',
    ],
  },
]

// ─── Animation helpers ─────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
}
const trans = { duration: 0.6, ease: 'easeOut' }

// Returns motion props for whileInView elements. Passes nothing when reduced.
function fw(reduceMotion, delay = 0) {
  if (reduceMotion) return { initial: false }
  return {
    variants: fadeUp,
    initial: 'hidden',
    whileInView: 'show',
    viewport: { once: true },
    transition: { ...trans, delay },
  }
}

// Returns motion props for on-mount (hero) elements.
function fa(reduceMotion, delay = 0) {
  if (reduceMotion) return { initial: false }
  return {
    variants: fadeUp,
    initial: 'hidden',
    animate: 'show',
    transition: { ...trans, delay },
  }
}

// ─── SVG Icons ────────────────────────────────────────────────────────────

function FeedbackVideoIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#29B5CC" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="13" height="10" rx="2" />
      <path d="m22 8-6 4 6 4V8z" />
      <path d="M8 5V2" />
      <polyline points="6 3 8 1 10 3" />
    </svg>
  )
}

function TrackingIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#29B5CC" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}

function TemplatesIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#29B5CC" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function BrandingIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#29B5CC" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
}

function NotesIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#29B5CC" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function AdherenceIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#29B5CC" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5"  cy="8"  r="2.5" fill="rgba(41,181,204,0.85)" stroke="none" />
      <circle cx="12" cy="8"  r="2.5" fill="rgba(41,181,204,0.85)" stroke="none" />
      <circle cx="19" cy="8"  r="2.5" />
      <circle cx="5"  cy="16" r="2.5" fill="rgba(41,181,204,0.85)" stroke="none" />
      <circle cx="12" cy="16" r="2.5" />
      <circle cx="19" cy="16" r="2.5" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#29B5CC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

// ─── Logo (Option 1 — F1 Bar, Outfit Bold) ────────────────────────────────

function Logo() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ width: '3px', height: '20px', background: '#29B5CC', borderRadius: '2px', flexShrink: 0 }} />
      <span style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, fontSize: '17px', letterSpacing: '-0.01em', lineHeight: 1 }}>
        <span style={{ color: '#f0f0f0' }}>Manual</span>
        <span style={{ color: '#29B5CC' }}>Rx</span>
      </span>
    </div>
  )
}

// ─── Teal italic emphasis ─────────────────────────────────────────────────

function Em({ children }) {
  return <em style={{ color: '#29B5CC', fontStyle: 'italic' }}>{children}</em>
}

// ─── Section label ────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: '12px', color: '#29B5CC', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '20px' }}>
      {children}
    </div>
  )
}

// ─── Nav ──────────────────────────────────────────────────────────────────

function Nav({ scrollTo }) {
  return (
    <nav
      aria-label="Main"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        height: '60px',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(10,10,10,0.85)',
        display: 'flex', alignItems: 'center',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Logo />
        </Link>

        <div className="hidden md:flex" style={{ gap: '32px', alignItems: 'center' }}>
          {NAV_LINKS.map(link => (
            <a
              key={link.id}
              href={link.id}
              onClick={e => { e.preventDefault(); scrollTo(link.id) }}
              style={{ color: '#888888', textDecoration: 'none', fontSize: '14px', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f0f0f0')}
              onMouseLeave={e => (e.currentTarget.style.color = '#888888')}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/login" style={{ color: '#888888', textDecoration: 'none', fontSize: '14px' }}>
            Log in
          </Link>
          <Link
            to="/signup"
            style={{
              background: '#29B5CC', color: '#0a0a0a',
              padding: '8px 18px', borderRadius: '8px',
              textDecoration: 'none', fontSize: '14px', fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            Get started →
          </Link>
        </div>
      </div>
    </nav>
  )
}

// ─── App mockup ───────────────────────────────────────────────────────────

function NavIcon({ type, active }) {
  const c = active ? '#29B5CC' : '#555555'
  const s = { width: '14px', height: '14px', flexShrink: 0, display: 'block' }
  if (type === 'grid') return (
    <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )
  if (type === 'clients') return (
    <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
  if (type === 'templates') return (
    <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  )
  if (type === 'library') return (
    <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5h11"/>
      <path d="M4 12h16"/>
      <path d="M6.5 17.5h11"/>
      <circle cx="3" cy="6.5" r="1.5"/>
      <circle cx="3" cy="12" r="1.5"/>
      <circle cx="3" cy="17.5" r="1.5"/>
    </svg>
  )
  if (type === 'settings') return (
    <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
  return null
}

function ChromeBar({ url }) {
  return (
    <div style={{
      padding: '9px 12px', background: '#181818',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF5F57' }} />
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FFBD2E' }} />
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#28CA41' }} />
      </div>
      <div style={{
        flex: 1, background: '#111111', borderRadius: '4px',
        padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '5px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <LockIcon />
        <span style={{ fontSize: '11px', color: '#555555' }}>{url}</span>
      </div>
    </div>
  )
}

function DualViewMockup() {
  const [phoneUp, setPhoneUp] = useState(false)

  const DOT = {
    done:   { background: '#29B5CC', border: 'none' },
    missed: { background: '#252830', border: '1px solid #333' },
    today:  { background: 'transparent', border: '1px solid rgba(255,255,255,0.25)' },
  }

  const adherenceClients = [
    {
      name: 'James K.', pct: '96%', pctColor: '#29B5CC',
      dots: ['done','done','done','done','done','done','done','done','done','done','done','today'],
    },
    {
      name: 'Priya S.', pct: '88%', pctColor: '#29B5CC',
      dots: ['done','done','done','done','done','done','done','done','missed','done','done','today'],
    },
    {
      name: 'Sarah J.', pct: '75%', pctColor: '#29B5CC',
      dots: ['done','done','done','done','done','done','done','missed','missed','missed','done','today'],
    },
    {
      name: 'Mark T.', pct: '42%', pctColor: '#fbbf24',
      dots: ['done','done','done','missed','missed','done','done','missed','missed','missed','done','today'],
    },
    {
      name: 'Emma L.', pct: '17%', pctColor: '#f87171',
      dots: ['done','done','missed','missed','missed','missed','missed','missed','missed','missed','missed','today'],
    },
  ]

  const alerts = [
    { label: '5 missed in a row · Shoulder Rehab', client: 'Sarah J.', red: true },
    { label: '3 missed in a row · Cervical Rehab',  client: 'Mark T.',  red: true },
    { label: 'Completed full program · Hip Mobility', client: 'James K.', red: false },
  ]

  const navItems = [
    { label: 'Dashboard',        icon: 'grid',      active: true  },
    { label: 'Clients',          icon: 'clients',   active: false },
    { label: 'Templates',        icon: 'templates', active: false },
    { label: 'Exercise Library', icon: 'library',   active: false },
  ]

  const activity = [
    { initials: 'TE', name: 'Tom E.',   program: 'Hip Rehab',       rpe: 3, pain: 7, time: 'Just now' },
    { initials: 'JK', name: 'James K.', program: 'Shoulder Rehab',  rpe: 5, pain: 2, time: '12 min ago' },
    { initials: 'PS', name: 'Priya S.', program: 'Neck Mobility',   rpe: 4, pain: 4, time: '38 min ago' },
    { initials: 'SJ', name: 'Sarah J.', program: 'Lumbar Stability',rpe: 6, pain: 5, time: '1 hr ago' },
  ]

  return (
    <div aria-hidden="true" style={{ position: 'relative', width: '100%', height: '530px' }}>

      {/* Phone — Client exercise wizard */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0, zIndex: phoneUp ? 3 : 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        style={{
          position: 'absolute', right: 0, top: '15px', width: '238px',
          zIndex: phoneUp ? 3 : 1, cursor: phoneUp ? 'default' : 'pointer',
        }}
        onClick={() => setPhoneUp(true)}
        title={phoneUp ? undefined : 'Click to bring to front'}
      >
        {!phoneUp && (
          <div style={{
            position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(41,181,204,0.18)', border: '1px solid rgba(41,181,204,0.35)',
            color: '#29B5CC', fontSize: '9px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px',
            whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none',
          }}>
            tap to view client
          </div>
        )}
        <div style={{
          background: '#1c1c1e', borderRadius: '40px',
          padding: '14px 7px 10px',
          boxShadow: phoneUp
            ? '0 0 40px rgba(41,181,204,0.2), 0 24px 64px rgba(0,0,0,0.75), inset 0 0 0 1px rgba(255,255,255,0.09)'
            : '0 24px 64px rgba(0,0,0,0.75), inset 0 0 0 1px rgba(255,255,255,0.09)',
          border: `1.5px solid ${phoneUp ? '#29B5CC' : '#2d2d2f'}`, position: 'relative',
        }}>
          {/* Notch */}
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: '80px', height: '24px', background: '#1c1c1e',
            borderRadius: '0 0 16px 16px', zIndex: 3,
          }} />
          {/* Screen */}
          <div style={{
            background: '#0e1117', borderRadius: '28px',
            overflow: 'hidden', height: '462px',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Status bar */}
            <div style={{ height: '28px', padding: '8px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#f0f0f0' }}>9:41</span>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '1.5px', alignItems: 'flex-end' }}>
                  {[4, 6, 9, 11].map((h, i) => (
                    <div key={i} style={{ width: '3px', height: `${h}px`, background: i < 3 ? '#f0f0f0' : '#444', borderRadius: '1px' }} />
                  ))}
                </div>
                <div style={{ width: '22px', height: '11px', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '2.5px', padding: '1.5px', display: 'flex', alignItems: 'center', position: 'relative' }}>
                  <div style={{ width: '55%', height: '100%', background: '#4ade80', borderRadius: '1px' }} />
                  <div style={{ position: 'absolute', right: '-3px', top: '50%', transform: 'translateY(-50%)', width: '2.5px', height: '5px', background: 'rgba(255,255,255,0.3)', borderRadius: '0 1px 1px 0' }} />
                </div>
              </div>
            </div>

            {/* App top bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 14px 6px', flexShrink: 0 }}>
              <span style={{ fontSize: '11px', color: '#888' }}>← Back</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                <div style={{ display: 'flex', gap: '3px' }}>
                  <div style={{ width: '18px', height: '3px', background: '#555', borderRadius: '2px' }} />
                  <div style={{ width: '18px', height: '3px', background: '#29B5CC', borderRadius: '2px' }} />
                </div>
                <span style={{ fontSize: '8px', color: '#888' }}>2 / 2</span>
              </div>
              <span style={{ fontSize: '9px', color: '#888' }}>ManualRx Rehab</span>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, padding: '2px 14px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>

              {/* Title + badge */}
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#f0f0f0', marginBottom: '6px', lineHeight: 1.25 }}>Barbell Back Squat</div>
                <div style={{ display: 'inline-block', background: 'rgba(41,181,204,0.15)', color: '#29B5CC', border: '1px solid rgba(41,181,204,0.25)', fontSize: '10px', fontWeight: 600, padding: '2px 9px', borderRadius: '5px' }}>Hip</div>
              </div>

              {/* Video player — full width, native-style controls */}
              <div style={{ borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: '#000' }}>
                <div style={{ position: 'relative', height: '96px' }}>
                  <img
                    src="https://images.unsplash.com/photo-1770664612843-b44e26070024?auto=format&fit=crop&w=500&h=280&q=80"
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
                {/* Native-style controls bar */}
                <div style={{ background: '#1a1a1a', padding: '5px 10px 6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}>
                    {/* Play button */}
                    <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '8px solid #f0f0f0', flexShrink: 0 }} />
                    <span style={{ fontSize: '9px', color: '#ccc', flexShrink: 0 }}>0:00 / 0:07</span>
                    <div style={{ flex: 1 }} />
                    {/* Volume icon */}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                    </svg>
                    {/* Fullscreen icon */}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                      <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                    </svg>
                    {/* More icon */}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.5" strokeLinecap="round">
                      <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
                    </svg>
                  </div>
                  {/* Scrubber */}
                  <div style={{ position: 'relative', width: '100%', height: '3px', background: '#444', borderRadius: '2px' }}>
                    <div style={{ width: '5%', height: '100%', background: '#f0f0f0', borderRadius: '2px' }} />
                    <div style={{ position: 'absolute', top: '-4px', left: '5%', width: '9px', height: '9px', background: '#f0f0f0', borderRadius: '50%', transform: 'translateX(-50%)' }} />
                  </div>
                </div>
              </div>

              {/* Target */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(100,160,255,0.1)', borderRadius: '8px', padding: '7px 12px', flexShrink: 0 }}>
                <div style={{ fontSize: '7.5px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Target</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#f0f0f0' }}>3 sets × 8 reps @ 80 kg</div>
              </div>

              {/* Set inputs */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#f0f0f0', marginBottom: '7px' }}>
                  Set 2 <span style={{ color: '#888', fontWeight: 400, fontSize: '13px' }}>of 3</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', marginBottom: '8px' }}>
                  {[{ label: 'Reps', val: '8' }, { label: 'Weight (kg, optional)', val: '80' }].map(f => (
                    <div key={f.label}>
                      <div style={{ fontSize: '9px', color: '#aaa', marginBottom: '4px' }}>{f.label}</div>
                      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '7px', padding: '7px 10px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: '#f0f0f0' }}>{f.val}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#29B5CC', color: '#0a0a0a', fontSize: '12px', fontWeight: 700, padding: '10px', borderRadius: '9px', textAlign: 'center' }}>
                  Complete final set →
                </div>
              </div>

              {/* Set 1 summary */}
              <div style={{ background: 'rgba(41,181,204,0.06)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '8px', padding: '7px 12px', flexShrink: 0 }}>
                <div style={{ fontSize: '10px', color: '#29B5CC' }}>Set 1: 8 reps @ 80 kg</div>
              </div>

              {/* Disclaimer */}
              <div style={{ fontSize: '7.5px', color: '#555', lineHeight: 1.5, textAlign: 'center', paddingBottom: '2px' }}>
                Stop and seek medical advice if you experience sudden severe pain, chest pain, or dizziness.
              </div>
            </div>
          </div>
          {/* Home indicator */}
          <div style={{ width: '70px', height: '4px', background: 'rgba(255,255,255,0.18)', margin: '8px auto 0', borderRadius: '2px' }} />
        </div>
      </motion.div>

      {/* Browser — Therapist Dashboard */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
        style={{
          position: 'absolute', left: 0, top: 0,
          width: '82%', borderRadius: '12px', overflow: 'hidden',
          background: '#0d1117',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 0 60px rgba(41,181,204,0.15), 0 0 120px rgba(41,181,204,0.06)',
          zIndex: phoneUp ? 1 : 2, display: 'flex', flexDirection: 'column',
          cursor: phoneUp ? 'pointer' : 'default',
        }}
        onClick={() => setPhoneUp(false)}
      >
        <ChromeBar url="manualrx.com/therapist" />

        <div style={{ display: 'flex', height: '490px', overflow: 'hidden' }}>

          {/* Sidebar */}
          <div style={{
            width: '148px', flexShrink: 0, background: '#0d1117',
            borderRight: '1px solid rgba(100,160,255,0.06)',
            display: 'flex', flexDirection: 'column', paddingTop: '16px',
            textAlign: 'left',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '0 16px 16px', borderBottom: '1px solid rgba(100,160,255,0.06)', marginBottom: '8px' }}>
              <div style={{ width: '2.5px', height: '20px', background: '#29B5CC', borderRadius: '2px', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.01em' }}>ManualRx</span>
            </div>
            {navItems.map(n => (
              <div key={n.label} style={{
                display: 'flex', alignItems: 'center', gap: '9px',
                padding: '8px 16px',
                background: n.active ? 'rgba(41,181,204,0.10)' : 'transparent',
                borderLeft: `2px solid ${n.active ? '#29B5CC' : 'transparent'}`,
                marginLeft: '-1px', marginBottom: '1px',
              }}>
                <NavIcon type={n.icon} active={n.active} />
                <span style={{ fontSize: '11.5px', fontWeight: n.active ? 600 : 400, color: n.active ? '#29B5CC' : '#888888' }}>{n.label}</span>
              </div>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ padding: '0 16px 14px', borderTop: '1px solid rgba(100,160,255,0.06)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px' }}>
                <NavIcon type="settings" active={false} />
                <span style={{ fontSize: '11.5px', color: '#888' }}>Settings</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(41,181,204,0.18)', color: '#29B5CC', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>Z</div>
                <span style={{ fontSize: '11.5px', color: '#888', flex: 1 }}>Zac</span>
                <span style={{ fontSize: '9px', color: '#555' }}>∨</span>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', textAlign: 'left' }}>

            {/* Hero header */}
            <div style={{ padding: '16px 20px 12px', position: 'relative', overflow: 'hidden', flexShrink: 0, borderBottom: '1px solid rgba(100,160,255,0.06)' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 160% 160% at 0% -40%, rgba(41,181,204,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#f0f0f0', marginBottom: '4px' }}>Good afternoon, Zac!</div>
              <div style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#f87171' }}>3 need attention</span>
                <span style={{ color: '#444' }}>·</span>
                <span style={{ color: '#888' }}>21 active clients</span>
              </div>
            </div>

            {/* Two-column section */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

              {/* CLIENT ADHERENCE */}
              <div style={{ flex: 1, padding: '14px 16px', borderRight: '1px solid rgba(100,160,255,0.06)', overflowY: 'auto' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '12px' }}>Client Adherence</div>
                {adherenceClients.map(c => (
                  <div key={c.name} style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#f0f0f0', width: '52px', flexShrink: 0 }}>{c.name}</span>
                    <div style={{ display: 'flex', gap: '2.5px', flex: 1, alignItems: 'center' }}>
                      {c.dots.map((d, i) => (
                        <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, ...DOT[d] }} />
                      ))}
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: c.pctColor, width: '28px', textAlign: 'right', flexShrink: 0 }}>{c.pct}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(100,160,255,0.06)' }}>
                  {[{ d: 'done', label: 'Done' }, { d: 'missed', label: 'Missed' }, { d: 'today', label: 'Today' }].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, ...DOT[l.d] }} />
                      <span style={{ fontSize: '9px', color: '#888' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* NEEDS ATTENTION */}
              <div style={{ width: '45%', padding: '14px 16px', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '12px' }}>Needs Attention</div>
                {alerts.map((a, i) => (
                  <div key={i} style={{
                    background: a.red ? 'rgba(248,113,113,0.06)' : 'rgba(74,222,128,0.06)',
                    border: `1px solid ${a.red ? 'rgba(248,113,113,0.18)' : 'rgba(74,222,128,0.18)'}`,
                    borderRadius: '8px', padding: '8px 10px', marginBottom: '7px',
                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                  }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: a.red ? '#f87171' : '#4ade80', marginTop: '3px', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '9.5px', fontWeight: 500, color: '#f0f0f0', marginBottom: '2px', lineHeight: 1.35 }}>{a.label}</div>
                      <div style={{ fontSize: '8.5px', color: '#888' }}>{a.client}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div style={{ borderTop: '1px solid rgba(100,160,255,0.06)', padding: '10px 16px', flexShrink: 0 }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '8px' }}>Recent Activity</div>
              {activity.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: i < activity.length - 1 ? '7px' : 0 }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(41,181,204,0.15)', color: '#29B5CC', fontSize: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{a.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#f0f0f0' }}>{a.name}</span>
                    <span style={{ fontSize: '9.5px', color: '#888' }}> · {a.program}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ background: 'rgba(41,181,204,0.12)', color: '#29B5CC', border: '1px solid rgba(41,181,204,0.2)', fontSize: '8px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px' }}>RPE {a.rpe}</div>
                    <div style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)', fontSize: '8px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px' }}>Pain {a.pain}</div>
                    <div style={{ fontSize: '8.5px', color: '#555', minWidth: '48px', textAlign: 'right' }}>{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────

function Hero({ scrollTo }) {
  const reduceMotion = useReducedMotion()
  const isMobile = useIsMobile()

  return (
    <section style={{ position: 'relative', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '60px', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        <ParticleBackground position="absolute" spawnFromTop />
      </div>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(41,181,204,0.12) 0%, transparent 70%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 0%, transparent 100%)',
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 0%, transparent 100%)',
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1100px', width: '100%', margin: '0 auto', padding: isMobile ? '40px 20px 60px' : '60px 24px 80px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <motion.div {...fa(reduceMotion, 0)}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            border: '1px solid rgba(41,181,204,0.5)', color: '#29B5CC',
            background: 'rgba(41,181,204,0.08)', borderRadius: '999px',
            padding: '5px 14px', fontSize: '13px', fontWeight: 500, marginBottom: '32px',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#29B5CC', display: 'inline-block', flexShrink: 0 }} />
            Built for manual therapists
          </div>
        </motion.div>

        <motion.h1
          {...fa(reduceMotion, 0.15)}
          style={{
            fontFamily: '"DM Serif Display", Georgia, serif',
            fontSize: isMobile ? '34px' : 'clamp(42px, 7vw, 80px)',
            fontWeight: 400, lineHeight: 1.1,
            color: '#f0f0f0', margin: '0 0 24px', maxWidth: '820px',
          }}
        >
          Exercise prescription,{' '}
          <Em>made easy.</Em>
        </motion.h1>

        <motion.p
          {...fa(reduceMotion, 0.3)}
          style={{ fontSize: isMobile ? '16px' : '18px', color: '#888888', maxWidth: '520px', lineHeight: 1.65, margin: '0 0 36px' }}
        >
          Send your clients a personalised exercise program in minutes — no paperwork, no spreadsheets, no clutter. Built specifically for massage and manual therapists.
        </motion.p>

        <motion.div
          {...fa(reduceMotion, 0.45)}
          className="flex flex-col sm:flex-row"
          style={{ gap: '12px', justifyContent: 'center', alignItems: 'center' }}
        >
          <Link
            to="/signup"
            style={{
              background: '#29B5CC', color: '#0a0a0a',
              padding: '14px 28px', borderRadius: '10px',
              textDecoration: 'none', fontSize: '15px', fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            Start free trial →
          </Link>
          <a
            href="#how-it-works"
            onClick={e => { e.preventDefault(); scrollTo('#how-it-works') }}
            style={{
              border: '1px solid rgba(255,255,255,0.14)', color: '#f0f0f0',
              padding: '14px 28px', borderRadius: '10px',
              textDecoration: 'none', fontSize: '15px', cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            See how it works
          </a>
        </motion.div>

        <motion.p
          {...fa(reduceMotion, 0.6)}
          style={{ fontSize: '13px', color: '#555555', margin: '16px 0 56px' }}
        >
          No credit card required · 14-day free trial
        </motion.p>

        <motion.div
          {...fa(reduceMotion, 0.75)}
          className="hidden md:block"
          style={{ width: '100%' }}
        >
          <DualViewMockup />
        </motion.div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────

function Features() {
  const reduceMotion = useReducedMotion()
  const isMobile = useIsMobile()

  return (
    <section id="features" style={{ background: '#0a0a0a', padding: isMobile ? '56px 24px' : '100px 24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <motion.div {...fw(reduceMotion)}>
          <SectionLabel>Features</SectionLabel>
          <h2 style={{
            fontFamily: '"DM Serif Display", Georgia, serif',
            fontSize: 'clamp(30px, 4vw, 50px)',
            fontWeight: 400, color: '#f0f0f0', margin: '0 0 56px', lineHeight: 1.15,
          }}>
            Everything a manual therapist <Em>actually needs.</Em>
          </h2>
        </motion.div>

        <div
          className="grid grid-cols-1 md:grid-cols-3"
          style={{ gap: '1px', background: 'rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden' }}
        >
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              {...fw(reduceMotion, i * 0.1)}
              style={{
                background: '#111111',
                padding: '36px 30px',
              }}
            >
              <div style={{
                width: '44px', height: '44px', borderRadius: '10px',
                background: 'rgba(41,181,204,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '20px',
              }}>
                <feature.Icon />
              </div>
              <h3 style={{
                fontSize: '16px', fontWeight: 600, margin: '0 0 10px',
                color: '#f0f0f0',
              }}>
                {feature.title}
              </h3>
              <p style={{ fontSize: '14px', color: '#888888', lineHeight: 1.65, margin: 0 }}>
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────

function HowItWorks() {
  const reduceMotion = useReducedMotion()
  const isMobile = useIsMobile()

  return (
    <section id="how-it-works" style={{ background: '#111111', padding: isMobile ? '56px 24px' : '100px 24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <motion.div {...fw(reduceMotion)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '20px', height: '1px', background: '#29B5CC', flexShrink: 0 }} />
            <SectionLabel>How it works</SectionLabel>
          </div>
          <h2 style={{
            fontFamily: '"DM Serif Display", Georgia, serif',
            fontSize: 'clamp(30px, 4vw, 50px)',
            fontWeight: 400, color: '#f0f0f0', margin: '0 0 56px', lineHeight: 1.15,
          }}>
            Simple for you. <Em>Simple for them.</Em>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              {...fw(reduceMotion, i * 0.1)}
              className={[
                'pb-10',
                i < STEPS.length - 1 ? 'border-b md:border-b-0 border-white/[0.08]' : '',
                i > 0 ? 'pt-10 md:pt-0 md:pl-10' : '',
                i < STEPS.length - 1 ? 'md:border-r md:pr-10 border-white/[0.08]' : '',
              ].join(' ')}
            >
              <motion.div
                {...(reduceMotion
                  ? { initial: false }
                  : {
                      variants: { hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } },
                      initial: 'hidden',
                      whileInView: 'show',
                      viewport: { once: true },
                      transition: { ...trans, delay: i * 0.1 + 0.1 },
                    })}
                style={{
                  fontFamily: '"DM Serif Display", Georgia, serif',
                  fontSize: '72px', fontWeight: 400,
                  color: '#222222', lineHeight: 1, marginBottom: '20px',
                }}
              >
                {step.num}
              </motion.div>
              <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#f0f0f0', margin: '0 0 10px' }}>
                {step.title}
              </h3>
              <p style={{ fontSize: '14px', color: '#888888', lineHeight: 1.65, margin: 0 }}>
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Pricing ──────────────────────────────────────────────────────────────

function Pricing() {
  const reduceMotion = useReducedMotion()
  const isMobile = useIsMobile()

  return (
    <section id="pricing" style={{ background: '#0a0a0a', padding: isMobile ? '56px 24px' : '100px 24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <motion.div {...fw(reduceMotion)}>
          <SectionLabel>Pricing</SectionLabel>
          <h2 style={{
            fontFamily: '"DM Serif Display", Georgia, serif',
            fontSize: 'clamp(30px, 4vw, 50px)',
            fontWeight: 400, color: '#f0f0f0', margin: '0 0 56px', lineHeight: 1.15,
          }}>
            Straightforward pricing, <Em>no surprises.</Em>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '16px', alignItems: 'start' }}>
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              {...fw(reduceMotion, i * 0.1)}
              style={{ position: 'relative' }}
            >
              {plan.featured && (
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <span style={{
                    background: '#29B5CC', color: '#0a0a0a',
                    fontSize: '11px', fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '4px 16px', borderRadius: '999px',
                  }}>
                    Most popular
                  </span>
                </div>
              )}
              <div style={{
                background: '#111111',
                border: `1px solid ${plan.featured ? '#29B5CC' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '12px', padding: '28px',
              }}>
                <div style={{ fontSize: '11px', color: '#888888', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '16px' }}>
                  {plan.name}
                </div>
                {/* TODO: confirm pricing before launch */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '16px', color: '#888888', marginTop: '8px' }}>$</span>
                  <span style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: '52px', color: '#f0f0f0', lineHeight: 1 }}>
                    {plan.price}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#555555', marginBottom: '24px' }}>{plan.sub}</div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '11px' }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <CheckIcon />
                      <span style={{ fontSize: '13px', color: '#888888' }}>{f}</span>
                    </div>
                  ))}
                </div>
                <Link
                  to="/signup"
                  style={{
                    display: 'block', textAlign: 'center',
                    background: plan.featured ? '#29B5CC' : 'transparent',
                    color: plan.featured ? '#0a0a0a' : '#f0f0f0',
                    border: plan.featured ? 'none' : '1px solid rgba(255,255,255,0.14)',
                    padding: '12px', borderRadius: '8px',
                    textDecoration: 'none', fontSize: '14px', fontWeight: 600,
                  }}
                >
                  Get started →
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          {...fw(reduceMotion, 0.3)}
          style={{ textAlign: 'center', fontSize: '13px', color: '#555555', marginTop: '24px' }}
        >
          14-day free trial on all plans. No credit card required.
        </motion.p>
      </div>
    </section>
  )
}

// ─── CTA Banner ───────────────────────────────────────────────────────────

function CTABanner() {
  const reduceMotion = useReducedMotion()
  const isMobile = useIsMobile()

  return (
    <section style={{ background: '#0a0a0a', padding: isMobile ? '56px 24px' : '100px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(41,181,204,0.08) 0%, transparent 70%)',
      }} />
      <div style={{ position: 'relative', maxWidth: '680px', margin: '0 auto', textAlign: 'center' }}>
        <motion.h2
          {...fw(reduceMotion)}
          style={{
            fontFamily: '"DM Serif Display", Georgia, serif',
            fontSize: 'clamp(30px, 5vw, 58px)',
            fontWeight: 400, color: '#f0f0f0', margin: '0 0 16px', lineHeight: 1.15,
          }}
        >
          Ready to stop sending <Em>PDF handouts?</Em>
        </motion.h2>
        <motion.p
          {...fw(reduceMotion, 0.15)}
          style={{ fontSize: '17px', color: '#888888', margin: '0 0 36px', lineHeight: 1.6 }}
        >
          Give your clients a better experience — starting today.
        </motion.p>
        <motion.div
          {...fw(reduceMotion, 0.3)}
          className="flex flex-col sm:flex-row"
          style={{ gap: '12px', justifyContent: 'center', alignItems: 'center' }}
        >
          <Link
            to="/signup"
            style={{
              background: '#29B5CC', color: '#0a0a0a',
              padding: '14px 28px', borderRadius: '10px',
              textDecoration: 'none', fontSize: '15px', fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            Start free trial →
          </Link>
          {/* TODO: replace mailto with confirmed address before launch */}
          <a
            href="mailto:hello@manualrx.app"
            style={{
              border: '1px solid rgba(255,255,255,0.14)', color: '#f0f0f0',
              padding: '14px 28px', borderRadius: '10px',
              textDecoration: 'none', fontSize: '15px',
              whiteSpace: 'nowrap',
            }}
          >
            Book a demo
          </a>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: '#0a0a0a', padding: '28px 24px' }}>
      <div
        className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left"
        style={{ maxWidth: '1100px', margin: '0 auto', justifyContent: 'space-between' }}
      >
        <Logo />
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { label: 'Privacy policy', to: '/privacy' },
            { label: 'Terms', to: '/terms' },
            { label: 'Contact', to: '/contact' },
          ].map(({ label, to }) => (
            <Link
              key={label}
              to={to}
              style={{ fontSize: '13px', color: '#555555', textDecoration: 'none', cursor: 'pointer' }}
            >
              {label}
            </Link>
          ))}
        </div>
        <div style={{ fontSize: '13px', color: '#555555' }}>
          © 2026 ManualRx. Built in Australia.
        </div>
      </div>
    </footer>
  )
}

// ─── HomePage ─────────────────────────────────────────────────────────────

export default function HomePage() {
  const lenisRef = useRef(null)

  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.1 })
    lenisRef.current = lenis
    let rafId
    const raf = (time) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)
    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])

  const scrollTo = (id) => lenisRef.current?.scrollTo(id)

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: '"DM Sans", system-ui, sans-serif', color: '#f0f0f0' }}>
      <Nav scrollTo={scrollTo} />
      <Hero scrollTo={scrollTo} />
      <Features />
      <HowItWorks />
      <Pricing />
      <CTABanner />
      <Footer />
    </div>
  )
}

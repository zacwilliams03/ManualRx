import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import Lenis from 'lenis'

// ─── Data (edit copy here) ─────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Features', id: '#features' },
  { label: 'How it works', id: '#how-it-works' },
  { label: 'Pricing', id: '#pricing' },
]

// Icon is stored as a component reference (not JSX) so hoisting isn't required
const FEATURES = [
  {
    title: 'Prescribe in minutes',
    description:
      'Search a built-in exercise library, customise reps and sets, and send your client a complete program in under 5 minutes.',
    Icon: PrescribeIcon,
  },
  {
    title: 'Your own video library',
    description:
      "Upload your own exercise demonstration videos. They're stored permanently, attached to any exercise, and reused across all your clients — not just the built-in library.",
    Icon: VideoIcon,
    featured: true,
  },
  {
    title: 'Client progress tracking',
    description:
      'Clients log their sets, reps, and pain ratings after each session. You see their progress in real time and adjust their program as they improve.',
    Icon: ProgressIcon,
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
      'Search the exercise library, configure reps and sets, add notes, and attach videos in minutes.',
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

function PrescribeIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#29B5CC" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function VideoIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#29B5CC" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
}

function ProgressIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#29B5CC" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
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
          <Link to="/login" className="hidden md:block" style={{ color: '#888888', textDecoration: 'none', fontSize: '14px' }}>
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

function AppMockup() {
  const clients = [
    { initials: 'SJ', name: 'Sarah Johnson', sub: 'Active · 3 exercises', active: true },
    { initials: 'MT', name: 'Mark Thompson', sub: 'Active · 5 exercises', active: false },
    { initials: 'EL', name: 'Emma Liu', sub: 'Active · 2 exercises', active: false },
    { initials: 'RB', name: 'Ryan Burke', sub: 'Inactive', active: false },
  ]
  const exercises = [
    { symbol: '↔', name: 'Cervical Rotation Stretch', detail: '3 sets · 10 reps · Hold 3s' },
    { symbol: '↑', name: 'Chin Tucks', detail: '2 sets · 15 reps · Daily' },
    { symbol: '◆', name: 'Shoulder Blade Squeeze', detail: '3 sets · 12 reps · 5kg' },
  ]

  return (
    <div
      aria-hidden="true"
      style={{
        width: '100%', borderRadius: '12px', overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 0 60px rgba(41,181,204,0.15), 0 0 120px rgba(41,181,204,0.06)',
        background: '#111111',
      }}
    >
      {/* Browser chrome */}
      <div style={{
        padding: '10px 14px', background: '#181818',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#FF5F57' }} />
          <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#FFBD2E' }} />
          <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#28CA41' }} />
        </div>
        <div style={{
          flex: 1, background: '#111111', borderRadius: '5px',
          padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <LockIcon />
          <span style={{ fontSize: '12px', color: '#555555' }}>app.manualrx.app/therapist</span>
        </div>
      </div>

      {/* App body */}
      <div style={{ display: 'flex', height: '380px' }}>
        {/* Sidebar */}
        <div style={{ width: '210px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto' }}>
          <div style={{ padding: '14px 16px 10px', fontSize: '11px', color: '#555555', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
            Clients
          </div>
          {clients.map(c => (
            <div key={c.initials} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 14px',
              background: c.active ? 'rgba(41,181,204,0.12)' : 'transparent',
            }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                background: c.active ? '#29B5CC' : '#2a2a2a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 700,
                color: c.active ? '#0a0a0a' : '#666666',
              }}>
                {c.initials}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: '#f0f0f0' }}>{c.name}</div>
                <div style={{ fontSize: '11px', color: '#555555' }}>{c.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Main panel */}
        <div style={{ flex: 1, padding: '18px 20px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#f0f0f0' }}>Sarah Johnson</div>
              <div style={{ fontSize: '12px', color: '#555555', marginTop: '2px' }}>Cervical rehab program · Week 2</div>
            </div>
            <div style={{
              background: '#29B5CC', color: '#0a0a0a',
              padding: '6px 12px', borderRadius: '6px',
              fontSize: '12px', fontWeight: 600, flexShrink: 0,
            }}>
              + Add exercise
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {exercises.map(ex => (
              <div key={ex.name} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '11px 14px', background: '#181818',
                borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
                  background: 'rgba(41,181,204,0.14)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#29B5CC', fontSize: '14px',
                }}>
                  {ex.symbol}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0' }}>{ex.name}</div>
                  <div style={{ fontSize: '11px', color: '#555555', marginTop: '2px' }}>{ex.detail}</div>
                </div>
                <div style={{
                  fontSize: '11px', color: '#29B5CC',
                  background: 'rgba(41,181,204,0.1)',
                  border: '1px solid rgba(41,181,204,0.2)',
                  padding: '3px 8px', borderRadius: '4px', flexShrink: 0,
                }}>
                  Video attached
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────

function Hero({ scrollTo }) {
  const reduceMotion = useReducedMotion()

  return (
    <section style={{ position: 'relative', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '60px', overflow: 'hidden' }}>
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

      <div style={{ position: 'relative', maxWidth: '1100px', width: '100%', margin: '0 auto', padding: '60px 24px 80px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
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
            fontSize: 'clamp(42px, 7vw, 80px)',
            fontWeight: 400, lineHeight: 1.1,
            color: '#f0f0f0', margin: '0 0 24px', maxWidth: '820px',
          }}
        >
          Exercise prescription,{' '}
          <Em>made easy.</Em>
        </motion.h1>

        <motion.p
          {...fa(reduceMotion, 0.3)}
          style={{ fontSize: '18px', color: '#888888', maxWidth: '520px', lineHeight: 1.65, margin: '0 0 36px' }}
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
          <AppMockup />
        </motion.div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────

function Features() {
  const reduceMotion = useReducedMotion()

  return (
    <section id="features" style={{ background: '#0a0a0a', padding: '100px 24px' }}>
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
                borderTop: feature.featured ? '2px solid #29B5CC' : undefined,
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
                color: feature.featured ? '#29B5CC' : '#f0f0f0',
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

  return (
    <section id="how-it-works" style={{ background: '#111111', padding: '100px 24px' }}>
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

  return (
    <section id="pricing" style={{ background: '#0a0a0a', padding: '100px 24px' }}>
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

  return (
    <section style={{ background: '#0a0a0a', padding: '100px 24px', position: 'relative', overflow: 'hidden' }}>
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
          {['Privacy policy', 'Terms', 'Contact'].map(label => (
            <a
              key={label}
              href="#"
              onClick={e => e.preventDefault()}
              style={{ fontSize: '13px', color: '#555555', textDecoration: 'none', cursor: 'pointer' }}
            >
              {label}
            </a>
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

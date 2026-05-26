import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import ParticleBackground from '../../components/ParticleBackground'

// ---------------------------------------------------------------------------
// Shared style constants
// ---------------------------------------------------------------------------
const CARD = {
  background: 'rgba(13,17,23,0.85)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(100,160,255,0.08)',
  borderRadius: '14px',
  padding: '22px 24px',
  position: 'relative',
  overflow: 'hidden',
}
const SHIMMER = {
  height: '1px',
  background: 'linear-gradient(90deg, transparent, rgba(41,181,204,0.25), rgba(77,142,247,0.25), transparent)',
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
}
const SECTION_LABEL = {
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#888888',
}

// ---------------------------------------------------------------------------
// Pure helpers (module-level)
// ---------------------------------------------------------------------------
function isActive({ start_date, duration_weeks }) {
  if (!start_date || !duration_weeks) return true
  const expiry = new Date(start_date)
  expiry.setDate(expiry.getDate() + duration_weeks * 7 + 7)
  return expiry >= new Date()
}

function generateSlots(prescription, sessionLogs) {
  const { frequency_days, start_date } = prescription
  if (!frequency_days) return []

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const numSlots = Math.min(Math.floor(14 / frequency_days), 14)
  const logDates = (sessionLogs || []).map(l => new Date(l.completed_at))

  return Array.from({ length: numSlots }, (_, k) => {
    if (k === 0) return { status: 'pending' }

    const windowEnd = new Date(today)
    windowEnd.setDate(today.getDate() - k * frequency_days)
    const windowStart = new Date(windowEnd)
    windowStart.setDate(windowEnd.getDate() - frequency_days)

    if (start_date && windowEnd <= new Date(start_date)) return { status: 'pending' }

    const done = logDates.some(d => d >= windowStart && d < windowEnd)
    return { status: done ? 'done' : 'missed' }
  })
}

function freqLabel(fd) {
  if (fd === 1) return 'daily'
  if (fd === 7) return 'weekly'
  return `every ${fd} days`
}

function relativeTime(isoString) {
  const date = new Date(isoString)
  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (date >= today) {
    const h = Math.floor((now - date) / 3600000)
    return h < 1 ? 'Just now' : `${h}h ago`
  }
  if (date >= yesterday) return 'Yesterday'
  const days = Math.floor((today - date) / 86400000)
  return `${days} days ago`
}

function computeAlerts(prescriptions, dismissed) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const alerts = []

  for (const p of prescriptions) {
    // Program complete check: applies to all prescriptions (expired and those still
    // in the 7-day grace period where today > naturalEnd but isActive is still true)
    if (p.start_date && p.duration_weeks && p.frequency_days) {
      const naturalEnd = new Date(p.start_date)
      naturalEnd.setDate(naturalEnd.getDate() + p.duration_weeks * 7)
      const sessionCount = (p.session_logs || []).length
      const requiredSessions = Math.round((p.duration_weeks * 7) / p.frequency_days)
      if (today > naturalEnd && sessionCount >= requiredSessions) {
        const key = `program_complete_${p.id}`
        if (!dismissed.has(key)) {
          alerts.push({ type: 'program_complete', prescription: p, clientId: p.clients?.id, clientName: p.clients?.name })
        }
      }
    }

    // Overdue check: only for active prescriptions with frequency
    if (!isActive(p) || !p.frequency_days) continue

    const slots = generateSlots(p, p.session_logs)
    let consecutiveMisses = 0
    for (let k = 1; k < slots.length; k++) {
      if (slots[k].status === 'missed') consecutiveMisses++
      else break
    }
    if (consecutiveMisses >= 2) {
      const key = `overdue_${p.id}`
      if (!dismissed.has(key)) {
        alerts.push({ type: 'overdue', prescription: p, consecutiveMisses, clientId: p.clients?.id, clientName: p.clients?.name })
      }
    }
  }

  return alerts
}

// ---------------------------------------------------------------------------
// LegendDot
// ---------------------------------------------------------------------------
function LegendDot({ color, outline, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{
        display: 'inline-block',
        width: '7px',
        height: '7px',
        borderRadius: '50%',
        background: outline ? 'transparent' : color,
        border: outline ? '1px solid #3d4f6a' : 'none',
        flexShrink: 0,
      }} />
      <span style={{ fontSize: '11px', color: '#888888' }}>{label}</span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// ClientAdherenceRow
// ---------------------------------------------------------------------------
function ClientAdherenceRow({ client, slots, pct, color, navigate }) {
  return (
    <div
      onClick={() => navigate('/therapist/prescribe/' + client.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px',
        borderRadius: '8px',
        cursor: 'pointer',
        marginBottom: '2px',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#f0f0f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {client.name}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', maxWidth: '120px' }}>
        {slots.map((slot, i) => (
          <div
            key={i}
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              flexShrink: 0,
              background: slot.status === 'done' ? '#29B5CC' : slot.status === 'missed' ? '#3d4f6a' : 'transparent',
              border: slot.status === 'pending' ? '1px solid #3d4f6a' : 'none',
            }}
          />
        ))}
      </div>
      {pct !== null && (
        <div style={{ fontSize: '12px', fontWeight: 600, color, width: '38px', textAlign: 'right', flexShrink: 0 }}>
          {pct}%
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AdherenceCard
// ---------------------------------------------------------------------------
function AdherenceCard({ prescriptions, loading, navigate }) {
  const [expanded, setExpanded] = useState(false)

  const active = prescriptions.filter(p => isActive(p) && p.frequency_days)

  const byClient = {}
  for (const p of active) {
    const cid = p.clients?.id
    if (!cid) continue
    if (!byClient[cid]) byClient[cid] = { client: p.clients, prescriptions: [] }
    byClient[cid].prescriptions.push(p)
  }

  const rows = Object.values(byClient).map(({ client, prescriptions: clientPrescs }) => {
    const allSlots = clientPrescs.flatMap(p => generateSlots(p, p.session_logs))
    const done = allSlots.filter(s => s.status === 'done').length
    const missed = allSlots.filter(s => s.status === 'missed').length
    const pct = done + missed > 0 ? Math.round((done / (done + missed)) * 100) : null
    const color =
      pct === null ? '#888888' : pct >= 80 ? '#29B5CC' : pct >= 60 ? '#fbbf24' : '#f87171'
    return { client, allSlots, pct, color }
  })

  const firstFive = rows.slice(0, 5)
  const extraRows = rows.slice(5)

  return (
    <div style={CARD}>
      <div style={SHIMMER} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <span style={SECTION_LABEL}>Client Adherence</span>
        {rows.length > 5 && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ fontSize: '12px', color: '#29B5CC', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {expanded ? 'Show less' : `See all (${rows.length})`}
          </button>
        )}
      </div>

      {loading && <div style={{ color: '#888888', fontSize: '13px' }}>Loading...</div>}
      {!loading && rows.length === 0 && (
        <div style={{ color: '#888888', fontSize: '13px' }}>No clients with active repeating programs.</div>
      )}

      {firstFive.map(({ client, allSlots, pct, color }) => (
        <ClientAdherenceRow key={client.id} client={client} slots={allSlots} pct={pct} color={color} navigate={navigate} />
      ))}

      <AnimatePresence initial={false}>
        {expanded && extraRows.length > 0 && (
          <motion.div
            key="extra-rows"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            {extraRows.map(({ client, allSlots, pct, color }) => (
              <ClientAdherenceRow key={client.id} client={client} slots={allSlots} pct={pct} color={color} navigate={navigate} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '16px',
        paddingTop: '12px',
        borderTop: '1px solid rgba(100,160,255,0.06)',
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '11px' }}>
          <LegendDot color="#29B5CC" label="Completed" />
          <LegendDot color="#3d4f6a" label="Missed" />
          <LegendDot outline label="Today" />
        </div>
        <span style={{ fontSize: '11px', color: '#555555' }}>Each dot = 1 due session</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AlertRow
// ---------------------------------------------------------------------------
function AlertRow({ alert, onDismiss, navigate }) {
  const [hovered, setHovered] = useState(false)
  const isOverdue = alert.type === 'overdue'

  const dotColor = isOverdue ? '#f87171' : '#4ade80'
  const textColor = isOverdue ? '#f87171' : '#4ade80'
  const bg = isOverdue ? 'rgba(248,113,113,0.09)' : 'rgba(74,222,128,0.09)'
  const border = isOverdue ? '1px solid rgba(248,113,113,0.14)' : '1px solid rgba(74,222,128,0.14)'

  const label = isOverdue
    ? `${alert.consecutiveMisses} missed in a row · ${alert.prescription.name} (${freqLabel(alert.prescription.frequency_days)})`
    : `Completed full program · ${alert.prescription.name}`

  return (
    <motion.div
      exit={{ opacity: 0, x: 12, transition: { duration: 0.22 } }}
      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: bg, border, marginBottom: '6px', cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate('/therapist/prescribe/' + alert.clientId)}
    >
      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', color: textColor, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </div>
        {alert.clientName && (
          <div style={{ fontSize: '11px', color: '#888888', marginTop: '1px' }}>{alert.clientName}</div>
        )}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDismiss() }}
        style={{ opacity: hovered ? 1 : 0, background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#888888', transition: 'opacity 0.15s', flexShrink: 0 }}
        aria-label="Dismiss"
      >
        <Trash2 size={14} />
      </button>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// NeedsAttentionCard
// ---------------------------------------------------------------------------
function NeedsAttentionCard({ prescriptions, loading, dismissed, setDismissed, profile, navigate }) {
  const [expanded, setExpanded] = useState(false)

  const alerts = computeAlerts(prescriptions, dismissed)
  const firstFour = alerts.slice(0, 4)
  const extraAlerts = alerts.slice(4)
  const visible = expanded ? alerts : firstFour
  const hiddenCount = alerts.length - 4

  const dismiss = async (alert) => {
    const key = `${alert.type}_${alert.prescription.id}`
    setDismissed(prev => new Set([...prev, key]))
    await supabase.from('dashboard_dismissed_alerts').upsert(
      { therapist_id: profile.id, alert_type: alert.type, prescription_id: alert.prescription.id },
      { onConflict: 'therapist_id,alert_type,prescription_id', ignoreDuplicates: true }
    )
  }

  return (
    <div style={CARD}>
      <div style={SHIMMER} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <span style={SECTION_LABEL}>Needs Attention</span>
      </div>

      {loading && <div style={{ color: '#888888', fontSize: '13px' }}>Loading...</div>}
      {!loading && alerts.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#29B5CC', fontSize: '13px' }}>
          <span>✓</span> All clients on track
        </div>
      )}

      <AnimatePresence>
        {firstFour.map((alert) => (
          <AlertRow
            key={`${alert.type}_${alert.prescription.id}`}
            alert={alert}
            onDismiss={() => dismiss(alert)}
            navigate={navigate}
          />
        ))}
        {expanded && extraAlerts.map((alert) => (
          <AlertRow
            key={`${alert.type}_${alert.prescription.id}`}
            alert={alert}
            onDismiss={() => dismiss(alert)}
            navigate={navigate}
          />
        ))}
      </AnimatePresence>

      {alerts.length > 4 && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ marginTop: '8px', fontSize: '12px', color: '#888888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {expanded ? 'Show less' : `See ${hiddenCount} more`}
        </button>
      )}

      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(100,160,255,0.06)', fontSize: '11px', color: '#555555', lineHeight: 1.5 }}>
        Overdue: flagged after 2 consecutive misses. Program complete: all sessions finished.
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ActivityFeedCard
// ---------------------------------------------------------------------------
function ActivityFeedCard({ profile, navigate }) {
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('session_logs')
      .select('id, completed_at, session_rpe, prescriptions!inner(name, client_id, therapist_id, clients!inner(name)), exercise_logs(pain_rating)')
      .eq('prescriptions.therapist_id', profile.id)
      .order('completed_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setFeed(data ?? [])
        setLoading(false)
      })
  }, [profile?.id])

  return (
    <div style={CARD}>
      <div style={SHIMMER} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <span style={SECTION_LABEL}>Recent Activity</span>
        <span style={{ fontSize: '12px', color: '#888888' }}>Last 10 sessions</span>
      </div>

      {loading && <div style={{ color: '#888888', fontSize: '13px' }}>Loading...</div>}
      {!loading && feed.length === 0 && (
        <div style={{ color: '#888888', fontSize: '13px' }}>No sessions logged yet.</div>
      )}

      {feed.map(log => {
        const clientName = log.prescriptions?.clients?.name ?? '?'
        const prescName = log.prescriptions?.name ?? ''
        const clientId = log.prescriptions?.client_id
        const initials = clientName.slice(0, 2).toUpperCase()

        const painRatings = (log.exercise_logs || [])
          .map(e => e.pain_rating)
          .filter(r => r !== null && r !== undefined)
        const avgPain =
          painRatings.length > 0
            ? Math.round(painRatings.reduce((a, b) => a + b, 0) / painRatings.length)
            : null

        const rpeColor =
          log.session_rpe !== null && log.session_rpe !== undefined
            ? log.session_rpe <= 6
              ? { bg: 'rgba(41,181,204,0.10)', text: '#29B5CC' }
              : { bg: 'rgba(251,191,36,0.09)', text: '#fbbf24' }
            : null
        const painColor =
          avgPain !== null
            ? avgPain <= 4
              ? { bg: 'rgba(41,181,204,0.10)', text: '#29B5CC' }
              : avgPain <= 7
              ? { bg: 'rgba(251,191,36,0.09)', text: '#fbbf24' }
              : { bg: 'rgba(248,113,113,0.09)', text: '#f87171' }
            : null

        return (
          <div
            key={log.id}
            onClick={() => clientId && navigate('/therapist/prescribe/' + clientId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '9px 8px',
              borderRadius: '8px',
              cursor: clientId ? 'pointer' : 'default',
              marginBottom: '2px',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(77,142,247,0.10)',
              border: '1px solid rgba(77,142,247,0.2)',
              color: '#4d8ef7',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {clientName}
              </div>
              <div style={{ fontSize: '11px', color: '#888888', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {prescName}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
              {rpeColor && (
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: rpeColor.bg, color: rpeColor.text }}>
                  RPE {log.session_rpe}
                </span>
              )}
              {painColor && (
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: painColor.bg, color: painColor.text }}>
                  Pain {avgPain}
                </span>
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#555555', flexShrink: 0, minWidth: '60px', textAlign: 'right' }}>
              {relativeTime(log.completed_at)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardHeader
// ---------------------------------------------------------------------------
function DashboardHeader({ firstName, greeting, alertCount, activeClientCount }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#f0f0f0', margin: 0 }}>
        Good {greeting}, {firstName}!
      </h1>
      <p style={{ marginTop: '4px', fontSize: '14px', color: '#888888' }}>
        {alertCount > 0
          ? <><span style={{ color: '#f87171' }}>{alertCount} {alertCount === 1 ? 'client needs' : 'clients need'} attention</span>{' · '}{activeClientCount} active {activeClientCount === 1 ? 'client' : 'clients'}</>
          : <><span style={{ color: '#29B5CC' }}>All clients on track</span>{' · '}{activeClientCount} active {activeClientCount === 1 ? 'client' : 'clients'}</>
        }
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TherapistDashboard (top-level export)
// ---------------------------------------------------------------------------
export default function TherapistDashboard() {
  const { profile } = useAuth()
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(new Set())
  const navigate = useNavigate()

  useEffect(() => {
    if (!profile?.id) return
    Promise.all([
      supabase
        .from('prescriptions')
        .select('id, name, frequency_days, start_date, duration_weeks, clients!inner(id, name), session_logs(completed_at)')
        .eq('therapist_id', profile.id),
      supabase
        .from('dashboard_dismissed_alerts')
        .select('alert_type, prescription_id'),
    ]).then(([{ data: presc }, { data: alerts }]) => {
      setPrescriptions(presc ?? [])
      setDismissed(new Set((alerts ?? []).map(a => `${a.alert_type}_${a.prescription_id}`)))
      setLoading(false)
    })
  }, [profile?.id])

  const alertCount = computeAlerts(prescriptions, dismissed).length

  const activeClientCount = loading
    ? null
    : [
        ...new Set(
          prescriptions.filter(isActive).map(p => p.clients?.id).filter(Boolean)
        ),
      ].length

  const h = new Date().getHours()
  const greeting = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
  const firstName = profile?.name?.split(' ')[0] ?? ''

  return (
    <SidebarLayout>
      <ParticleBackground />
      <div style={{ position: 'relative', zIndex: 1, padding: '40px 40px 60px', minHeight: '100vh' }}>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.04 }}
        >
          <DashboardHeader
            firstName={firstName}
            greeting={greeting}
            alertCount={alertCount}
            activeClientCount={activeClientCount}
          />
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12 }}
          >
            <AdherenceCard prescriptions={prescriptions} loading={loading} navigate={navigate} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.20 }}
          >
            <NeedsAttentionCard
              prescriptions={prescriptions}
              loading={loading}
              dismissed={dismissed}
              setDismissed={setDismissed}
              profile={profile}
              navigate={navigate}
            />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.28 }}
        >
          <ActivityFeedCard profile={profile} navigate={navigate} />
        </motion.div>
      </div>
    </SidebarLayout>
  )
}

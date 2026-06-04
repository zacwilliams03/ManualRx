import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import BottomNav from '../../components/client/BottomNav'
import PageHero from '../../components/shared/PageHero'
import { CARD } from '../../components/therapist/styles'
import ShimmerLine from '../../components/shared/ShimmerLine'

export default function CheckInWizard() {
  const { instanceId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const [instance, setInstance] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({}) // { questionId: value }
  const [missedInstance, setMissedInstance] = useState(null)
  const [missedDismissed, setMissedDismissed] = useState(false)

  useEffect(() => {
    if (profile?.id) fetchInstance()
  }, [profile?.id, instanceId])

  async function fetchInstance() {
    setLoading(true)
    const { data, error: e } = await supabase
      .from('check_in_instances')
      .select(`
        id, period_start_date, status, form_id,
        check_in_forms(id, name, check_in_questions(id, question_text, question_type, order_index))
      `)
      .eq('id', instanceId)
      .single()

    if (e || !data) { setError('Check-in not found.'); setLoading(false); return }
    if (data.status === 'completed') { navigate('/client'); return }

    setInstance(data)
    const qs = (data.check_in_forms?.check_in_questions ?? [])
      .sort((a, b) => a.order_index - b.order_index)
    setQuestions(qs)

    // Check for missed instances (pending, earlier period, same form)
    const { data: missed } = await supabase
      .from('check_in_instances')
      .select('id, period_start_date')
      .eq('form_id', data.form_id)
      .eq('status', 'pending')
      .lt('period_start_date', data.period_start_date)
      .order('period_start_date', { ascending: false })
      .limit(1)

    if (missed && missed.length > 0) setMissedInstance(missed[0])
    setLoading(false)
  }

  function setAnswer(questionId, value) {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const allAnswered = questions.length > 0 && questions.every(q => answers[q.id] !== undefined)

  async function handleSubmit() {
    if (!allAnswered) return
    setSubmitting(true)

    const { error: insertError } = await supabase
      .from('check_in_responses')
      .insert({ instance_id: instanceId, answers })

    if (insertError) { setError('Failed to submit. Please try again.'); setSubmitting(false); return }

    await supabase.from('check_in_instances').update({ status: 'completed' }).eq('id', instanceId)

    // The check-in card disappears from the Dashboard feed — that is the success signal.
    // Dashboard has no toast consumer so no state is passed.
    navigate('/client')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--color-bg)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        <PageHero title="Check-In" subtitle="" />
        <div style={{ padding: '16px', fontSize: '13px', color: 'var(--color-muted)' }}>Loading…</div>
        <BottomNav />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--color-bg)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        <PageHero title="Check-In" subtitle="" />
        <div style={{ padding: '16px', fontSize: '13px', color: '#f85149' }}>{error}</div>
        <BottomNav />
      </div>
    )
  }

  const form = instance?.check_in_forms
  const periodLabel = instance ? new Date(instance.period_start_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
      <PageHero title={form?.name ?? 'Check-In'} subtitle={`Week of ${periodLabel} · ${questions.length} questions`} />

      <div style={{ maxWidth: '512px', padding: '0 16px 24px' }}>

        {/* Missed check-in prompt */}
        {missedInstance && !missedDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ background: 'rgba(248,81,73,0.07)', border: '1px solid rgba(248,81,73,0.2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}
          >
            <div style={{ fontSize: '13px', color: '#f85149', fontWeight: 500, marginBottom: '8px' }}>
              ⚠ You missed your check-in for {new Date(missedInstance.period_start_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}. Would you like to complete that first?
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => navigate(`/client/checkin/${missedInstance.id}`)}
                style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: 'rgba(248,81,73,0.15)', border: '1px solid rgba(248,81,73,0.3)', color: '#f85149', cursor: 'pointer' }}
              >
                Complete {new Date(missedInstance.period_start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} first
              </button>
              <button
                onClick={() => setMissedDismissed(true)}
                style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', background: 'transparent', border: '1px solid rgba(100,160,255,0.12)', color: 'var(--color-muted)', cursor: 'pointer' }}
              >
                Skip
              </button>
            </div>
          </motion.div>
        )}

        {/* Questions */}
        {questions.map((q, i) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.25 }}
            style={{ ...CARD, marginBottom: '14px' }}
          >
            <ShimmerLine />
            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-subtle)', marginBottom: '6px' }}>Question {i + 1}</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '14px' }}>{q.question_text}</div>

            {q.question_type === 'scale' ? (
              <div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAnswer(q.id, n)}
                      style={{ width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', background: answers[q.id] === n ? '#29B5CC' : 'rgba(255,255,255,0.03)', border: answers[q.id] === n ? '2px solid #29B5CC' : '1px solid rgba(100,160,255,0.15)', color: answers[q.id] === n ? '#000' : 'var(--color-muted)' }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-subtle)', marginTop: '8px' }}>
                  <span>1 – Not good</span>
                  <span>5 – Very good</span>
                </div>
              </div>
            ) : (
              <textarea
                value={answers[q.id] ?? ''}
                onChange={e => setAnswer(q.id, e.target.value)}
                placeholder="Write your answer here…"
                rows={3}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(100,160,255,0.12)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: 'var(--color-text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
              />
            )}
          </motion.div>
        ))}

        {error && <p style={{ fontSize: '13px', color: '#f85149', marginBottom: '12px' }}>{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          style={{ width: '100%', padding: '14px', background: allAnswered ? '#29B5CC' : 'rgba(255,255,255,0.06)', color: allAnswered ? '#000' : 'var(--color-muted)', fontSize: '14px', fontWeight: 600, border: 'none', borderRadius: '10px', cursor: allAnswered ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all 0.15s' }}
        >
          {submitting ? 'Submitting…' : 'Submit Check-In'}
        </button>
      </div>

      <BottomNav />
    </div>
  )
}

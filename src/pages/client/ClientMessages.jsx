import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import BottomNav from '../../components/client/BottomNav'
import PageHero from '../../components/shared/PageHero'

function formatTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function ClientMessages() {
  const { profile } = useAuth()

  // clientId = clients.id (FK), NOT auth.uid()
  const [clientId, setClientId] = useState(null)
  const [therapistId, setTherapistId] = useState(null)
  const [therapistName, setTherapistName] = useState('Your therapist')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (profile?.id) loadThread()
  }, [profile?.id])

  // Poll every 30s once we have the IDs
  useEffect(() => {
    if (!clientId || !therapistId) return
    const id = setInterval(() => fetchMessagesFor(therapistId, clientId), 30000)
    return () => clearInterval(id)
  }, [clientId, therapistId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadThread() {
    // Step 1: resolve clients.id + therapist_id in one query
    const { data: clientRow, error: clientErr } = await supabase
      .from('clients')
      .select('id, therapist_id')
      .eq('user_id', profile.id)
      .limit(1)
      .single()

    if (clientErr || !clientRow) {
      setLoading(false)
      return
    }

    setClientId(clientRow.id)
    setTherapistId(clientRow.therapist_id)

    // Step 2: therapist display name (from custom users table, not auth.users)
    const { data: therapistUser } = await supabase
      .from('users')
      .select('name')
      .eq('id', clientRow.therapist_id)
      .single()
    if (therapistUser?.name) setTherapistName(therapistUser.name)

    // Step 3: mark therapist messages as read
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('therapist_id', clientRow.therapist_id)
      .eq('client_id', clientRow.id)
      .eq('sender_role', 'therapist')
      .is('read_at', null)

    // Step 4: fetch messages
    await fetchMessagesFor(clientRow.therapist_id, clientRow.id)
    setLoading(false)
  }

  async function fetchMessagesFor(tId, cId) {
    const { data } = await supabase
      .from('messages')
      .select('id, sender_role, body, created_at')
      .eq('therapist_id', tId)
      .eq('client_id', cId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
  }

  async function handleSend() {
    if (!body.trim() || sending || !clientId || !therapistId) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      therapist_id: therapistId,
      client_id: clientId,   // clients.id, NOT profile.id
      sender_role: 'client',
      body: body.trim(),
    })
    setSending(false)
    if (error) {
      console.error('Failed to send message:', error)
      return
    }
    setBody('')
    await fetchMessagesFor(therapistId, clientId)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ paddingBottom: '72px' }}>
      <PageHero title="Messages" subtitle={therapistName} />

      {/* Messages */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '200px' }}>
        {loading ? (
          <p style={{ color: 'var(--color-muted)', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>Loading…</p>
        ) : messages.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
            No messages yet. Send your therapist a message below.
          </p>
        ) : messages.map(msg => {
          const mine = msg.sender_role === 'client'
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%', padding: '10px 14px', wordBreak: 'break-word',
                borderRadius: mine ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                background: mine ? 'rgba(41,181,204,0.12)' : 'var(--color-elevated)',
                border: mine ? '1px solid rgba(41,181,204,0.2)' : '1px solid var(--color-border)',
                fontSize: '14px', color: 'var(--color-text)', lineHeight: 1.5,
              }}>
                {msg.body}
              </div>
              <span style={{ fontSize: '10px', color: 'var(--color-subtle)', marginTop: '3px', padding: '0 4px' }}>
                {formatTime(msg.created_at)}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--color-border)',
        display: 'flex', gap: '10px',
        background: 'var(--color-bg)',
      }}>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${therapistName}…`}
          rows={1}
          style={{
            flex: 1,
            background: 'var(--color-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '14px',
            color: 'var(--color-text)',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.4,
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!body.trim() || sending}
          style={{
            background: 'rgba(41,181,204,0.8)',
            color: '#000',
            border: 'none',
            borderRadius: '10px',
            padding: '0 18px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: !body.trim() || sending ? 'not-allowed' : 'pointer',
            opacity: !body.trim() || sending ? 0.5 : 1,
            transition: 'opacity 0.15s',
            flexShrink: 0,
          }}
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>

      <BottomNav />
    </div>
  )
}

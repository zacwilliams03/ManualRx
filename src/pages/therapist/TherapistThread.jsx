import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'

function formatTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function TherapistThread() {
  const { clientId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [clientName, setClientName] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (profile?.id && clientId) loadThread()
  }, [profile?.id, clientId])

  useEffect(() => {
    if (!profile?.id || !clientId) return
    const id = setInterval(fetchMessages, 30000)
    return () => clearInterval(id)
  }, [profile?.id, clientId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadThread() {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .single()
    setClientName(clientRow?.name ?? 'Client')

    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('therapist_id', profile.id)
      .eq('client_id', clientId)
      .eq('sender_role', 'client')
      .is('read_at', null)

    await fetchMessages()
    setLoading(false)
  }

  async function fetchMessages() {
    const { data } = await supabase
      .from('messages')
      .select('id, sender_role, body, created_at')
      .eq('therapist_id', profile.id)
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
  }

  async function handleSend() {
    if (!body.trim() || sending) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      therapist_id: profile.id,
      client_id: clientId,
      sender_role: 'therapist',
      body: body.trim(),
    })
    setSending(false)
    if (!error) {
      setBody('')
      await fetchMessages()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <SidebarLayout>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '14px 20px',
          background: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <button
            type="button"
            onClick={() => navigate('/therapist/messages')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', padding: '4px', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
            background: 'rgba(41,181,204,0.15)', color: 'var(--color-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '13px',
          }}>
            {clientName[0]?.toUpperCase() ?? '?'}
          </div>
          <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--color-text)' }}>
            {clientName}
          </span>
        </div>

        {/* Messages */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '300px' }}>
          {loading ? (
            <p style={{ color: 'var(--color-muted)', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>Loading…</p>
          ) : messages.length === 0 ? (
            <p style={{ color: 'var(--color-muted)', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
              No messages yet. Send the first message below.
            </p>
          ) : messages.map(msg => {
            const mine = msg.sender_role === 'therapist'
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%', padding: '10px 14px', wordBreak: 'break-word',
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
          position: 'sticky', bottom: 0,
          padding: '12px 20px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex', gap: '10px',
          background: 'var(--color-bg)',
        }}>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={clientName ? `Message ${clientName}…` : 'Message…'}
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
      </div>
    </SidebarLayout>
  )
}

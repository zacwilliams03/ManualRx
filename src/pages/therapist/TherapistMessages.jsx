import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import PageHero from '../../components/shared/PageHero'
import { CARD } from '../../components/therapist/styles'
import ShimmerLine from '../../components/shared/ShimmerLine'

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(diff / 3600000)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(diff / 86400000)}d`
}

export default function TherapistMessages() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (profile?.id) fetchConversations()
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.id) return
    const id = setInterval(fetchConversations, 30000)
    return () => clearInterval(id)
  }, [profile?.id])

  async function fetchConversations() {
    const [clientsRes, messagesRes] = await Promise.all([
      supabase
        .from('clients')
        .select('id, name')
        .eq('therapist_id', profile.id)
        .order('name'),
      supabase
        .from('messages')
        .select('id, client_id, sender_role, body, created_at, read_at')
        .eq('therapist_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(500),
    ])

    if (clientsRes.error) {
      setError('Failed to load clients.')
      setLoading(false)
      return
    }

    // Build message map: one entry per client (most recent message first)
    const msgMap = {}
    ;(messagesRes.data ?? []).forEach(msg => {
      if (!msgMap[msg.client_id]) {
        msgMap[msg.client_id] = {
          last_message: msg.body,
          last_message_at: msg.created_at,
          unread_count: 0,
        }
      }
      if (msg.sender_role === 'client' && !msg.read_at) {
        msgMap[msg.client_id].unread_count++
      }
    })

    // Merge: all clients, attach message data where it exists
    const withMessages = []
    const withoutMessages = []
    ;(clientsRes.data ?? []).forEach(client => {
      const msg = msgMap[client.id]
      const entry = { client_id: client.id, client_name: client.name, ...msg }
      if (msg) withMessages.push(entry)
      else withoutMessages.push(entry)
    })

    // Clients with messages first (already sorted by last_message_at desc via query),
    // then clients with no messages (already sorted alphabetically via query)
    setConversations([...withMessages, ...withoutMessages])
    setLoading(false)
  }

  return (
    <SidebarLayout>
      <PageHero title="Messages" subtitle="Conversations with your clients" />
      <div style={{ padding: '0 24px 40px' }}>
        {loading ? (
          <div style={{ ...CARD }}>
            <ShimmerLine />
            <div style={{ height: '60px' }} />
          </div>
        ) : error ? (
          <p style={{ color: 'var(--color-danger)', fontSize: '14px' }}>{error}</p>
        ) : conversations.length === 0 ? (
          <div style={{ ...CARD, textAlign: 'center', padding: '40px 24px' }}>
            <p style={{ color: 'var(--color-muted)', fontSize: '14px', margin: 0 }}>
              No clients yet. Add clients from the Clients page to start messaging.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {conversations.map(conv => (
              <button
                key={conv.client_id}
                type="button"
                onClick={() => navigate(`/therapist/messages/${conv.client_id}`)}
                style={{
                  ...CARD,
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  border: conv.unread_count > 0
                    ? '1px solid rgba(59,130,246,0.3)'
                    : '1px solid var(--color-border)',
                }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(41,181,204,0.15)', color: 'var(--color-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '15px',
                }}>
                  {conv.client_name[0]?.toUpperCase() ?? '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <span style={{
                      fontWeight: conv.unread_count > 0 ? 700 : 500,
                      fontSize: '14px',
                      color: 'var(--color-text)',
                    }}>
                      {conv.client_name}
                    </span>
                    {conv.last_message_at && (
                      <span style={{ fontSize: '11px', color: 'var(--color-muted)', flexShrink: 0, marginLeft: '8px' }}>
                        {relativeTime(conv.last_message_at)}
                      </span>
                    )}
                  </div>
                  <p style={{
                    fontSize: '13px', color: 'var(--color-muted)', margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontStyle: conv.last_message ? 'normal' : 'italic',
                  }}>
                    {conv.last_message
                      ? (conv.last_message.length > 60 ? conv.last_message.slice(0, 60) + '…' : conv.last_message)
                      : 'No messages yet — send the first one'}
                  </p>
                </div>
                {conv.unread_count > 0 && (
                  <span style={{
                    background: '#3b82f6', color: '#fff', borderRadius: '10px',
                    padding: '2px 8px', fontSize: '11px', fontWeight: 700, flexShrink: 0,
                  }}>
                    {conv.unread_count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}

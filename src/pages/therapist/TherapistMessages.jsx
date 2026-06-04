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
    const { data, error: fetchError } = await supabase
      .from('messages')
      .select('id, client_id, sender_role, body, created_at, read_at, clients(name)')
      .eq('therapist_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(500)

    if (fetchError) {
      setError('Failed to load messages.')
      setLoading(false)
      return
    }

    // Deduplicate: one entry per client, keeping the most recent message (first seen)
    const map = {}
    ;(data ?? []).forEach(msg => {
      if (!map[msg.client_id]) {
        map[msg.client_id] = {
          client_id: msg.client_id,
          client_name: msg.clients?.name ?? 'Unknown',
          last_message: msg.body,
          last_message_at: msg.created_at,
          unread_count: 0,
        }
      }
      if (msg.sender_role === 'client' && !msg.read_at) {
        map[msg.client_id].unread_count++
      }
    })

    setConversations(Object.values(map))
    setLoading(false)
  }

  return (
    <SidebarLayout>
      <PageHero title="Messages" subtitle="Conversations with your clients" />
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 16px 40px' }}>
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
              No messages yet. Your clients can message you from their Messages tab.
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
                    <span style={{ fontSize: '11px', color: 'var(--color-muted)', flexShrink: 0, marginLeft: '8px' }}>
                      {relativeTime(conv.last_message_at)}
                    </span>
                  </div>
                  <p style={{
                    fontSize: '13px', color: 'var(--color-muted)', margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {conv.last_message.length > 60 ? conv.last_message.slice(0, 60) + '…' : conv.last_message}
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

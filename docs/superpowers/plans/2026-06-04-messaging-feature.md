# In-App Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add async 1:1 messaging between therapists and clients with in-app unread badges and 30-second polling.

**Architecture:** Single `messages` table — thread = all rows matching `(therapist_id, client_id)`, sorted by `created_at`. Therapist: inbox list → thread navigation. Client: single thread. Polling via `setInterval` cleared on unmount. `auth.uid()` ≠ `clients.id` — client pages must look up `clients.id` via `WHERE user_id = auth.uid()` before inserting or querying messages.

**Tech Stack:** React 18 + Supabase JS SDK v2 + lucide-react + existing helpers: `CARD`, `SECTION_LABEL` from `styles.js`, `ShimmerLine`, `PageHero`, `SidebarLayout`, `BottomNav`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/hooks/useUnreadCount.js` | Fetch unread message count for current user |
| Create | `src/pages/therapist/TherapistMessages.jsx` | Therapist inbox: list of client conversations |
| Create | `src/pages/therapist/TherapistThread.jsx` | Therapist thread view for one client |
| Create | `src/pages/client/ClientMessages.jsx` | Client single thread with their therapist |
| Modify | `src/App.jsx` | Add 3 new protected routes |
| Modify | `src/components/therapist/AppSidebar.jsx` | Add Messages nav item with unread count badge |
| Modify | `src/components/client/BottomNav.jsx` | Add Messages tab with unread dot badge |

---

## Task 1: Database Migration

**Files:** Run SQL in Supabase dashboard — no code file.

- [ ] **Step 1: Run migration in Supabase SQL Editor**

Open Supabase dashboard → SQL Editor → New query. Paste and run:

```sql
CREATE TABLE messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id    uuid        NOT NULL REFERENCES clients(id)    ON DELETE CASCADE,
  sender_role  text        NOT NULL CHECK (sender_role IN ('therapist', 'client')),
  body         text        NOT NULL CHECK (char_length(body) > 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz
);

CREATE INDEX messages_therapist_client_idx
  ON messages (therapist_id, client_id, created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Therapist: full access to own messages
CREATE POLICY "therapist_own_messages" ON messages
  FOR ALL USING (therapist_id = auth.uid());

-- Client: full access via clients table join (auth.uid() != clients.id)
CREATE POLICY "client_own_messages" ON messages
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );
```

Expected output: "Success. No rows returned."

- [ ] **Step 2: Verify**

In Supabase → Table Editor, confirm `messages` table appears with columns: `id`, `therapist_id`, `client_id`, `sender_role`, `body`, `created_at`, `read_at`.

---

## Task 2: `useUnreadCount` hook

**Files:**
- Create: `src/hooks/useUnreadCount.js`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useUnreadCount.js`:

```js
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export function useUnreadCount() {
  const [count, setCount] = useState(0)
  const { profile } = useAuth()

  useEffect(() => {
    if (!profile) return
    let cancelled = false

    async function run() {
      if (profile.role === 'therapist') {
        const { count: c } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('therapist_id', profile.id)
          .eq('sender_role', 'client')
          .is('read_at', null)
        if (!cancelled) setCount(c ?? 0)
      } else {
        // Two-step: auth.uid() != clients.id, so resolve first
        const { data: clientRow } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', profile.id)
          .single()
        if (!clientRow || cancelled) return
        const { count: c } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', clientRow.id)
          .eq('sender_role', 'therapist')
          .is('read_at', null)
        if (!cancelled) setCount(c ?? 0)
      }
    }

    run()
    return () => { cancelled = true }
  }, [profile])

  return count
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useUnreadCount.js
git commit -m "feat: add useUnreadCount hook"
```

---

## Task 3: `TherapistMessages.jsx` — Inbox

**Files:**
- Create: `src/pages/therapist/TherapistMessages.jsx`

**Pattern:** Follows `Clients.jsx` — `SidebarLayout` + `PageHero` + `CARD` cards. Query fetches last 500 messages, deduplicates by `client_id` in JS to get one conversation row per client with last-message preview and unread count.

- [ ] **Step 1: Create the page**

Create `src/pages/therapist/TherapistMessages.jsx`:

```jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/therapist/TherapistMessages.jsx
git commit -m "feat: add therapist messages inbox page"
```

---

## Task 4: `TherapistThread.jsx` — Thread View

**Files:**
- Create: `src/pages/therapist/TherapistThread.jsx`

**Pattern:** `useParams()` for `clientId`. Fetch client name + messages. Mark unread as read on mount. Poll every 30s. Auto-scroll to bottom on message updates. Enter key sends (Shift+Enter for newline).

- [ ] **Step 1: Create the page**

Create `src/pages/therapist/TherapistThread.jsx`:

```jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/therapist/TherapistThread.jsx
git commit -m "feat: add therapist thread view"
```

---

## Task 5: `ClientMessages.jsx` — Client Thread

**Files:**
- Create: `src/pages/client/ClientMessages.jsx`

**Critical:** `auth.uid()` ≠ `clients.id`. The page must fetch `clients.id` AND `clients.therapist_id` from the `clients` table on mount (one query). Both are required for inserting and querying messages. Do NOT use `profile.id` as `client_id`.

- [ ] **Step 1: Create the page**

Create `src/pages/client/ClientMessages.jsx`:

```jsx
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
    if (!error) {
      setBody('')
      await fetchMessagesFor(therapistId, clientId)
    }
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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/client/ClientMessages.jsx
git commit -m "feat: add client messages page"
```

---

## Task 6: Wire Routing and Navigation

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/therapist/AppSidebar.jsx`
- Modify: `src/components/client/BottomNav.jsx`

### 6a — App.jsx routes

- [ ] **Step 1: Add imports to `src/App.jsx`**

Add after the existing `CheckInWizard` import (line 23):

```jsx
import TherapistMessages from './pages/therapist/TherapistMessages'
import TherapistThread from './pages/therapist/TherapistThread'
import ClientMessages from './pages/client/ClientMessages'
```

- [ ] **Step 2: Add therapist routes in `src/App.jsx`**

Add after the existing `checkins/:formId` route (after line 104):

```jsx
<Route path="/therapist/messages" element={<ProtectedRoute requiredRole="therapist"><TherapistMessages /></ProtectedRoute>} />
<Route path="/therapist/messages/:clientId" element={<ProtectedRoute requiredRole="therapist"><TherapistThread /></ProtectedRoute>} />
```

- [ ] **Step 3: Add client route in `src/App.jsx`**

Add after the existing `/client/checkin/:instanceId` route (after line 111):

```jsx
<Route path="/client/messages" element={<ProtectedRoute requiredRole="client"><ClientMessages /></ProtectedRoute>} />
```

### 6b — AppSidebar.jsx

- [ ] **Step 4: Add `MessageSquare` import and `useUnreadCount` to `src/components/therapist/AppSidebar.jsx`**

Add `MessageSquare` to the existing lucide-react import line (line 6):

```jsx
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
```

Add after the existing `import { supabase }` line (line 18):

```jsx
import { useUnreadCount } from '../../hooks/useUnreadCount'
```

- [ ] **Step 5: Add `badge` prop to `NavItem` in `src/components/therapist/AppSidebar.jsx`**

Replace the `NavItem` function signature and label span (lines 52–85). The only changes are: add `badge` to destructured props, add `flex-1` class to the label span, and render the badge after the label:

```jsx
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
          active ? 'text-dark-accent' : 'hover:text-dark-text',
        ].join(' ')}
        style={{
          minHeight: '40px',
          paddingLeft: '10px',
          paddingRight: '12px',
          background: active ? 'rgba(41,181,204,0.08)' : 'transparent',
          borderLeft: active ? '2px solid #29B5CC' : '2px solid transparent',
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
```

- [ ] **Step 6: Call `useUnreadCount` and add Messages nav item in `src/components/therapist/AppSidebar.jsx`**

In the `AppSidebar` component (line 344), add the hook call at the top:

```jsx
export default function AppSidebar({ onClose }) {
  const unreadCount = useUnreadCount()
  return (
    // ... existing JSX unchanged ...
```

Add the Messages `NavItem` after the Check-Ins item in the nav links section (after the existing `ClipboardList` NavItem):

```jsx
<NavItem
  to="/therapist/messages"
  icon={MessageSquare}
  label="Messages"
  activePrefixes={['/therapist/messages']}
  badge={unreadCount}
  onClose={onClose}
/>
```

### 6c — BottomNav.jsx

- [ ] **Step 7: Rewrite `src/components/client/BottomNav.jsx`**

Full replacement (adds Messages tab with `showBadge`, calls `useUnreadCount` once):

```jsx
import { useLocation, Link } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'
import { LayoutList, History, MessageSquare, Settings } from 'lucide-react'
import { useUnreadCount } from '../../hooks/useUnreadCount'

const TABS = [
  { to: '/client',          icon: LayoutList,    label: 'Sessions',  exact: true,  showBadge: false },
  { to: '/client/history',  icon: History,       label: 'History',   exact: false, showBadge: false },
  { to: '/client/messages', icon: MessageSquare, label: 'Messages',  exact: false, showBadge: true  },
  { to: '/client/settings', icon: Settings,      label: 'Settings',  exact: false, showBadge: false },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const prefersReduced = useReducedMotion()
  const unreadCount = useUnreadCount()

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 inset-x-0 z-40"
      style={{
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-stretch">
        {TABS.map(({ to, icon: Icon, label, exact, showBadge }) => {
          const active = exact ? pathname === to : pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex flex-1 flex-col items-center justify-center gap-1 py-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dark-accent focus-visible:ring-inset',
                prefersReduced ? '' : 'transition-colors',
                active ? 'text-dark-accent' : 'text-dark-muted hover:text-dark-text',
              ].join(' ')}
              style={{ minHeight: '56px' }}
            >
              <div style={{ position: 'relative' }}>
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                {showBadge && unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-3px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#3b82f6',
                  }} />
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 8: Commit everything**

```bash
git add src/App.jsx src/components/therapist/AppSidebar.jsx src/components/client/BottomNav.jsx
git commit -m "feat: wire messaging routes and navigation badges"
```

---

## Verification

Work through these manually after all tasks are complete:

1. **DB:** In Supabase Table Editor, manually insert a test row into `messages`. Confirm the CHECK constraints reject empty `body` and invalid `sender_role`.

2. **Send from therapist:** Navigate to `/therapist/messages`. Confirm empty state shows. Navigate directly to `/therapist/messages/<a valid clients.id UUID>`. Type a message and send. Confirm it appears right-aligned.

3. **Send from client:** Log in as the client. Navigate to `/client/messages`. Confirm the therapist's name appears in the header. Send a reply. Confirm it appears right-aligned.

4. **Unread badge:** Without opening the therapist thread, confirm the Messages sidebar item shows a count badge after the client sends. Badge should clear when the therapist opens the thread.

5. **Inbox list:** After the client sends, navigate to `/therapist/messages`. Confirm the client row appears with last-message preview and relative timestamp.

6. **Polling:** Stay on the thread page as one user. Send a message from the other user's session. Confirm it appears within 30 seconds without a page reload.

7. **Client BottomNav badge:** While unread messages exist for the client, confirm the Messages tab shows the blue dot. Confirm it clears after opening the messages page.

8. **Empty state:** Navigate to `/therapist/messages` with no messages — confirm "No messages yet. Your clients can message you from their Messages tab." is shown.

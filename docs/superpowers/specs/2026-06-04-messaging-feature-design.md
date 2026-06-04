# In-App Messaging Feature Design

**Date:** 2026-06-04
**Status:** Approved for implementation

---

## Context

Therapists and clients currently have no direct communication channel within PrescriptR. All contact happens outside the app. This feature adds an async 1:1 messaging thread between each therapist–client pair. Either party can initiate. Messages are not real-time (polling only for v1); notifications are in-app unread badges only.

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Interaction style | Async thread / inbox (not real-time chat) |
| Who can initiate | Either party |
| Notifications | In-app unread badge only — no email |
| UI placement | Dedicated Messages page (therapist sidebar + client bottom nav) |
| Therapist layout | Full-page navigation: client list → thread (not split panel) |
| Transport | Polling every 30s — Supabase Realtime deferred to a future iteration |

---

## Architecture

Single `messages` table. The conversation between a therapist and client is all rows matching that `(therapist_id, client_id)` pair, sorted by `created_at`. No separate `conversations` table — the pair always forms a unique 1:1 thread. Unread state is tracked via a `read_at` column on each message row (NULL = unread by recipient).

---

## Data Model

```sql
CREATE TABLE messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id    uuid        NOT NULL REFERENCES clients(id)    ON DELETE CASCADE,
  sender_role  text        NOT NULL CHECK (sender_role IN ('therapist', 'client')),
  body         text        NOT NULL CHECK (char_length(body) > 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz           -- NULL = unread by recipient
);

CREATE INDEX messages_therapist_client_idx
  ON messages (therapist_id, client_id, created_at DESC);
```

**Notes:**
- No `sender_id` column — sender identity is fully derivable from `sender_role` combined with the `therapist_id`/`client_id` already on the row.
- `read_at` represents when the *recipient* read the message, not the sender.

### RLS Policies

```sql
-- Therapist: full access to own messages
CREATE POLICY "therapist_own_messages" ON messages
  FOR ALL USING (therapist_id = auth.uid());

-- Client: full access to their messages
CREATE POLICY "client_own_messages" ON messages
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );
```

### Unread Logic

- **A message is unread** if `read_at IS NULL` and the sender is not the current user.
- **Therapist unread count:** `COUNT(*) WHERE therapist_id = auth.uid() AND sender_role = 'client' AND read_at IS NULL`
- **Client unread count:** `COUNT(*) WHERE client_id = clientRecord.id AND sender_role = 'therapist' AND read_at IS NULL`
- **Mark as read:** Bulk `UPDATE messages SET read_at = now() WHERE therapist_id = ? AND client_id = ? AND read_at IS NULL AND sender_role = <other_party>` fires when a thread is opened, before the first render.

---

## Feature Areas

### 1. Therapist: Messages Inbox (`/therapist/messages`)

New page `TherapistMessages.jsx`. Full-width list of client conversations, one row per client who has at least one message (or all clients — see note below).

**List row shows:**
- Client avatar initial + name
- Last message preview (truncated to ~60 chars)
- Timestamp of last message (relative: "2m", "1h", "2d")
- Unread count badge (blue pill) if > 0 unread messages from that client

**Sort:** By `created_at DESC` of the most recent message in each thread — most recently active conversation first.

**Empty state:** "No messages yet. Your clients can message you from their Messages tab."

**Note on scope:** Only show clients who have at least one message. Therapists do not need to see every client in the inbox — they can initiate from the thread page directly if needed. A "New Message" path is not required for v1 since the thread page is accessible via the client list.

**Nav:** Add "Messages" to `AppSidebar.jsx` after the Check-Ins item. Use `MessageSquare` from lucide-react. Show unread count badge (fetched via `useUnreadCount` on mount).

---

### 2. Therapist: Thread View (`/therapist/messages/:clientId`)

New page `TherapistThread.jsx`.

**Header:** Back arrow (`←`) → `/therapist/messages`, client avatar initial + name.

**Thread body:**
- Messages sorted oldest → newest (ascending `created_at`)
- Client messages aligned left, therapist messages aligned right
- Each message bubble: body text + timestamp below
- Unread messages in the thread are marked read on mount (bulk UPDATE before first render)

**Send input:** Textarea at bottom, Send button. Disabled while empty. On submit:
1. INSERT new message row: `{ therapist_id, client_id, sender_role: 'therapist', body }`
2. Clear textarea
3. Refetch thread messages immediately

**Polling:** `setInterval` every 30 seconds refetches the thread. Cleared on unmount.

**Empty state:** "No messages yet. Send the first message below."

---

### 3. Client: Messages Page (`/client/messages`)

New page `ClientMessages.jsx`. Single thread — clients only ever have one conversation (with their therapist).

**Header:** Therapist avatar initial + name + "Your therapist" subtitle.

**Thread body:** Same layout as therapist thread — therapist messages left, client messages right. Mark therapist messages as read on mount.

**Send input:** Textarea + Send button. On submit:
1. INSERT: `{ therapist_id, client_id, sender_role: 'client', body }`
2. Clear textarea
3. Refetch immediately

**Polling:** Every 30 seconds while page is open.

**Empty state:** "No messages yet. Send your therapist a message below."

**Nav:** Add "Messages" tab to `BottomNav.jsx`. Use `MessageSquare` from lucide-react. Show unread dot badge (blue circle, no count) when `useUnreadCount` > 0.

---

### 4. Unread Badge in Navigation

Both therapist sidebar and client bottom nav use a `useUnreadCount` hook that fires a single `COUNT` query on mount. The badge refreshes each time the user navigates (component re-mounts). No global polling interval — a slightly stale count between navigations is acceptable for async messaging.

```js
// useUnreadCount.js
export function useUnreadCount() {
  const [count, setCount] = useState(0)
  const { profile, clientRecord } = useAuth()

  useEffect(() => {
    async function fetch() {
      if (profile?.role === 'therapist') {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('therapist_id', profile.id)
          .eq('sender_role', 'client')
          .is('read_at', null)
        setCount(count ?? 0)
      } else if (clientRecord) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', clientRecord.id)
          .eq('sender_role', 'therapist')
          .is('read_at', null)
        setCount(count ?? 0)
      }
    }
    fetch()
  }, [profile, clientRecord])

  return count
}
```

---

## Routing

```
/therapist/messages              → TherapistMessages.jsx
/therapist/messages/:clientId    → TherapistThread.jsx
/client/messages                 → ClientMessages.jsx
```

---

## New Files

| File | Purpose |
|------|---------|
| `src/pages/therapist/TherapistMessages.jsx` | Therapist client inbox list |
| `src/pages/therapist/TherapistThread.jsx` | Therapist thread view for one client |
| `src/pages/client/ClientMessages.jsx` | Client single thread |
| `src/hooks/useUnreadCount.js` | Unread message count for current user |

## Modified Files

| File | Change |
|------|--------|
| `src/App.jsx` | Add 3 new routes |
| `src/components/therapist/AppSidebar.jsx` | Add Messages nav item with unread badge |
| `src/components/client/BottomNav.jsx` | Add Messages tab with unread dot badge |

---

## Known v1 Gaps

| Gap | Impact | Future fix |
|-----|--------|-----------|
| No Supabase Realtime | New messages appear after up to 30s | Add Realtime channel subscription as a drop-in enhancement |
| No email notifications | Users must open the app to see messages | Add Edge Function + Resend when notification needs arise |
| No message deletion | Messages are permanent once sent | Add soft-delete (`deleted_at`) column if needed |
| Inbox only shows clients with existing messages | Therapist can't pre-emptively message a new client without navigating to their profile | Add "New message" flow via client list if this becomes a pain point |

---

## Verification

1. **Send from therapist:** Navigate to `/therapist/messages/:clientId`. Send a message. Confirm it appears right-aligned in the thread.
2. **Send from client:** Log in as the client. Navigate to `/client/messages`. Send a reply. Confirm it appears right-aligned.
3. **Unread badge:** Without opening the thread as therapist, confirm the Messages sidebar item shows an unread badge after the client sends.
4. **Mark as read:** Open the thread as the therapist. Confirm the badge clears.
5. **Inbox list:** Confirm the therapist inbox shows the client, last message preview, and correct timestamp.
6. **Polling:** Stay on the thread page as one user; send a message from the other user's session. Confirm it appears within 30 seconds without a page reload.
7. **Empty state:** New client with no messages — confirm inbox and thread both show correct empty state copy.

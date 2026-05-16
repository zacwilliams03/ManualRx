# Password Reset Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pre-login forgot-password flow (email → magic link → new password) and an in-app `/account` page for changing passwords while authenticated.

**Architecture:** Three new page components follow existing patterns (white-card centered layout, Supabase auth calls, `useAuth()` context). All new routes are wired into `App.jsx` alongside existing ones. No new dependencies required.

**Tech Stack:** React 18, React Router v6, Supabase JS v2, Tailwind CSS

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/pages/auth/ForgotPassword.jsx` | Pre-login email entry; triggers Supabase reset email |
| Create | `src/pages/auth/ResetPassword.jsx` | Recovery-link landing page; sets new password |
| Create | `src/pages/Account.jsx` | In-app change-password form for authenticated users |
| Modify | `src/App.jsx` | Add 3 new routes + imports |
| Modify | `src/pages/auth/Login.jsx` | Add "Forgot your password?" link |
| Modify | `src/components/therapist/TherapistNav.jsx` | Add "Account" nav link |
| Modify | `src/pages/client/Dashboard.jsx` | Add "Account" link near logout button |

---

## Task 1: ForgotPassword Page

**Files:**
- Create: `src/pages/auth/ForgotPassword.jsx`

- [ ] **Step 1: Create ForgotPassword.jsx**

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    })

    setLoading(false)

    if (error) {
      setError('Something went wrong. Please try again.')
      return
    }

    setSubmitted(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-semibold text-gray-900">Reset your password</h1>
        <p className="mt-1 text-sm text-gray-500">PrescriptR</p>

        {submitted ? (
          <div className="mt-6">
            <p className="text-sm text-gray-700">
              If this email is registered, you'll receive a reset link shortly. Check your inbox.
            </p>
            <p className="mt-4 text-sm text-center">
              <Link to="/login" className="text-blue-600 hover:underline">Back to log in</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-blue-600 text-white py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>

            <p className="text-sm text-gray-600 text-center">
              <Link to="/login" className="text-blue-600 hover:underline">Back to log in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add route and "Forgot your password?" link to Login**

In `src/App.jsx`:

Add import at the top with the other auth imports:
```jsx
import ForgotPassword from './pages/auth/ForgotPassword'
```

Add route inside `<Routes>`, after the `/signup` route and before the therapist block:
```jsx
<Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
```

In `src/pages/auth/Login.jsx`, add a link below the password `<div>` and above `{error && ...}`:
```jsx
<div className="text-right">
  <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
    Forgot your password?
  </Link>
</div>
```

`Link` is already imported in Login.jsx — no new import needed.

- [ ] **Step 3: Verify in browser**

Start dev server if not running: `npm run dev`

Visit `http://localhost:5173/login` — confirm "Forgot your password?" link appears below the password field.

Click it — confirm navigation to `/forgot-password` and the form renders with an email field and "Send reset link" button.

Log in as any user, then visit `/forgot-password` directly — confirm you are redirected to your role's dashboard (PublicOnlyRoute working).

- [ ] **Step 4: Commit**

```bash
git add src/pages/auth/ForgotPassword.jsx src/App.jsx src/pages/auth/Login.jsx
git commit -m "feat: add forgot-password page and login link"
```

---

## Task 2: ResetPassword Page

**Files:**
- Create: `src/pages/auth/ResetPassword.jsx`

- [ ] **Step 1: Create ResetPassword.jsx**

```jsx
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [pageState, setPageState] = useState('checking') // 'checking' | 'ready' | 'invalid'
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // 3-second fallback — tune after testing on real devices / slow connections.
    // PASSWORD_RECOVERY can fire after this cutoff on slow networks, incorrectly
    // showing the invalid state for a valid link.
    const timeout = setTimeout(() => {
      setPageState(s => s === 'checking' ? 'invalid' : s)
    }, 3000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        clearTimeout(timeout)
        setPageState('ready')
      }
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      console.error('updateUser error:', error)
      setError('Something went wrong. Please try again.')
      return
    }

    setSuccess(true)
    setTimeout(() => navigate('/login'), 1500)
  }

  if (pageState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Verifying link…</p>
      </div>
    )
  }

  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
          <p className="text-sm text-gray-700">This link is invalid or has expired.</p>
          <p className="mt-4 text-sm">
            <Link to="/forgot-password" className="text-blue-600 hover:underline">
              Request a new reset link
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-semibold text-gray-900">Set new password</h1>
        <p className="mt-1 text-sm text-gray-500">PrescriptR</p>

        {success ? (
          <p className="mt-6 text-sm text-gray-700">Password updated. Redirecting to login…</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm new password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-blue-600 text-white py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add route to App.jsx**

Add import at the top with the other auth imports:
```jsx
import ResetPassword from './pages/auth/ResetPassword'
```

Add route after the `/forgot-password` route (no guard — the page manages its own validity state):
```jsx
<Route path="/reset-password" element={<ResetPassword />} />
```

- [ ] **Step 3: Configure Supabase redirect URL allowlist**

In your Supabase project dashboard:
1. Go to **Authentication → URL Configuration → Redirect URLs**
2. Add `http://localhost:5173/reset-password`
3. Add your production URL when deploying (e.g. `https://prescriptr.com/reset-password`)

Without this step, Supabase will reject the reset email link and the flow silently breaks.

- [ ] **Step 4: Verify in browser**

Visit `http://localhost:5173/reset-password` directly (no token) — confirm:
1. "Verifying link…" text appears immediately
2. After ~3 seconds, transitions to "This link is invalid or has expired." with a link to `/forgot-password`

Use the forgot-password flow end-to-end:
1. Visit `/forgot-password`, enter a registered email, submit
2. Open the email, click the reset link
3. Confirm the form renders (not the invalid state)
4. Enter mismatched passwords — confirm "Passwords do not match." error
5. Enter a password shorter than 6 chars — confirm "Password must be at least 6 characters." error
6. Enter a valid matching password — confirm "Password updated. Redirecting to login…" and automatic redirect to `/login`
7. Log in with the new password

- [ ] **Step 5: Commit**

```bash
git add src/pages/auth/ResetPassword.jsx src/App.jsx
git commit -m "feat: add reset-password page and route"
```

---

## Task 3: Account Page (In-App Change Password)

**Files:**
- Create: `src/pages/Account.jsx`

- [ ] **Step 1: Create Account.jsx**

```jsx
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Account() {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }

    setLoading(true)

    // Step 1: verify current password by re-authenticating
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (authError) {
      setLoading(false)
      setError('Incorrect current password.')
      return
    }

    // Step 2: update to new password only after verification succeeds
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    setLoading(false)

    if (updateError) {
      console.error('updateUser error:', updateError)
      setError('Something went wrong. Please try again.')
      return
    }

    setSuccess(true)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-semibold text-gray-900">Change Password</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">Password updated successfully.</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 text-white py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add route to App.jsx**

Add import at the top (with the other page imports):
```jsx
import Account from './pages/Account'
```

Add route after the `/reset-password` route and before the therapist block:
```jsx
<Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
```

No `requiredRole` prop — `ProtectedRoute` skips the role check when it's absent (see App.jsx line 39), so both therapist and client users can access this route.

- [ ] **Step 3: Verify in browser**

While logged out, visit `http://localhost:5173/account` — confirm redirect to `/login`.

Log in as a therapist:
1. Navigate to `/account` manually
2. Submit with wrong current password — confirm "Incorrect current password." error
3. Submit with mismatched new passwords — confirm "New passwords do not match." error
4. Submit with a new password shorter than 6 chars — confirm "New password must be at least 6 characters."
5. Submit valid form — confirm "Password updated successfully." and fields clear
6. Log out, log back in with the new password to confirm it worked

Log in as a client and repeat step 1 to confirm the route is accessible.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Account.jsx src/App.jsx
git commit -m "feat: add account page with in-app change-password"
```

---

## Task 4: Navigation — Account Links

**Files:**
- Modify: `src/components/therapist/TherapistNav.jsx`
- Modify: `src/pages/client/Dashboard.jsx`

- [ ] **Step 1: Add Account link to TherapistNav**

In `src/components/therapist/TherapistNav.jsx`, locate the right-side div (line 35):

```jsx
<div className="flex items-center gap-4">
  <span className="text-sm text-gray-400">{firstName}</span>
  <button
    onClick={signOut}
    className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
  >
    Log out
  </button>
</div>
```

Replace with (adds the Account link between the name span and logout button):

```jsx
<div className="flex items-center gap-4">
  <span className="text-sm text-gray-400">{firstName}</span>
  {navLink('/account', 'Account', ['/account'])}
  <button
    onClick={signOut}
    className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
  >
    Log out
  </button>
</div>
```

- [ ] **Step 2: Add Account link to ClientDashboard**

In `src/pages/client/Dashboard.jsx`, locate the logout button (line 55):

```jsx
<button
  onClick={signOut}
  className="rounded border border-gray-300 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
>
  Log out
</button>
```

Replace with (adds Account link before the button; `Link` is already imported at the top):

```jsx
<Link
  to="/account"
  className="rounded border border-gray-300 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
>
  Account
</Link>
<button
  onClick={signOut}
  className="rounded border border-gray-300 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
>
  Log out
</button>
```

- [ ] **Step 3: Verify in browser**

Log in as a therapist — confirm "Account" appears in the nav bar between your name and "Log out". Click it — confirm navigation to `/account`. Confirm it shows active styling (white underline) when on `/account`.

Log in as a client — confirm "Account" button appears in the header next to "Log out". Click it — confirm navigation to `/account`.

- [ ] **Step 4: Commit**

```bash
git add src/components/therapist/TherapistNav.jsx src/pages/client/Dashboard.jsx
git commit -m "feat: add Account nav links for therapist and client"
```

---

## Verification Checklist

Run through these after all tasks are complete:

- [ ] Forgot password happy path: Login → Forgot link → email → link → set password → redirected to login → login with new password works
- [ ] Forgot password invalid link: `/reset-password` direct visit → spinner shows first → "invalid or expired" after ~3s
- [ ] Forgot password unknown email: generic success message, no indication email doesn't exist
- [ ] In-app change password (therapist): wrong current password → error; mismatched new → error; valid → success; new password works on next login
- [ ] In-app change password (client): Account link visible, page accessible, password change works
- [ ] Route guard — `/forgot-password`: logged-in user redirected to their dashboard
- [ ] Route guard — `/account`: logged-out user redirected to `/login`

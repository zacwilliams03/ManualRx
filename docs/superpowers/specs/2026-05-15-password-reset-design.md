# Password Reset Flow — Design Spec

**Date:** 2026-05-15  
**Status:** Approved

---

## Context

PrescriptR currently has no mechanism for users to recover access when they forget their password. Both therapists (self-signup) and clients (invite-based) can reach a state where they're locked out with no recourse. This spec defines two complementary flows: a pre-login forgot-password flow using Supabase's email-based recovery, and an in-app change-password page for users who are already authenticated.

---

## Scope

Two independent user-facing flows:

1. **Pre-login:** "Forgot password?" → email → reset link → set new password
2. **In-app:** `/account` page → change password with current-password verification

Both flows apply to therapist and client roles equally.

---

## New Files

| File | Purpose |
|---|---|
| `src/pages/auth/ForgotPassword.jsx` | Pre-login email entry page |
| `src/pages/auth/ResetPassword.jsx` | Post-recovery-link password setter |
| `src/pages/Account.jsx` | In-app change-password page (both roles) |

## Modified Files

| File | Change |
|---|---|
| `src/App.jsx` | Add 3 new routes |
| `src/pages/auth/Login.jsx` | Add "Forgot password?" link |
| `src/components/therapist/TherapistNav.jsx` | Add "Account" nav link |
| `src/pages/client/Dashboard.jsx` | Add "Account" link near logout button |

---

## Routes

```
/forgot-password  →  PublicOnlyRoute → ForgotPassword
/reset-password   →  (no guard — see below) → ResetPassword
/account          →  ProtectedRoute (no requiredRole) → Account
```

**Why no route guard on `/reset-password`:** When Supabase redirects here with a recovery token in the URL hash, it automatically exchanges the token and creates a temporary recovery session — so the user is technically "logged in" by the time the page loads. `PublicOnlyRoute` would bounce them away. The page manages its own validity state internally via `onAuthStateChange`.

**Why no `requiredRole` on `/account`:** `ProtectedRoute` already skips the role check when `requiredRole` is undefined (line 39 in App.jsx). Both therapist and client users need access.

---

## Flow 1: Pre-Login Forgot-Password

### Entry point

Add a "Forgot your password?" link to `Login.jsx` below the password field, linking to `/forgot-password`. Same small-text style as the existing "No account? Sign up" link.

### ForgotPassword.jsx

- Same white-card centered layout as Login/Signup
- Single email field (type="email", required)
- On submit: `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`
- Always show the same generic confirmation regardless of whether the email exists: _"If this email is registered, you'll receive a reset link shortly."_ — prevents email enumeration
- A link back to `/login`
- Error state only for unexpected Supabase errors (network failure, etc.)

### ResetPassword.jsx

Three internal states managed with `useState`:

| State | Rendered |
|---|---|
| `checking` (default) | Neutral loading spinner — "Verifying link…" |
| `ready` | New password + confirm form |
| `invalid` | "This link is invalid or has expired." + link to `/forgot-password` |

**State transitions:**

On mount, subscribe to `supabase.auth.onAuthStateChange`:
- If `PASSWORD_RECOVERY` event fires → transition to `ready`
- After 3 seconds with no event → transition to `invalid` _(this timeout is an initial estimate; tune after testing on real devices and slow connections — on a valid link over a slow network, PASSWORD_RECOVERY could fire after the cutoff and incorrectly show the error state)_
- Unsubscribe on unmount

**Form (ready state):**
- New password field (min 6 chars)
- Confirm new password field
- Client-side validation: both fields filled, passwords match, min length
- On submit: `supabase.auth.updateUser({ password: newPassword })`
- On success: show "Password updated. Redirecting to login…" → `navigate('/login')` after 1500ms (do not navigate to the dashboard — the recovery session is consumed after `updateUser` and the auth state is uncertain)
- On error: show "Something went wrong. Please try again." and log raw error to console

---

## Flow 2: In-App Change Password

### Navigation access

**TherapistNav:** Add an "Account" link in the right-side group using the existing `navLink()` helper, active when `pathname === '/account'`. Pattern: `navLink('/account', 'Account', ['/account'])`.

**ClientDashboard:** Add an "Account" `<Link>` next to the existing "Log out" button, styled as a secondary button (matching the logout button's `border border-gray-300` style).

### Account.jsx

- White-card layout, centered, matching auth pages
- Heading: "Change Password"
- Three fields: Current password, New password, Confirm new password (all `type="password"`)
- `user.email` sourced from `useAuth()` — safe to use without a null-guard because `ProtectedRoute` guarantees a resolved, non-null `user` before rendering this page

**Submit flow (two-step, sequential):**

1. Client-side validation: new password === confirm, new.length ≥ 6. Surface validation errors inline; do not proceed.
2. `supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })`
   - On error: show "Incorrect current password." Stop.
3. `supabase.auth.updateUser({ password: newPassword })`
   - On error: show "Something went wrong. Please try again." Log raw error to console. Stop.
4. Only on clean success from step 3: show "Password updated successfully."

Never show raw Supabase error strings to the user. Map all `updateUser` errors to the fixed string above.

---

## Supabase Configuration

**Redirect URL allowlist** — must be configured in the Supabase dashboard:  
Authentication → URL Configuration → Redirect URLs

Add:
- `http://localhost:5173/reset-password` (development)
- `https://<production-domain>/reset-password` (production — add before going live)

If the production URL is not whitelisted before launch, Supabase will reject the reset email redirect and the flow will silently fail.

---

## Verification

End-to-end test plan:

1. **Forgot password (happy path):** Visit `/login` → click "Forgot your password?" → enter a registered email → confirm generic success message shown → check email → click link → confirm form renders (not "invalid" state) → enter matching passwords ≥ 6 chars → submit → confirm "Password updated" message → confirm redirect to `/login` → log in with new password.

2. **Forgot password (invalid link):** Navigate to `/reset-password` directly (no token) → confirm the "checking" state renders first (spinner + "Verifying link…" text) → wait ~3 seconds → confirm it transitions to the "Invalid or expired link" message with a link back to `/forgot-password`. The spinner must be visible before the error state, not skipped.

3. **Forgot password (unknown email):** Enter an unregistered email → confirm same generic success message is shown (no enumeration).

4. **In-app change password (happy path):** Log in as therapist → click "Account" in nav → enter correct current password + matching new passwords → submit → confirm "Password updated successfully" → log out → log in with new password.

5. **In-app change password (wrong current password):** Submit with incorrect current password → confirm "Incorrect current password." error, no password change occurs.

6. **In-app change password (client role):** Log in as client → confirm "Account" link visible near logout → confirm `/account` page renders and change-password works.

7. **Route guards:** Logged-in therapist visits `/forgot-password` → confirm redirect to `/therapist`. Unauthenticated user visits `/account` → confirm redirect to `/login`.

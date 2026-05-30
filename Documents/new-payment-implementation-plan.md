# Payment Gateway — Implementation Plan
**AjitSir Academy** · Stack: Next.js on Vercel · Express on Render · Neon Postgres

---

## Infrastructure assumptions (lock these in before writing any code)

| Fact | Impact on implementation |
|---|---|
| Google OAuth only — no email/password | No `prefill.email` from a form input; must read from the JWT/Zustand store at checkout time |
| Neon DB has cold starts (pauses after inactivity) | `/api/payments/create-order` may take 2–5 s on first hit; the UI must show a loading state immediately and not time out prematurely |
| Render free tier spins down after 15 min inactivity | Same problem as above — first request after idle is slow; handle with a generous timeout and a loading indicator |
| Vercel is serverless (no persistent process) | No in-process Razorpay JS preload; script injection must happen client-side each time |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` is not needed | `/create-order` already returns `keyId`; read it from the response, not from env |
| Webhook must be publicly reachable | Only works in production/staging. Do not test webhook flow on localhost. Use Razorpay test keys + Razorpay dashboard for local webhook testing |

---

## Phase 0 — Contracts & test setup (do this before writing any UI)

**Goal:** Lock in the exact API response shapes and set up Razorpay test mode. The agent must not guess what the API returns.

### 0.1 Verify API response shapes

Run these against your running API and record the exact response:

```bash
# Create order — what does the response look like?
curl -X POST http://localhost:4000/api/payments/create-order \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"planDuration": 30}'

# Expected shape to hard-code in the hook:
# {
#   "orderId": "order_xxx",
#   "amount": 49900,
#   "currency": "INR",
#   "keyId": "rzp_test_xxx"
# }

# Verify endpoint
curl -X POST http://localhost:4000/api/payments/verify \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "razorpayOrderId": "order_xxx",
    "razorpayPaymentId": "pay_xxx",
    "razorpaySignature": "xxx"
  }'

# Expected shape:
# { "planExpiresAt": "2025-08-30T00:00:00.000Z" }

# Auth refresh
curl -X POST http://localhost:4000/api/auth/refresh \
  -b "refreshToken=<cookie>"

# Expected shape:
# { "accessToken": "eyJ..." }

# GET /api/auth/me
# Expected shape — confirm user.plan and user.planExpiresAt are present:
# { "id": "...", "name": "...", "email": "...", "plan": "FREE", "planExpiresAt": null }
```

**Do not proceed to Phase 1 until you have confirmed every field name above.**

### 0.2 Switch to Razorpay test mode

In `.env` (API) and `.env.local` (web), set:

```env
RAZORPAY_KEY_ID=rzp_test_xxxx
RAZORPAY_KEY_SECRET=xxxx
```

Test credentials for the Razorpay modal:
- UPI: `success@razorpay`
- Card: `4111 1111 1111 1111`, any future expiry, any CVV
- Failure simulation: `failure@razorpay`

### 0.3 Confirm `/api/auth/me` is accessible post-payment without page reload

The gating logic relies on `GET /api/auth/me` returning `plan: 'PAID'` after the token refresh. Verify this manually before Phase 2.

---
Phase 0.4 — Idempotency audit (backend)

For each endpoint, answer: "what happens if this is called twice with identical input?"

/create-order   → must return the same orderId for same user+plan+window
/verify         → must return the same planExpiresAt if already SUCCESS
/webhook        → must return 200 and skip processing if already SUCCESS
/auth/refresh   → safe by nature (pure read + sign)

Fix any that don't pass before touching the frontend.

## Phase 1 — `useCheckout` hook (core logic only, no UI)

**Goal:** Write and test the full 4-step checkout sequence in isolation. No pricing page yet.

**File:** `apps/web/hooks/useCheckout.ts`

### What the hook must do

```
Step 1: POST /api/payments/create-order
        Body: { planDuration: 30 | 180 | 365 }
        → { orderId, amount, currency, keyId }

        Failure modes to handle:
        - Neon/Render cold start: use a 15-second timeout (not the browser default)
        - Network error: set error state, do not open Razorpay
        - 401 (session expired): redirect to /login?callbackUrl=/pricing

Step 2: Load Razorpay JS + open modal
        - Load script once, reuse window.Razorpay if already present
        - prefill.name and prefill.email come from useAuthStore().user
          (guaranteed present because user is Google-authenticated)
        - ondismiss: set state to 'cancelled', show toast, re-enable button
        - Script load failure: set error state "Payment service unavailable"

Step 3: POST /api/payments/verify (inside Razorpay handler callback)
        Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature }
        → { planExpiresAt }

        Failure modes:
        - Network timeout during verify: show "Verifying payment..."
          + start polling GET /api/auth/me every 3 s for up to 30 s
          to catch the async webhook update
        - 400 signature mismatch: show "Payment verification failed.
          Contact support with order ID: <orderId>"
        - 401: redirect to login

Step 4: POST /api/auth/refresh → new accessToken
        → call useAuthStore.setState({ user: { ...user, plan: 'PAID' }, accessToken })
        → navigate to /payment/success?plan=<planLabel>&expires=<planExpiresAt>

        Failure modes:
        - Refresh fails: user paid but UI is stale
          → show "Payment confirmed! Please refresh the page to unlock notes."
          → do NOT silently fail
```

### Hook state shape

```typescript
type CheckoutState =
  | { status: 'idle' }
  | { status: 'creating_order' }       // waiting for Neon/Render wakeup
  | { status: 'awaiting_payment' }     // Razorpay modal open
  | { status: 'verifying' }            // POST /verify in flight
  | { status: 'polling' }              // verify timed out, polling /me
  | { status: 'refreshing_token' }     // POST /refresh in flight
  | { status: 'success' }
  | { status: 'cancelled' }            // user dismissed modal
  | { status: 'error'; message: string }
```

### Razorpay script loader

```typescript
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
```

### Polling helper (for verify timeout)

```typescript
async function pollForPlanUpgrade(
  getAccessToken: () => string,
  maxAttempts = 10,
  intervalMs = 3000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${getAccessToken()}` }
    });
    if (!res.ok) continue;
    const user = await res.json();
    if (user.plan === 'PAID') return true;
  }
  return false;
}
```

### Phase 1 test (manual, no UI)

Wire the hook temporarily to a plain `<button>` on any existing page. Verify:
- [ ] Cold start: button shows loading for 2–5 s, then Razorpay opens
- [ ] Success payment: navigates to `/payment/success`
- [ ] Dismiss: toast fires, button re-enables
- [ ] Failure UPI (`failure@razorpay`): error state shown

---

## Phase 2 — Pricing page and plan cards

**Goal:** Build the `/pricing` page and `PlanCard` component. Wire them to `useCheckout`.

**Files:**
- `apps/web/app/pricing/page.tsx`
- `apps/web/components/payment/PlanCard.tsx`

### Pricing page behaviour matrix

| User state | What to show |
|---|---|
| Unauthenticated | All 3 plan cards, "Get started" CTAs → `/login?callbackUrl=/pricing` |
| Google auth in progress | Disable all CTAs, show spinner |
| Authenticated, FREE | All 3 plan cards, "Buy now" CTAs → trigger `useCheckout` |
| Authenticated, PAID (active) | Show "Your plan is active until [date formatted as DD MMM YYYY]" banner + "Renew" option (extends from expiry date, not today — confirm this with backend) |
| Authenticated, PAID (expired) | Show "Your plan expired on [date]" + buy cards as normal |

### Plan labels (map from `planDuration` values)

```typescript
const PLANS = [
  { duration: 30,  label: 'Monthly',  price: '₹499',   period: '30 days'   },
  { duration: 180, label: '6-Month',  price: '₹2,499', period: '180 days', badge: 'Best value' },
  { duration: 365, label: 'Annual',   price: '₹3,999', period: '365 days'  },
] as const;
```

### `PlanCard` props

```typescript
interface PlanCardProps {
  plan: typeof PLANS[number];
  onSelect: (duration: 30 | 180 | 365) => void;
  isLoading: boolean;     // from useCheckout status
  disabled: boolean;      // true if another plan's checkout is in progress
}
```

### Important: disable all cards during checkout

When any plan's checkout is in progress, set `disabled={true}` on all three cards. This prevents the duplicate-order problem from Phase 0's analysis.

### Date formatting

Use `Intl.DateTimeFormat` — do not import a date library for this:

```typescript
const fmt = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric'
});
fmt.format(new Date(planExpiresAt)); // "30 Aug 2025"
```

### Phase 2 test

- [ ] Unauthenticated user visits `/pricing` → no CTAs crash, redirect to login works
- [ ] FREE user: clicking "Buy now" triggers loading state on that card only
- [ ] PAID user: sees expiry banner instead of buy CTAs
- [ ] Cold start scenario: all 3 cards disabled during `creating_order` state

---

## Phase 3 — NoteCard gating and PaywallBanner

**Goal:** Gate paid notes in the existing `NoteCard` component. Do not touch the note viewer.

### Access matrix (source of truth)

```typescript
function canAccessNote(user: User | null, note: Note): boolean {
  if (!note.isPaid) return true;
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;
  if (user.plan === 'PAID') return true;
  return false;
}
```

Note: `user.plan` comes from the Zustand store (sourced from the JWT). After payment + token refresh, this updates automatically — no page reload needed, but you must confirm the store update in Phase 1 actually triggers a re-render here.

### What NoteCard renders per state

```
note.isPaid === false  →  open viewer (always)
note.isPaid === true AND canAccessNote === true  →  open viewer
note.isPaid === true AND user is null  →  lock icon + "Sign in to access" + button → /login
note.isPaid === true AND user.plan === 'FREE'  →  <PaywallBanner />
```

### `PaywallBanner` component

**File:** `apps/web/components/payment/PaywallBanner.tsx`

Props: none (reads from Zustand store internally)

Renders:
- Lock icon
- "This note requires a paid subscription"
- "Upgrade plan" button → `router.push('/pricing')`

Keep it minimal — it sits inside the NoteCard layout. No modals.

### Phase 3 test

- [ ] FREE user: paid note shows PaywallBanner, free note opens normally
- [ ] After completing checkout (from Phase 1 test), return to notes page — paid notes now open without page reload
- [ ] PAID user with expired plan (manually set via `/api/admin/users/:id/plan`): next `requireAuth` call should downgrade — verify NoteCard re-locks on next page load

---

## Phase 4 — Success page and navbar link

**Goal:** Build the post-payment landing page and add "Pricing" to the navbar.

**Files:**
- `apps/web/app/payment/success/page.tsx`
- Modify existing navbar component

### Success page

Reads from URL search params (written by `useCheckout` on navigation):
```
/payment/success?plan=Monthly&expires=2025-08-30T00:00:00.000Z
```

If params are missing (direct navigation), read from `useAuthStore().user.planExpiresAt`.

If both are missing (user navigated here without paying), redirect to `/`.

Displays:
- Checkmark icon
- "Payment successful!"
- "Your [plan label] plan is active until [formatted date]"
- "Explore notes" CTA → `router.push('/')`

Do not auto-redirect. Let the user click.

### Navbar link

Add "Pricing" link pointing to `/pricing`. Visible to all users (including unauthenticated). No special logic needed here.

### Phase 4 test

- [ ] Navigate directly to `/payment/success` without params → redirects to `/`
- [ ] After real checkout, success page shows correct plan name and expiry
- [ ] "Explore notes" CTA navigates correctly

---

## Phase 5 — Edge case hardening

**Goal:** Handle the failure modes identified in the gap analysis. Do each one explicitly.

### 5.1 Verify timeout → webhook polling

Already built into `useCheckout` in Phase 1 (the polling helper). Validate it:
- Use a test where you deliberately slow down `/verify` (or comment it out temporarily)
- Confirm the UI transitions to `'polling'` state and shows "Verifying payment…"
- After webhook fires, polling should detect `plan: 'PAID'` and complete the flow

### 5.2 Token refresh failure recovery

In `useCheckout`, after `/verify` succeeds but `/refresh` fails:

```typescript
// Show a recoverable error — do not navigate to success
setState({
  status: 'error',
  message: 'Payment confirmed! Please refresh the page to unlock your notes.'
});
```

Do NOT silently swallow this. The user paid real money.

### 5.3 Session expired mid-checkout

If any fetch in the checkout flow returns `401`:
1. Store the selected `planDuration` in `sessionStorage`
2. Redirect to `/login?callbackUrl=/pricing`
3. On return to `/pricing`, read from `sessionStorage` and auto-select that plan
4. Clear `sessionStorage` after checkout completes

### 5.4 Pending orders on back-navigation

No frontend cleanup is possible once the modal opens. Instead, handle this server-side: in `create-order`, before creating a new order, check if the user already has a `PENDING` order created in the last 30 minutes. If so, return that existing `orderId` rather than creating a new one. This prevents order accumulation.

**This requires a small backend change — note it as a prerequisite for Phase 5.**

### 5.5 Mobile Razorpay redirect flow

On some Android UPI apps, Razorpay switches to a full-page redirect. The `handler` callback will not fire on return. Mitigation:

In `useCheckout`, after opening the modal, also start a 5-second polling interval on `/api/auth/me`. If the user disappears (navigated away via UPI app) and returns, the poll will catch a completed webhook update.

```typescript
// Start background poll as soon as modal opens
const pollInterval = setInterval(async () => {
  const user = await fetchMe(accessToken);
  if (user?.plan === 'PAID') {
    clearInterval(pollInterval);
    // complete the flow
  }
}, 5000);

// Clear on normal handler completion or dismiss
```

### 5.6 Neon cold start UX

In the `creating_order` state, show an explicit loading message:

```
"Preparing your order…"   (0–3 s)
"Almost there…"           (3 s+)
```

Do not show a generic spinner. Users who see it hang for 3 seconds without feedback will click away.

Implement with a `useEffect` that changes the message after 3000 ms:

```typescript
const [loadingMsg, setLoadingMsg] = useState('Preparing your order…');
useEffect(() => {
  if (status !== 'creating_order') return;
  const t = setTimeout(() => setLoadingMsg('Almost there…'), 3000);
  return () => clearTimeout(t);
}, [status]);
```

---

## Phase X — Admin: per-user plan controls

On the admin users list, each row needs:
- Current plan badge (FREE / PAID)
- Plan expiry date (or "—" if FREE)
- "Manage plan" action → opens a side panel

Side panel shows:
- User's payment history (all Payment rows for this userId)
- Manual override form:
    Plan: [FREE | PAID]
    Expires at: [date picker]
    Reason: [text field — stored in an audit log]
- "Save" → calls PATCH /api/admin/users/:id/plan
## Phase 6 — Production checklist

Complete every item before switching to live Razorpay keys.

### Environment variables

```env
# In Render (API)
RAZORPAY_KEY_ID=rzp_live_xxxx
RAZORPAY_KEY_SECRET=xxxx
RAZORPAY_WEBHOOK_SECRET=xxxx

# In Vercel (web) — only if you decide to add it; not strictly needed
# NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxx
```

### Razorpay dashboard setup

- [ ] Set webhook URL to `https://your-render-api.onrender.com/api/payments/webhook`
- [ ] Subscribe to events: `payment.captured`, `payment.failed`
- [ ] Enable webhook signature verification (already done server-side)
- [ ] Test with Razorpay's "Send test webhook" button

### Final manual test sequence (test keys, staging)

1. Log in via Google
2. Visit `/pricing` as FREE user
3. Select 6-Month plan
4. Complete payment with `success@razorpay`
5. Verify: success page shows correct expiry date
6. Return to notes: paid note opens without reload
7. Log out and back in: JWT still carries `PAID`
8. Repeat steps 3–6 with `failure@razorpay`: error state shows, button re-enables
9. Open modal, press back/close without paying: cancelled state, button re-enables
10. On mobile: complete UPI payment, verify redirect flow catches it

### After production switch

- [ ] Remove all `rzp_test_` references from env
- [ ] Verify Razorpay live webhook URL is set
- [ ] Monitor Render logs for the first 5 real payments
- [ ] Check Neon DB: confirm `Payment` rows show `status: 'SUCCESS'` after capture

---

## Open decisions (needs your answer before implementation)

1. **Renewal behaviour:** When a PAID user clicks "Renew", does the new plan extend from today or from `planExpiresAt`? Confirm with the backend `/verify` logic.
2. **Plan display name stored where?** The DB stores `30/180/365`. Where is the label (Monthly/6-Month/Annual) shown on the admin stats page — does it need to be stored in the `Payment` row too?
3. **Webhook in staging:** Do you have a staging Render URL that Razorpay can reach, or will webhook testing only happen in production?

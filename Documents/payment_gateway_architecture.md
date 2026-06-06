# Payment Gateway Architecture — AjitSir Academy

## 1. Current State (What Already Exists)

The backend infrastructure is **fully built** and production-ready. Nothing on the server needs to be written from scratch:

| Layer | Status | Details |
|---|---|---|
| `POST /api/payments/create-order` | ✅ Done | Creates a Razorpay order, saves `PENDING` Payment row |
| `POST /api/payments/verify` | ✅ Done | HMAC-verifies signature, upgrades user to `PAID` in a DB transaction |
| `POST /api/payments/webhook` | ✅ Done | Handles `payment.captured` / `payment.failed` async Razorpay events |
| `razorpay.ts` service | ✅ Done | Lazy singleton, order creation, signature + webhook verification |
| `Payment` DB model | ✅ Done | Stores orderId, paymentId, amount (paise), status, planDuration |
| `requireAuth` middleware | ✅ Done | Plan-expiry check + automatic FREE downgrade on every paid request |
| `PLAN_PRICING` config | ✅ Done | ₹499/mo · ₹2499/6mo · ₹3999/yr (in paise) |

**The entire frontend payment flow is missing.** There is no pricing page, no Razorpay checkout trigger, no post-payment success screen, and `NoteCard` doesn't yet visually distinguish or gate paid notes.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER (Next.js App)                                          │
│                                                                 │
│  ┌─────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │  NoteCard   │    │  /pricing  page  │    │ /payment/     │  │
│  │  (gated UI) │───▶│  Plan selector   │───▶│  success page │  │
│  └─────────────┘    └────────┬─────────┘    └───────────────┘  │
│                              │                                  │
│                      useCheckout hook                           │
│                       (1) createOrder                           │
│                       (2) open Razorpay JS                      │
│                       (3) verifyPayment                         │
│                       (4) refresh auth token                    │
└──────────────────────────────┼──────────────────────────────────┘
                               │  REST
            ┌──────────────────┼──────────────────────┐
            │   Express API    │                       │
            │                  ▼                       │
            │  POST /api/payments/create-order         │
            │  POST /api/payments/verify               │
            │  POST /api/payments/webhook ◀─────────── │── Razorpay
            └──────────────────────────────────────────┘
                               │
                          Neon Postgres
                     (Payment + User rows)
```

---

## 3. New Files to Create (Frontend Only)

```
apps/web/
├── app/
│   ├── pricing/
│   │   └── page.tsx               ← [NEW] Public pricing & plan page
│   └── payment/
│       └── success/
│           └── page.tsx           ← [NEW] Post-payment success screen
├── hooks/
│   └── useCheckout.ts             ← [NEW] Full checkout flow hook
└── components/
    └── payment/
        ├── PlanCard.tsx           ← [NEW] Individual plan pricing card
        └── PaywallBanner.tsx      ← [NEW] Inline "upgrade" nudge on NoteCard
```

---

## 4. Component & Data Flow Detail

### 4.1 Pricing Page (`/pricing`)

**Purpose:** Show all 3 plans, let user pick one, trigger checkout.

**Behaviour:**
- Visible to all users (including unauthenticated)
- If user is not logged in → clicking a plan redirects to `/login?callbackUrl=/pricing`
- If user already has an active `PAID` plan → show expiry date and a "Renew" option
- Highlights the "best value" plan (6-month)

**Plan cards** (from existing `PLAN_PRICING` in backend):

| Plan | Price | Duration |
|---|---|---|
| Monthly | ₹499 | 30 days |
| 6-Month ⭐ | ₹2,499 | 180 days |
| Annual | ₹3,999 | 365 days |

---

### 4.2 `useCheckout` Hook

This is the core orchestration layer. It encapsulates the 4-step checkout sequence:

```
Step 1: Call POST /api/payments/create-order
        → Receive { orderId, amount, currency, keyId }

Step 2: Load Razorpay JS SDK (lazily via <script> tag injection)
        → Open Razorpay checkout popup

Step 3: On payment success callback from Razorpay:
        → Call POST /api/payments/verify
          { razorpayOrderId, razorpayPaymentId, razorpaySignature }
        → On success: planExpiresAt returned

Step 4: Call POST /api/auth/refresh to get a new JWT
        → Update the Zustand auth store (plan: 'PAID')
        → Navigate to /payment/success
```

**Error states to handle:**
- Razorpay modal dismissed by user (payment cancelled)
- Network error during create-order
- Signature verification failed (tampered response)
- User already has active subscription

---

### 4.3 Razorpay JS Integration

Razorpay uses a client-side JS modal (not a redirect). The script must be dynamically loaded:

```typescript
// Load once, reuse
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
```

**Razorpay options object:**
```typescript
{
  key: keyId,              // from create-order response (public key)
  amount,                  // in paise
  currency: 'INR',
  order_id: orderId,
  name: 'AjitSir Academy',
  description: 'TET Study Notes Subscription',
  prefill: {
    name: user.name,
    email: user.email,
  },
  theme: { color: '#2563eb' },   // match your brand accent
  handler: (response) => { /* Step 3: verify */ }
}
```

---

### 4.4 NoteCard — Gated Access (Modify Existing)

Currently `NoteCard` shows a lock icon only for unauthenticated users. It needs an additional state:

| User State | Note Type | Behaviour |
|---|---|---|
| Unauthenticated | Any | → Login |
| Authenticated, FREE | Free note | → Open viewer ✅ |
| Authenticated, FREE | Paid note | → Show `PaywallBanner` / Pricing page |
| Authenticated, PAID | Any | → Open viewer ✅ |
| Admin | Any | → Open viewer ✅ |

The `user.plan` is already in the JWT payload and the Zustand store — no extra API call needed.

---

### 4.5 PaywallBanner Component

A small inline component rendered when a FREE user clicks a paid note:

- Shows lock icon + "This note requires a paid subscription"
- "Upgrade Plan" button → navigates to `/pricing`
- Can be displayed as a modal overlay or inline card

---

### 4.6 Post-Payment Success Page (`/payment/success`)

**Purpose:** Confirm the purchase and guide the user back to notes.

**Behaviour:**
- Reads `planExpiresAt` from the query string or Zustand store (updated in Step 4)
- Shows a success animation / tick
- Displays the plan name and expiry date
- "Explore Notes" CTA → `/`

---

## 5. Auth Token Refresh After Payment

This is the most important integration detail. The JWT is issued at login and contains `plan: 'FREE'`. After a successful payment, the DB is updated but the old token still says `FREE`. 

**The fix:** After `/verify` succeeds, immediately call `POST /api/auth/refresh`. The refresh endpoint re-reads the user from the DB and issues a new access token with `plan: 'PAID'`. Then call `useAuthStore.setState({ user: { ...user, plan: 'PAID' }, accessToken: newToken })`.

The `requireAuth` middleware in [auth.ts](file:///c:/Documents/All_projects/ajit_sir/apps/api/src/middleware/auth.ts) already handles plan-expiry checks server-side on every request, so the token refresh is mainly for the UI to immediately unlock content without requiring a re-login.

---

## 6. Security Considerations

| Risk | Mitigation |
|---|---|
| Client sends fake payment success | Server-side HMAC signature verification in `/verify` — already implemented ✅ |
| Replay attacks (reuse old paymentId) | `razorpayPaymentId` stored in DB; `findUnique` on `razorpayOrderId` prevents reprocessing |
| Order not belonging to user | `payment.userId !== req.user!.userId` check already in `/verify` ✅ |
| Webhook spoofing | `RAZORPAY_WEBHOOK_SECRET` HMAC check already implemented ✅ |
| Expired plan accessing paid content | `requireAuth` middleware downgrades user silently on every request ✅ |
| Key exposure | `RAZORPAY_KEY_ID` is the public key (safe to send to browser); `KEY_SECRET` stays server-side ✅ |

---

## 7. Environment Variables Required

```env
# Already used by backend
RAZORPAY_KEY_ID=rzp_live_xxxx           # Public — also sent to frontend
RAZORPAY_KEY_SECRET=xxxx               # Private — server only
RAZORPAY_WEBHOOK_SECRET=xxxx           # Private — webhook validation

# Frontend must know the public key
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxx
```

> [!IMPORTANT]
> `NEXT_PUBLIC_RAZORPAY_KEY_ID` must match `RAZORPAY_KEY_ID`. The backend already returns `keyId` in the `/create-order` response, so the frontend doesn't technically need its own env var — it should prefer the value from the API response.

---

## 8. Database — No Changes Needed

The `Payment` model is already complete. No migrations required.

---

## 9. Edge Cases to Handle

| Scenario | Handling |
|---|---|
| User closes Razorpay modal without paying | `modal.ondismiss` callback → show "Payment cancelled" toast, reset loading state |
| Payment captured by Razorpay but `/verify` times out | Webhook (`payment.captured`) will update status asynchronously. User may need to refresh |
| Double-click on "Pay" button | Disable button after first click until flow completes |
| Razorpay JS fails to load | Show fallback error "Payment service unavailable. Please try again." |
| Already subscribed user visits `/pricing` | Show "Your plan is active until [date]" with renewal option |

---

## 10. Implementation Sequence

```
Phase 1 — Core Checkout
  [1] Create useCheckout.ts hook
  [2] Create /pricing page with PlanCard components
  [3] Test full checkout → verify → token refresh flow

Phase 2 — Content Gating
  [4] Modify NoteCard to check user.plan + note.isPaid
  [5] Create PaywallBanner component
  [6] Wire PaywallBanner → /pricing redirect

Phase 3 — Polish
  [7] Create /payment/success page
  [8] Add "Pricing" link to Navbar
  [9] Handle all edge cases (dismiss, timeout, double-submit)
```

---

## 11. Open Questions

> [!NOTE]
> These need your input before implementation:

1. **Pricing page placement:** Should `/pricing` be a standalone page, or a modal/sheet that overlays the homepage?
2. **Webhook endpoint exposure:** Is the API currently deployed with a public URL? Razorpay needs to reach `/api/payments/webhook` — this only works in production/staging, not on localhost.
3. **Test vs Live mode:** Should we build using Razorpay **test keys** first? Test UPI ID: `success@razorpay`, test card: `4111 1111 1111 1111`.
4. **Plan display name:** The DB stores `30/180/365` days. Should we label them "Monthly / 6-Month / Annual" in the UI?
5. **Refund flow:** Is there a need for an admin-triggered refund UI, or is this handled directly on the Razorpay dashboard?

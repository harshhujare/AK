# Payment System

## 1. Razorpay Integration

The platform uses Razorpay for processing payments for premium content.

### Plan Pricing

| Duration | Price |
|---|---|
| 30 days | ₹499 |
| 180 days | ₹2,499 |
| 365 days | ₹3,999 |

## 2. Payment Flow

1. **Order Creation:** `POST /api/payments/create-order` → creates Razorpay order + pending `Payment` DB record.
2. **Checkout:** Frontend opens the Razorpay checkout modal.
3. **User Action:** User completes the payment on Razorpay's interface.
4. **Verification:** Frontend POSTs `POST /api/payments/verify` with `razorpayOrderId`, `razorpayPaymentId`, `razorpaySignature`.
5. **Server Verification:** API verifies HMAC signature server-side.
6. **Activation:** On success: `Payment.status = SUCCESS`, `User.plan = PAID`, `User.planExpiresAt` is set.
7. **Webhook Fallback:** Razorpay also fires webhooks to `POST /api/payments/webhook` as an asynchronous fallback (signature verified).

*Note: `getRazorpayClient()` is a lazy singleton — Razorpay constructor is only called if keys exist, preventing startup crashes in dev environments.*

## 3. Plan Expiry Logic

- Access tokens embed the user's `plan` at the time of signing.
- On each authenticated request that requires a premium plan (e.g., using middleware `requireAuth(['STUDENT'], 'PAID')`), the system checks the `user.planExpiresAt` value from the database.
- If the plan has expired: The system silently downgrades the user (`plan = FREE`) in the database and rejects the request.

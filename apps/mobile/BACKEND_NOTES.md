# AjitSir Academy — Mobile App Backend Notes
# Verified facts about the backend, updated per phase. Never assume from memory — re-verify if in doubt.

---

## Phase 0 — Verified (2026-07-01)

### Source file: `apps/api/src/index.ts`

### API Base URL Prefix
- All API routes are mounted under `/api`
- Examples: `/api/auth`, `/api/notes`, `/api/tests`, `/api/payments`
- The mobile app's `EXPO_PUBLIC_API_URL` must include the `/api` prefix
  e.g. `https://ajitsir-api.onrender.com/api` OR for local dev: `http://10.0.2.2:4000/api`

### Health / Connectivity Endpoints
Two health endpoints exist:
1. `GET /health` — Used by Render health checks and GitHub Actions keep-alive cron
   - Returns: `{ status: 'ok', db: 'ok'|'error', timestamp: ISO-string }`
2. `GET /api/ping` — Used by the **frontend/mobile `useOnlineStatus` probe** ← USE THIS ONE
   - Same response shape as `/health`
   - ⚠️ Phase 2's `useOnlineStatus` hook MUST probe `/api/ping`, not `/health`

### CORS Configuration — Mobile Safe ✅
The CORS handler in `index.ts`:
```ts
origin: (origin, cb) => {
  if (!origin || allowedOrigins.includes(origin)) cb(null, true);
  else cb(new Error(`CORS blocked: ${origin}`));
}
```
The `!origin` check passes through ALL requests that have no `Origin` header.
Native Android HTTP clients (fetch / axios / OkHttp) do NOT send an `Origin` header.
**Conclusion: Mobile requests will NOT be CORS-blocked. No backend change needed.**

### Allowed Origins (web only)
- `process.env.FRONTEND_URL` (defaults to `http://localhost:3000`)
- `http://localhost:3001` (fallback)

### Raw Body / Webhook
- `POST /api/payments/webhook` uses a `captureRawBody` middleware registered BEFORE `express.json()`
- Mobile clients must NOT call the webhook endpoint directly — this is a Razorpay → server path only

### Port
- Default: `4000` (via `process.env.PORT || 4000`)
- For local dev on Android emulator: use `http://10.0.2.2:4000/api`
- For local dev on real device: use your machine's LAN IP e.g. `http://192.168.x.x:4000/api`

---

## Phases 1–5
(To be appended as each phase is verified)

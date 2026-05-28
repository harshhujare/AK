# Authentication & Authorization System

## 1. Role System

| Role | Permissions |
|---|---|
| `STUDENT` | View homepage, browse notes (logged in), stream PDFs, take tests |
| `CONTENT_MANAGER` | + Upload/edit/delete notes, manage subjects and announcements |
| `SUPER_ADMIN` | + Everything: manage users, change roles |

**Important:** Users page (`/admin/users`) is SUPER_ADMIN only in the frontend nav too.

### Current Accounts (as of v1 launch)

| Email | Role |
|---|---|
| `harshhujare5124@gmail.com` | SUPER_ADMIN |
| `subhashhujare5147@gmail.com` | SUPER_ADMIN |
| `prathmeshnk9158@gmail.com` | CONTENT_MANAGER |

---

## 2. Authentication Flow

1. User clicks "Sign in with Google" → GIS returns an ID token
2. Frontend POSTs token to `POST /api/auth/google`
3. API verifies with Google, upserts user, issues:
   - **Access token** (JWT, 15 min) → returned in response body
   - **Refresh token** (JWT, 7 days) → set as httpOnly cookie
4. Access token stored in `sessionStorage` (not localStorage)
5. Axios interceptor injects `Authorization: Bearer <token>` on every request
6. On 401, interceptor calls `POST /api/auth/refresh` (uses cookie) → retries original

---

## 3. JWT Mechanism

### JWT Payload
```typescript
{ userId: string, role: Role, plan: Plan, iat: number, exp: number }
```

### Tokens
- **Access token:** 15-minute TTL (configurable via `JWT_EXPIRES_IN`). Stored in `sessionStorage` (cleared on tab close).
- **Refresh token:** 7-day TTL, stored as `httpOnly` cookie. Prevents JavaScript access (XSS protection).

---

## 4. Backend Middleware (`apps/api/src/middleware/auth.ts`)

```typescript
requireAuth()          // Any authenticated user (JWT required)
requireAdmin()         // SUPER_ADMIN or CONTENT_MANAGER
requireSuperAdmin()    // SUPER_ADMIN only
```

---

## 5. Frontend State Management

The frontend uses Zustand for authentication state (`apps/web/lib/auth-store.ts`).

### State: `useAuthStore`

```typescript
{
  user: User | null,
  accessToken: string | null,
  isLoading: boolean,
  isInitialized: boolean,
  login(accessToken, user): void,
  logout(): Promise<void>,
  initialize(): Promise<void>   // Called on page load, restores from sessionStorage
}
```

# Help Center + Support Manager Role — Implementation Plan
**AjitSir Academy** · Stack: Next.js on Vercel · Express on Render · Neon Postgres

---

## Role matrix (complete picture after this change)

| Permission | SUPER_ADMIN | CONTENT_MANAGER | SUPPORT_MANAGER | STUDENT |
|---|---|---|---|---|
| View support inbox | ✅ | ✅ | ✅ | ❌ |
| Reply to tickets | ✅ | ✅ | ✅ | own only |
| Change ticket status | ✅ | ✅ | ✅ | ❌ |
| Manage FAQs (CRUD) | ✅ | ✅ | ✅ | ❌ |
| Read-only user lookup | ✅ | ✅ | ✅ (limited) | ❌ |
| See payment context on tickets | ✅ | ✅ | ❌ | ❌ |
| Manage user plans | ✅ | ❌ | ❌ | ❌ |
| Upload / edit notes | ✅ | ✅ | ❌ | ❌ |
| View revenue / admin stats | ✅ | ✅ | ❌ | ❌ |
| Change user roles | ✅ only | ❌ | ❌ | ❌ |
| Assign SUPPORT_MANAGER role | ✅ only | ❌ | ❌ | ❌ |
| Delete tickets | ✅ only | ❌ | ❌ | ❌ |

---

## Phase 0 — Role changes (backend, do first)

### 0.1 Update the Role enum in Prisma

```prisma
enum Role {
  STUDENT
  SUPPORT_MANAGER   // ← new
  CONTENT_MANAGER
  ADMIN
  SUPER_ADMIN
}
```

Run `prisma migrate` after this. No existing rows are affected — the new value
is additive.

### 0.2 Update `requireAuth` middleware

The existing middleware likely checks `role === 'ADMIN'` in places. Introduce
a helper that encodes role hierarchy as a numeric level so comparisons are
clean and don't require updating every route individually:

```typescript
// apps/api/src/middleware/auth.ts

export const ROLE_LEVEL: Record<Role, number> = {
  STUDENT:         0,
  SUPPORT_MANAGER: 1,
  CONTENT_MANAGER: 2,
  ADMIN:           3,
  SUPER_ADMIN:     4,
};

// Replace ad-hoc role checks with this
export function requireRole(minimum: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorised' });
    if (ROLE_LEVEL[req.user.role] < ROLE_LEVEL[minimum]) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// Convenience aliases — replace existing requireAdmin / requireSuperAdmin
export const requireSupport        = requireRole('SUPPORT_MANAGER');
export const requireContentManager = requireRole('CONTENT_MANAGER');
export const requireAdmin          = requireRole('ADMIN');
export const requireSuperAdmin     = requireRole('SUPER_ADMIN');
```

This means a `requireAdmin` check automatically blocks SUPPORT_MANAGER without
any per-route changes to existing routes.

### 0.3 Add role assignment endpoint

The existing `PATCH /api/admin/users/:id/role` is already SuperAdmin-only.
Confirm it validates that the caller is SUPER_ADMIN before allowing the role
change. The SUPPORT_MANAGER value just needs to be a valid target value in
that handler's accepted list.

```typescript
// In the role-change handler, accept only these target roles:
const ASSIGNABLE_ROLES = ['STUDENT', 'SUPPORT_MANAGER', 'CONTENT_MANAGER', 'ADMIN'];
// SUPER_ADMIN is never assignable via API — only via direct DB seed
```

### 0.4 Phase 0 tests

```
[ ] Migrate runs cleanly on Neon
[ ] STUDENT calling a requireSupport route → 403
[ ] SUPPORT_MANAGER calling a requireAdmin route → 403
[ ] SUPPORT_MANAGER calling a requireSupport route → 200
[ ] CONTENT_MANAGER calling a requireSupport route → 200 (passes minimum)
[ ] SuperAdmin calling PATCH /api/admin/users/:id/role with SUPPORT_MANAGER → 200
[ ] Admin (not SuperAdmin) calling the same → 403
```

---

## Phase 1 — Database schema

```prisma
model FAQ {
  id        String   @id @default(cuid())
  question  String
  answer    String   // markdown supported
  category  String   // "Payment" | "Notes" | "Account" | "Technical"
  order     Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([category])
  @@index([isActive])
}

enum TicketType {
  BUG_REPORT
  PAYMENT_ISSUE
  CONTENT_QUERY
  GENERAL
}

enum TicketStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
}

model SupportTicket {
  id        String        @id @default(cuid())
  type      TicketType
  status    TicketStatus  @default(OPEN)
  subject   String        // max 100 chars
  message   String        // max 2000 chars

  // payment context — populated server-side, NEVER sent to SUPPORT_MANAGER
  paymentId String?
  orderId   String?

  userId    String
  user      User          @relation(fields: [userId], references: [id])
  replies   TicketReply[]

  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  @@index([userId])
  @@index([status])
  @@index([type])
}

model TicketReply {
  id           String        @id @default(cuid())
  message      String        // max 2000 chars
  isStaffReply Boolean       @default(false)

  ticketId     String
  ticket       SupportTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  authorId     String
  author       User          @relation(fields: [authorId], references: [id])

  createdAt    DateTime      @default(now())
}
```

---

## Phase 2 — API routes

### Mount points

```typescript
// apps/api/src/index.ts
import supportRoutes from './routes/support';
import faqRoutes     from './routes/faqs';

app.use('/api/support',  supportRoutes);
app.use('/api/faqs',     faqRoutes);
```

### Support ticket routes (`apps/api/src/routes/support.ts`)

| Method | Path | Middleware | Description |
|---|---|---|---|
| POST | `/` | `requireAuth` | Student submits ticket |
| GET | `/mine` | `requireAuth` | Student's own tickets (paginated) |
| GET | `/mine/:id` | `requireAuth` | Student's ticket detail + replies |
| POST | `/mine/:id/reply` | `requireAuth` | Student adds follow-up |
| GET | `/` | `requireSupport` | All tickets with filters |
| GET | `/:id` | `requireSupport` | Ticket detail — payment fields stripped for SUPPORT_MANAGER |
| POST | `/:id/reply` | `requireSupport` | Staff posts reply |
| PATCH | `/:id/status` | `requireSupport` | Change ticket status |
| DELETE | `/:id` | `requireSuperAdmin` | Hard delete |

### FAQ routes (`apps/api/src/routes/faqs.ts`)

| Method | Path | Middleware | Description |
|---|---|---|---|
| GET | `/` | Public | List active FAQs grouped by category |
| GET | `/all` | `requireSupport` | All FAQs including inactive (for admin) |
| POST | `/` | `requireSupport` | Create FAQ |
| PATCH | `/:id` | `requireSupport` | Update FAQ (content, order, active toggle) |
| DELETE | `/:id` | `requireSupport` | Delete FAQ |

### User lookup route (read-only, limited fields)

Add to `apps/api/src/routes/admin.ts`:

```typescript
// SUPPORT_MANAGER can call this — returns limited fields only
router.get('/users/:id/lookup', requireSupport, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
      planExpiresAt: true,
      createdAt: true,
      // explicitly excluded: role, payments, sensitive fields
    }
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}));
```

---

## Phase 3 — Payment context stripping (critical security detail)

SUPPORT_MANAGER must never see `paymentId` or `orderId` on tickets. This is
enforced in the `GET /api/support/:id` handler — not at the DB level, not at
the frontend — so it cannot be bypassed:

```typescript
router.get('/:id', requireSupport, asyncHandler(async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
    include: { replies: { include: { author: { select: { name: true, role: true } } } }, user: { select: { name: true, email: true } } }
  });
  if (!ticket) return res.status(404).json({ error: 'Not found' });

  // Strip payment fields for SUPPORT_MANAGER
  const isLimitedRole = req.user!.role === 'SUPPORT_MANAGER';
  const response = {
    ...ticket,
    paymentId: isLimitedRole ? undefined : ticket.paymentId,
    orderId:   isLimitedRole ? undefined : ticket.orderId,
  };

  res.json(response);
}));
```

This same stripping applies to `GET /api/support/` (list view). Never send
`paymentId` / `orderId` in list responses regardless of role — only in the
detail view for ADMIN and above.

---

## Phase 4 — Frontend: Help Center (user-facing)

### File structure

```
apps/web/app/
└── help/
    ├── page.tsx                ← FAQ list + Contact Support CTA
    └── tickets/
        ├── page.tsx            ← User's ticket list
        └── [id]/
            └── page.tsx        ← Ticket detail + reply thread

apps/web/components/
└── help/
    ├── FAQSection.tsx          ← FAQs grouped by category with accordion
    ├── ContactForm.tsx         ← Ticket submission form
    ├── TicketCard.tsx          ← Summary card in ticket list
    ├── ReplyThread.tsx         ← Full conversation (reused on admin side)
    └── StatusBadge.tsx         ← OPEN / IN_PROGRESS / RESOLVED
```

### `/help` page layout

```
┌─────────────────────────────────────────┐
│  Help Center                            │
│  "Find answers or contact our support"  │
├─────────────────────────────────────────┤
│  FAQ section                            │
│  [Payment] [Notes] [Account] [Technical]│  ← category tabs
│                                         │
│  Q: Why isn't my note unlocking?        │
│  ▼ Because plan activation takes...    │
│                                         │
│  Q: How do I cancel my subscription?   │
│  ▼ ...                                 │
├─────────────────────────────────────────┤
│  Still need help?                       │
│  [Contact Support →]                    │  ← scrolls to / opens ContactForm
├─────────────────────────────────────────┤
│  ContactForm                            │
│  Type | Subject | Message | Submit      │
├─────────────────────────────────────────┤
│  Your tickets                           │
│  [TicketCard] [TicketCard] ...          │
└─────────────────────────────────────────┘
```

### ContactForm behaviour

- Type defaults to `GENERAL`
- On submit: POST `/api/support/`
- On 429 (5 open tickets): "You have 5 open tickets. Please wait for a
  resolution before submitting more."
- On success: scroll to ticket list, highlight new ticket
- Disable submit button until response returns (prevents double submit)

---

## Phase 5 — Frontend: Admin support panel

### File structure

```
apps/web/app/admin/
└── support/
    ├── page.tsx              ← Support inbox (all tickets)
    ├── [id]/
    │   └── page.tsx          ← Ticket detail + reply + status control
    └── faqs/
        └── page.tsx          ← FAQ management (CRUD table)
```

### Support inbox (`/admin/support`)

Filter bar:
```
Status: [All] [Open] [In Progress] [Resolved]
Type:   [All] [Bug] [Payment] [Content] [General]
Search: [searches subject + user email]
```

Table columns:
```
User | Type | Subject | Status | Submitted | Replies | Actions
```

Actions: "View" → `/admin/support/:id` · "Resolve" (inline shortcut)

### Ticket detail (`/admin/support/:id`)

Left panel:
```
User:      [name] · [email]
           [View user profile →]   ← calls /api/admin/users/:id/lookup
                                      only shows name, email, plan, expiry
Type:      Payment Issue
Submitted: 30 May 2025
Status:    [OPEN ▼]               ← dropdown, SUPPORT_MANAGER can change

--- Payment context ---
  Only rendered if viewer role >= ADMIN (not SUPPORT_MANAGER)
  Order ID:   order_xxx
  Payment ID: pay_xxx
  [View in payments panel →]
```

Right panel:
```
[ReplyThread — reused component]

[Reply textarea]
[Send Reply]   [Mark Resolved]
```

"Send Reply" posts to `POST /api/support/:id/reply`. Server auto-advances
OPEN → IN_PROGRESS.

"Mark Resolved" calls `PATCH /api/support/:id/status` with `RESOLVED` and
disables the reply box.

### FAQ management (`/admin/support/faqs`)

Simple CRUD table:
```
Question | Category | Active | Order | Actions (Edit / Delete)
[+ Add FAQ button]                  ← opens inline form below table
```

Edit form fields: Question, Answer (markdown textarea), Category (dropdown),
Order (number), Active (toggle).

---

## Phase 6 — Admin sidebar and access guards

### Sidebar visibility

The `/admin/support` link must appear for SUPPORT_MANAGER, CONTENT_MANAGER,
ADMIN, and SUPER_ADMIN. It must NOT appear for STUDENT.

```typescript
// Sidebar nav item guard
const canAccessSupport = ['SUPPORT_MANAGER', 'CONTENT_MANAGER', 'ADMIN', 'SUPER_ADMIN']
  .includes(user.role);
```

### Route-level guards (Next.js middleware or layout)

```typescript
// apps/web/app/admin/support/layout.tsx
// Redirect if role is STUDENT
const SUPPORT_ROLES = ['SUPPORT_MANAGER', 'CONTENT_MANAGER', 'ADMIN', 'SUPER_ADMIN'];
if (!SUPPORT_ROLES.includes(user.role)) redirect('/');
```

```typescript
// apps/web/app/admin/layout.tsx (existing)
// Existing admin layout already guards CONTENT_MANAGER and above
// SUPPORT_MANAGER must NOT pass this guard — they go to /admin/support only
// Add an explicit check: if role === SUPPORT_MANAGER, redirect to /admin/support
```

This means SUPPORT_MANAGER visiting `/admin` gets redirected to
`/admin/support` instead of seeing a forbidden error.

### Navbar

User navbar: add "Help" → `/help`
Admin sidebar: add "Support" → `/admin/support` (visible to all staff roles)

---

## Phase 7 — Role assignment UI (SuperAdmin only)

The existing admin users table at `/admin/users` already has role management
for SuperAdmin. Extend it to include `SUPPORT_MANAGER` as a selectable role
in the role-change dropdown.

```typescript
// Role options shown in the dropdown — SuperAdmin only
const ASSIGNABLE_ROLES = ['STUDENT', 'SUPPORT_MANAGER', 'CONTENT_MANAGER', 'ADMIN'];
// SUPER_ADMIN intentionally excluded from UI
```

No new page needed — this is a one-line addition to the existing dropdown.

---

## Idempotency & abuse prevention (carry over from feedback plan)

| Risk | Mitigation |
|---|---|
| Duplicate ticket on double-click | Disable submit on first click, re-enable on response |
| Ticket spam | Max 5 open tickets per user — 6th returns 429 |
| Reply to resolved ticket | Block in handler — both user and staff |
| SUPPORT_MANAGER accessing payment data | Stripped server-side in handler, not just hidden in UI |
| SUPPORT_MANAGER editing user plans | `requireAdmin` on plan-change routes blocks level 1 |
| Concurrent status changes | Last-write-wins is acceptable for support status |

---

## Resolved decisions

1. **SUPPORT_MANAGER route** — they access `/admin/support` alongside other
   admin roles. Visiting `/admin` redirects them to `/admin/support`.
   No separate `/support` route needed.

2. **User reply on resolved ticket** — auto-reopens to OPEN. Add this to the
   user reply handler:

   ```typescript
   // POST /api/support/mine/:id/reply
   if (ticket.status === 'RESOLVED') {
     await prisma.supportTicket.update({
       where: { id: ticket.id },
       data: { status: 'OPEN' }
     });
     // Staff will see it reappear in Open queue
   }
   ```

   The reply is created normally. The ticket silently moves back to OPEN.
   No confirmation prompt needed — the act of replying is the re-open signal.

3. **Admin reply attribution** — always display "Support Team" to students,
   never the actual staff member's name. The `author` relation is still stored
   in the DB for internal audit purposes — it just never surfaces in the
   student-facing `ReplyThread`. Apply this in the API response for
   `GET /api/support/mine/:id`:

   ```typescript
   replies: ticket.replies.map(r => ({
     ...r,
     author: r.isStaffReply
       ? { name: 'Support Team' }       // anonymised for student view
       : { name: r.author.name },        // student's own name
   }))
   ```

   The admin-facing `GET /api/support/:id` returns the real author name
   so staff can see who replied internally.

4. **FAQ answer format** — plain text only. No markdown parser needed.
   The FAQ answer field in the DB stores plain text. Render with
   `white-space: pre-wrap` in CSS so line breaks are preserved without
   any library dependency.

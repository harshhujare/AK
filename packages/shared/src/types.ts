// ─── Enums ────────────────────────────────────────────────────────────────────
export type Role = 'STUDENT' | 'SUPPORT_MANAGER' | 'CONTENT_MANAGER' | 'SUPER_ADMIN';
export type Plan = 'FREE' | 'PAID';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type AnnouncementType = 'TEXT' | 'VIDEO';
export type TicketType = 'BUG_REPORT' | 'PAYMENT_ISSUE' | 'CONTENT_QUERY' | 'GENERAL';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
export type NoteAccessType = 'TIMED' | 'LIFETIME';
export type TestType = 'DAILY' | 'PREDEFINED' | 'SUBJECT';

// ─── Core Models ─────────────────────────────────────────────────────────────
export interface User {
  id: string;
  userId: string; // same as id, alias used by JWT payload
  name: string;
  email: string;
  role: Role;
  plan: Plan;
  planExpiresAt: string | null;
  paidAt: string | null;        // ISO string — set once on first payment, never cleared
  createdAt: string;
}

export interface Subject {
  id: string;
  name: string;
  nameMarathi?: string;
  order: number;
}

export interface Question {
  id: string;
  testId: string;
  text: string;
  options: QuestionOption[];
  order: number;
  explanation?: string;
  // NOTE: correctOption is NEVER included in list/get responses
}

export interface QuestionOption {
  id: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface Test {
  id: string;
  title: string;
  description?: string;
  subjectId: string;
  subject?: Subject;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { questions: number };
  // ── Test type & scheduling ──
  type: TestType;
  timeLimitSec: number | null;   // null = untimed
  scheduledAt:  string | null;   // ISO string — DAILY: the day; PREDEFINED: window start
  expiresAt:    string | null;   // ISO string — PREDEFINED: window end
  isPublished:  boolean;         // false = draft, invisible to students
}

export interface TestWithQuestions extends Test {
  questions: Question[];
}

export interface TestAttempt {
  id: string;
  userId: string;
  testId: string;
  test?: Pick<Test, 'id' | 'title' | 'subjectId'>;
  answers: Record<string, string>; // { questionId: selectedOption }
  score: number;
  totalMarks: number;
  timeTaken: number | null; // seconds — null for untimed tests
  completedAt: string;
}

export interface AttemptBreakdownItem {
  questionId: string;
  questionText: string;
  selected: string | null;
  correct: string;
  explanation?: string;
  isCorrect: boolean;
}

export interface AttemptResult extends TestAttempt {
  percentage: number;
  breakdown: AttemptBreakdownItem[];
}

export interface PercentileResult {
  percentile: number | null;      // null when < 10 total attempts exist
  total: number;                   // total attempts for this test
  reason?: 'insufficient_data';    // present when percentile is null
}

export interface Note {
  id: string;
  title: string;
  description?: string;
  subjectId: string;
  subject?: Subject;
  isPaid: boolean;
  accessType: NoteAccessType; // TIMED = expires with plan; LIFETIME = permanent once paid
  pageCount?: number;
  thumbnailKey?: string;
  createdAt: string;
  updatedAt: string;
  // NOTE: fileKey is NEVER sent to client
}

export interface Announcement {
  id: string;
  title: string;
  description?: string;
  type: AnnouncementType;
  youtubeUrl?: string;
  imageKey?: string;
  isActive: boolean;
  order: number;
  createdAt: string;
}

export interface NoteView {
  id: string;
  userId: string;
  noteId: string;
  viewedAt: string;
}

export interface Payment {
  id: string;
  userId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  amount: number; // paise
  status: PaymentStatus;
  planDuration: number; // days
  createdAt: string;
}

// ─── JWT Payload ──────────────────────────────────────────────────────────────
export interface JwtPayload {
  userId: string;
  role: Role;
  plan: Plan;
  iat?: number;
  exp?: number;
}

// ─── Role helpers ─────────────────────────────────────────────────────────────
export const ADMIN_ROLES: Role[] = ['SUPER_ADMIN', 'CONTENT_MANAGER', 'SUPPORT_MANAGER'];
export const isAdmin = (role: Role) => ADMIN_ROLES.includes(role);
export const isSuperAdmin = (role: Role) => role === 'SUPER_ADMIN';

// ─── API Response wrappers ────────────────────────────────────────────────────
export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

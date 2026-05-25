// ─── Enums ────────────────────────────────────────────────────────────────────
export type Role = 'STUDENT' | 'CONTENT_MANAGER' | 'SUPER_ADMIN';
export type Plan = 'FREE' | 'PAID';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type AnnouncementType = 'TEXT' | 'VIDEO';

// ─── Core Models ─────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  plan: Plan;
  planExpiresAt: string | null;
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
  _count?: { questions: number };
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
  timeTaken: number; // seconds
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

export interface Note {
  id: string;
  title: string;
  description?: string;
  subjectId: string;
  subject?: Subject;
  isPaid: boolean;
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
export const ADMIN_ROLES: Role[] = ['SUPER_ADMIN', 'CONTENT_MANAGER'];
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

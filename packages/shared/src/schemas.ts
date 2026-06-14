import { z } from 'zod';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const GoogleAuthSchema = z.object({
  idToken: z.string().min(1),
});

// ─── Tests ────────────────────────────────────────────────────────────────────
export const CreateTestSchema = z.object({
  title:        z.string().min(3).max(200),
  description:  z.string().max(1000).optional(),
  subjectId:    z.string().cuid(),
  isPaid:       z.boolean().default(false),
  // ── Scheduling & type (Phase 1 additions) ──
  type:         z.enum(['DAILY', 'PREDEFINED', 'SUBJECT']).default('SUBJECT'),
  timeLimitSec: z.number().int().positive().optional(), // null = untimed
  scheduledAt:  z.string().datetime({ offset: true }).optional(),
  expiresAt:    z.string().datetime({ offset: true }).optional(),
  isPublished:  z.boolean().default(false),
});

export const UpdateTestSchema = CreateTestSchema.partial();

// Option text capped at 500 chars — prevents oversized JSON blobs in Question.options
const QuestionOptionSchema = z.object({
  id:   z.enum(['A', 'B', 'C', 'D']),
  text: z.string().min(1).max(500),
});

export const CreateQuestionSchema = z.object({
  text:          z.string().min(5).max(2000),
  options:       z.array(QuestionOptionSchema).length(4), // exactly 4 options
  correctOption: z.enum(['A', 'B', 'C', 'D']),
  explanation:   z.string().max(2000).optional(),
  order:         z.number().int().min(0),
});

export const SubmitAttemptSchema = z.object({
  answers:   z.record(z.string().cuid(), z.enum(['A', 'B', 'C', 'D'])),
  timeTaken: z.number().int().nonnegative().optional(), // optional for untimed tests
});

// ─── Notes ────────────────────────────────────────────────────────────────────
export const CreateNoteSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  subjectId: z.string().cuid(),
  isPaid: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(false),
});

// ─── Payments ─────────────────────────────────────────────────────────────────
export const CreateOrderSchema = z.object({
  planDuration: z.enum(['30', '180', '365']), // days as string from form
});

export const VerifyPaymentSchema = z.object({
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
});

// ─── Admin ────────────────────────────────────────────────────────────────────
export const UpdateUserPlanSchema = z.object({
  plan: z.enum(['FREE', 'PAID']),
  planDuration: z.number().int().min(1).optional(), // days, required if plan=PAID
});

export const CreateSubjectSchema = z.object({
  name: z.string().min(2).max(100),
  nameMarathi: z.string().max(100).optional(),
  order: z.number().int().min(0).optional().default(0),
});

// ─── Support & Help Center ────────────────────────────────────────────────────
export const CreateTicketSchema = z.object({
  type: z.enum(['BUG_REPORT', 'PAYMENT_ISSUE', 'CONTENT_QUERY', 'GENERAL']).default('GENERAL'),
  subject: z.string().min(5).max(100),
  message: z.string().min(10).max(2000),
});

export const ReplyTicketSchema = z.object({
  message: z.string().min(1).max(2000),
});

export const CreateFAQSchema = z.object({
  question: z.string().min(5),
  answer: z.string().min(5),
  category: z.string().min(2),
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const UpdateFAQSchema = CreateFAQSchema.partial();

// ─── Inferred types ───────────────────────────────────────────────────────────────────
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type GoogleAuthInput = z.infer<typeof GoogleAuthSchema>;
export type CreateTestInput = z.infer<typeof CreateTestSchema>;
export type UpdateTestInput = z.infer<typeof UpdateTestSchema>;
export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;
export type SubmitAttemptInput = z.infer<typeof SubmitAttemptSchema>;
export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof VerifyPaymentSchema>;
export type UpdateUserPlanInput = z.infer<typeof UpdateUserPlanSchema>;
export type CreateSubjectInput = z.infer<typeof CreateSubjectSchema>;
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export type ReplyTicketInput = z.infer<typeof ReplyTicketSchema>;
export type CreateFAQInput = z.infer<typeof CreateFAQSchema>;
export type UpdateFAQInput = z.infer<typeof UpdateFAQSchema>;

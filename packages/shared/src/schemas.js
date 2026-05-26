"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSubjectSchema = exports.UpdateUserPlanSchema = exports.VerifyPaymentSchema = exports.CreateOrderSchema = exports.CreateNoteSchema = exports.SubmitAttemptSchema = exports.CreateQuestionSchema = exports.UpdateTestSchema = exports.CreateTestSchema = exports.GoogleAuthSchema = exports.LoginSchema = exports.RegisterSchema = void 0;
const zod_1 = require("zod");
// ─── Auth ─────────────────────────────────────────────────────────────────────
exports.RegisterSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8).max(128),
});
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
exports.GoogleAuthSchema = zod_1.z.object({
    idToken: zod_1.z.string().min(1),
});
// ─── Tests ────────────────────────────────────────────────────────────────────
exports.CreateTestSchema = zod_1.z.object({
    title: zod_1.z.string().min(3).max(200),
    description: zod_1.z.string().max(500).optional(),
    subjectId: zod_1.z.string().cuid(),
    isPaid: zod_1.z.boolean().default(false),
});
exports.UpdateTestSchema = exports.CreateTestSchema.partial();
exports.CreateQuestionSchema = zod_1.z.object({
    text: zod_1.z.string().min(5),
    options: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.enum(['A', 'B', 'C', 'D']),
        text: zod_1.z.string().min(1),
    })).length(4),
    correctOption: zod_1.z.enum(['A', 'B', 'C', 'D']),
    explanation: zod_1.z.string().max(1000).optional(),
    order: zod_1.z.number().int().min(0),
});
exports.SubmitAttemptSchema = zod_1.z.object({
    answers: zod_1.z.record(zod_1.z.string().cuid(), zod_1.z.enum(['A', 'B', 'C', 'D'])),
    timeTaken: zod_1.z.number().int().min(0),
});
// ─── Notes ────────────────────────────────────────────────────────────────────
exports.CreateNoteSchema = zod_1.z.object({
    title: zod_1.z.string().min(3).max(200),
    description: zod_1.z.string().max(1000).optional(),
    subjectId: zod_1.z.string().cuid(),
    isPaid: zod_1.z
        .union([zod_1.z.boolean(), zod_1.z.string()])
        .transform((v) => v === true || v === 'true')
        .default(false),
});
// ─── Payments ─────────────────────────────────────────────────────────────────
exports.CreateOrderSchema = zod_1.z.object({
    planDuration: zod_1.z.enum(['30', '180', '365']), // days as string from form
});
exports.VerifyPaymentSchema = zod_1.z.object({
    razorpayOrderId: zod_1.z.string(),
    razorpayPaymentId: zod_1.z.string(),
    razorpaySignature: zod_1.z.string(),
});
// ─── Admin ────────────────────────────────────────────────────────────────────
exports.UpdateUserPlanSchema = zod_1.z.object({
    plan: zod_1.z.enum(['FREE', 'PAID']),
    planDuration: zod_1.z.number().int().min(1).optional(), // days, required if plan=PAID
});
exports.CreateSubjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100),
    nameMarathi: zod_1.z.string().max(100).optional(),
    order: zod_1.z.number().int().min(0).optional().default(0),
});
//# sourceMappingURL=schemas.js.map
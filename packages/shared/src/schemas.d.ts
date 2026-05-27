import { z } from 'zod';
export declare const RegisterSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    password: string;
}, {
    name: string;
    email: string;
    password: string;
}>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const GoogleAuthSchema: z.ZodObject<{
    idToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    idToken: string;
}, {
    idToken: string;
}>;
export declare const CreateTestSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    subjectId: z.ZodString;
    isPaid: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    title: string;
    subjectId: string;
    isPaid: boolean;
    description?: string | undefined;
}, {
    title: string;
    subjectId: string;
    description?: string | undefined;
    isPaid?: boolean | undefined;
}>;
export declare const UpdateTestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    subjectId: z.ZodOptional<z.ZodString>;
    isPaid: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    description?: string | undefined;
    subjectId?: string | undefined;
    isPaid?: boolean | undefined;
}, {
    title?: string | undefined;
    description?: string | undefined;
    subjectId?: string | undefined;
    isPaid?: boolean | undefined;
}>;
export declare const CreateQuestionSchema: z.ZodObject<{
    text: z.ZodString;
    options: z.ZodArray<z.ZodObject<{
        id: z.ZodEnum<["A", "B", "C", "D"]>;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: "A" | "B" | "C" | "D";
        text: string;
    }, {
        id: "A" | "B" | "C" | "D";
        text: string;
    }>, "many">;
    correctOption: z.ZodEnum<["A", "B", "C", "D"]>;
    explanation: z.ZodOptional<z.ZodString>;
    order: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    order: number;
    text: string;
    options: {
        id: "A" | "B" | "C" | "D";
        text: string;
    }[];
    correctOption: "A" | "B" | "C" | "D";
    explanation?: string | undefined;
}, {
    order: number;
    text: string;
    options: {
        id: "A" | "B" | "C" | "D";
        text: string;
    }[];
    correctOption: "A" | "B" | "C" | "D";
    explanation?: string | undefined;
}>;
export declare const SubmitAttemptSchema: z.ZodObject<{
    answers: z.ZodRecord<z.ZodString, z.ZodEnum<["A", "B", "C", "D"]>>;
    timeTaken: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    answers: Record<string, "A" | "B" | "C" | "D">;
    timeTaken: number;
}, {
    answers: Record<string, "A" | "B" | "C" | "D">;
    timeTaken: number;
}>;
export declare const CreateNoteSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    subjectId: z.ZodString;
    isPaid: z.ZodDefault<z.ZodEffects<z.ZodUnion<[z.ZodBoolean, z.ZodString]>, boolean, string | boolean>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    subjectId: string;
    isPaid: boolean;
    description?: string | undefined;
}, {
    title: string;
    subjectId: string;
    description?: string | undefined;
    isPaid?: string | boolean | undefined;
}>;
export declare const CreateOrderSchema: z.ZodObject<{
    planDuration: z.ZodEnum<["30", "180", "365"]>;
}, "strip", z.ZodTypeAny, {
    planDuration: "30" | "180" | "365";
}, {
    planDuration: "30" | "180" | "365";
}>;
export declare const VerifyPaymentSchema: z.ZodObject<{
    razorpayOrderId: z.ZodString;
    razorpayPaymentId: z.ZodString;
    razorpaySignature: z.ZodString;
}, "strip", z.ZodTypeAny, {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
}, {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
}>;
export declare const UpdateUserPlanSchema: z.ZodObject<{
    plan: z.ZodEnum<["FREE", "PAID"]>;
    planDuration: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    plan: "FREE" | "PAID";
    planDuration?: number | undefined;
}, {
    plan: "FREE" | "PAID";
    planDuration?: number | undefined;
}>;
export declare const CreateSubjectSchema: z.ZodObject<{
    name: z.ZodString;
    nameMarathi: z.ZodOptional<z.ZodString>;
    order: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    order: number;
    nameMarathi?: string | undefined;
}, {
    name: string;
    nameMarathi?: string | undefined;
    order?: number | undefined;
}>;
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
//# sourceMappingURL=schemas.d.ts.map
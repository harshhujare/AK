export type Role = 'STUDENT' | 'CONTENT_MANAGER' | 'SUPER_ADMIN';
export type Plan = 'FREE' | 'PAID';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type AnnouncementType = 'TEXT' | 'VIDEO';
export interface User {
    id: string;
    userId: string;
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
    _count?: {
        questions: number;
    };
}
export interface TestWithQuestions extends Test {
    questions: Question[];
}
export interface TestAttempt {
    id: string;
    userId: string;
    testId: string;
    test?: Pick<Test, 'id' | 'title' | 'subjectId'>;
    answers: Record<string, string>;
    score: number;
    totalMarks: number;
    timeTaken: number;
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
    amount: number;
    status: PaymentStatus;
    planDuration: number;
    createdAt: string;
}
export interface JwtPayload {
    userId: string;
    role: Role;
    plan: Plan;
    iat?: number;
    exp?: number;
}
export declare const ADMIN_ROLES: Role[];
export declare const isAdmin: (role: Role) => boolean;
export declare const isSuperAdmin: (role: Role) => role is "SUPER_ADMIN";
export interface ApiSuccess<T> {
    data: T;
}
export interface ApiError {
    error: string;
    details?: unknown;
}
//# sourceMappingURL=types.d.ts.map
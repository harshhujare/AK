'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useAuthStore from '@/lib/auth-store';
import {
  parseSuccessParams,
  formatExpiryDate,
  planDurationToLabel,
  type SuccessParams,
} from '@/features/payment/utils/successPageUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState =
  | { status: 'loading' }
  | { status: 'ready'; planLabel: string; expiryFormatted: string }
  | { status: 'redirecting' };

// ─── Page ─────────────────────────────────────────────────────────────────────

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isInitialized } = useAuthStore();

  const [pageState, setPageState] = useState<PageState>({ status: 'loading' });

  useEffect(() => {
    // Wait for auth store to hydrate before deciding
    if (!isInitialized) return;

    // Priority 1: URL params written by useCheckout
    const parsed: SuccessParams | null = parseSuccessParams(searchParams);
    if (parsed) {
      setPageState({
        status: 'ready',
        planLabel: parsed.planLabel,
        expiryFormatted: formatExpiryDate(parsed.expiresAt),
      });
      return;
    }

    // Priority 2: Zustand store — user has a planExpiresAt (e.g. page refresh after payment)
    if (user?.planExpiresAt) {
      const expiresAt = new Date(user.planExpiresAt);
      setPageState({
        status: 'ready',
        // We don't know the duration from the store, so use generic label
        planLabel: planDurationToLabel(null),
        expiryFormatted: formatExpiryDate(expiresAt),
      });
      return;
    }

    // Priority 3: Nothing to show → redirect
    setPageState({ status: 'redirecting' });
    router.replace('/');
  }, [isInitialized, searchParams, user, router]);

  // ── Render states ──────────────────────────────────────────────────────────

  if (pageState.status === 'loading' || pageState.status === 'redirecting') {
    return (
      <div className="success-page">
        <div className="success-loader" aria-label="Loading…" role="status">
          <div className="loader-ring" />
        </div>
        <style>{loaderStyles}</style>
      </div>
    );
  }

  const { planLabel, expiryFormatted } = pageState;

  return (
    <div className="success-page" id="payment-success-page">
      {/* Decorative background */}
      <div className="success-bg" aria-hidden="true">
        <div className="bg-orb bg-orb--1" />
        <div className="bg-orb bg-orb--2" />
      </div>

      {/* Card */}
      <div className="success-card" role="main">
        {/* Animated checkmark */}
        <div className="check-wrap" aria-hidden="true">
          <svg
            className="check-svg"
            viewBox="0 0 52 52"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle className="check-circle" cx="26" cy="26" r="25" />
            <polyline className="check-tick" points="14,27 22,35 38,17" />
          </svg>
        </div>

        {/* Heading */}
        <h1 className="success-title font-serif">Payment successful!</h1>

        {/* Plan details */}
        <p className="success-subtitle">
          Your{' '}
          <strong className="success-plan-name">{planLabel} Plan</strong>{' '}
          is now active
          {expiryFormatted ? (
            <>
              {' '}until{' '}
              <strong className="success-expiry">{expiryFormatted}</strong>
            </>
          ) : null}
          .
        </p>

        {/* What's unlocked */}
        <ul className="success-benefits" aria-label="What you've unlocked">
          {[
            'All premium TET study notes',
            'High-quality PDF downloads',
            'Bilingual notes (Marathi & English)',
          ].map((benefit) => (
            <li key={benefit} className="success-benefit-item">
              <span className="benefit-dot" aria-hidden="true" />
              {benefit}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          id="explore-notes-btn"
          className="success-cta"
          onClick={() => router.push('/#notes')}
          aria-label="Go to study notes"
        >
          Explore notes
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>

        <p className="success-note">
          A confirmation receipt has been sent to your registered email.
        </p>
      </div>

      <style>{pageStyles}</style>
      <style>{loaderStyles}</style>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="success-page">
        <div className="success-loader" aria-label="Loading…" role="status">
          <div className="loader-ring" />
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const pageStyles = `
  .success-page {
    min-height: 100vh;
    background: var(--bg-page);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.5rem;
    position: relative;
    overflow: hidden;
  }

  /* Decorative background orbs */
  .success-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }
  .bg-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.25;
  }
  .bg-orb--1 {
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, #22c55e 0%, transparent 70%);
    top: -150px;
    right: -100px;
    animation: orb-float 8s ease-in-out infinite;
  }
  .bg-orb--2 {
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, #3b82f6 0%, transparent 70%);
    bottom: -100px;
    left: -80px;
    animation: orb-float 10s ease-in-out infinite reverse;
  }
  @keyframes orb-float {
    0%, 100% { transform: translateY(0) scale(1); }
    50%       { transform: translateY(-20px) scale(1.05); }
  }

  /* Card */
  .success-card {
    position: relative;
    z-index: 1;
    background: var(--bg-surface-2);
    border: 1px solid var(--border);
    border-radius: 24px;
    padding: 3rem 2.5rem;
    max-width: 520px;
    width: 100%;
    text-align: center;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.18);
    animation: card-enter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes card-enter {
    from { opacity: 0; transform: translateY(24px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* Checkmark */
  .check-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 2rem;
  }
  .check-svg {
    width: 72px;
    height: 72px;
    overflow: visible;
  }
  .check-circle {
    stroke: #22c55e;
    stroke-width: 2;
    fill: rgba(34, 197, 94, 0.1);
    stroke-dasharray: 166;
    stroke-dashoffset: 166;
    animation: draw-circle 0.6s ease forwards 0.1s;
  }
  .check-tick {
    stroke: #22c55e;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
    stroke-dasharray: 48;
    stroke-dashoffset: 48;
    animation: draw-tick 0.4s ease forwards 0.65s;
  }
  @keyframes draw-circle {
    to { stroke-dashoffset: 0; }
  }
  @keyframes draw-tick {
    to { stroke-dashoffset: 0; }
  }

  /* Typography */
  .success-title {
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.75rem;
    animation: fade-up 0.4s ease forwards 0.8s;
    opacity: 0;
  }
  .success-subtitle {
    font-size: 1.05rem;
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: 2rem;
    animation: fade-up 0.4s ease forwards 0.9s;
    opacity: 0;
  }
  .success-plan-name {
    color: var(--text-primary);
    font-weight: 700;
  }
  .success-expiry {
    color: var(--text-primary);
    font-weight: 600;
  }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Benefits list */
  .success-benefits {
    list-style: none;
    padding: 0;
    margin: 0 0 2rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    text-align: left;
    animation: fade-up 0.4s ease forwards 1s;
    opacity: 0;
  }
  .success-benefit-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.95rem;
    color: var(--text-secondary);
  }
  .benefit-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #22c55e;
    flex-shrink: 0;
  }

  /* CTA */
  .success-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--accent-bg);
    color: var(--accent-text);
    border: none;
    border-radius: 12px;
    padding: 0.9rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.2s;
    width: 100%;
    justify-content: center;
    margin-bottom: 1.25rem;
    animation: fade-up 0.4s ease forwards 1.1s;
    opacity: 0;
  }
  .success-cta:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }
  .success-cta:active {
    transform: translateY(0);
  }

  /* Footer note */
  .success-note {
    font-size: 0.8rem;
    color: var(--text-muted);
    animation: fade-up 0.4s ease forwards 1.2s;
    opacity: 0;
  }

  /* Mobile */
  @media (max-width: 540px) {
    .success-card {
      padding: 2rem 1.5rem;
      border-radius: 20px;
    }
    .check-svg {
      width: 60px;
      height: 60px;
    }
  }
`;

const loaderStyles = `
  .success-loader {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .loader-ring {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border);
    border-top-color: var(--text-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

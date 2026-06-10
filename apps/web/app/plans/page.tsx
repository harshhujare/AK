'use client';

import React, { useEffect, useState } from 'react';
import useAuthStore from '@/lib/auth-store';
import { useCheckout, type PlanDuration } from '@/features/payment/hooks/useCheckout';
import PlanCard, { type PlanData } from '@/features/payment/components/PlanCard';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import Link from 'next/link';

const FALLBACK_PLANS: readonly PlanData[] = [
  {
    duration: 30,
    label: 'Premium Access',
    price: '₹499',
    period: 'All premium notes',
    badge: 'Best Value',
    description: 'Unlock all premium handwritten notes by Ajit Sir. Chapter-wise PDFs, bilingual explanations, and complete TET study material.',
  },
] as const;

function daysRemaining(expiresAt: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

export default function PlansPage() {
  const { user, isInitialized } = useAuthStore();
  const { state: checkoutState, checkout } = useCheckout();

  const { data: serverPlans, isLoading: isPlansLoading } = useQuery({
    queryKey: ['public-plan-config'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { planDuration: number; price: number; label: string; description: string | null }[] }>('/api/payments/plan-config');
      return data.data;
    },
  });

  const displayPlans: readonly PlanData[] = serverPlans && serverPlans.length > 0
    ? serverPlans.map((p) => ({
        duration: p.planDuration as 30 | 180 | 365,
        label: p.label,
        price: `₹${p.price / 100}`,
        period: 'All premium notes',
        badge: 'Best Value',
        description: p.description || undefined,
      }))
    : FALLBACK_PLANS;

  // Cold-start UX
  const [coldStartMsg, setColdStartMsg] = useState('Preparing your order…');
  useEffect(() => {
    if (checkoutState.status !== 'creating_order') {
      setColdStartMsg('Preparing your order…');
      return;
    }
    const t = setTimeout(() => setColdStartMsg('Almost there… waking up the server'), 3000);
    return () => clearTimeout(t);
  }, [checkoutState.status]);

  // Auto-resume pending checkout after login redirect
  useEffect(() => {
    if (!isInitialized || !user) return;
    const isPaid = user.plan === 'PAID';
    const expiresAt = user.planExpiresAt ? new Date(user.planExpiresAt) : null;
    const isActivePaid = isPaid && expiresAt ? expiresAt > new Date() : false;
    if (isActivePaid) return;
    const pending = sessionStorage.getItem('pendingPlanCheckout') as PlanDuration | null;
    if (pending && (['30', '180', '365'] as string[]).includes(pending)) {
      sessionStorage.removeItem('pendingPlanCheckout');
      checkout(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, user]);

  // ── Compute plan state ────────────────────────────────────────────────────
  const planExpiresAt = user?.planExpiresAt ? new Date(user.planExpiresAt) : null;
  const isPaid = user?.plan === 'PAID';
  const isExpired = planExpiresAt ? planExpiresAt < new Date() : false;
  const isActivePaid = isPaid && !isExpired;
  const days = planExpiresAt ? daysRemaining(planExpiresAt) : 0;
  const isExpiringSoon = isActivePaid && days <= 30;

  const isCheckoutActive =
    checkoutState.status !== 'idle' &&
    checkoutState.status !== 'error' &&
    checkoutState.status !== 'cancelled';

  let statusText: string | undefined;
  if (checkoutState.status === 'creating_order') statusText = coldStartMsg;
  if (checkoutState.status === 'awaiting_payment') statusText = 'Complete payment…';
  if (checkoutState.status === 'verifying') statusText = 'Verifying…';
  if (checkoutState.status === 'polling') statusText = 'Confirming…';
  if (checkoutState.status === 'refreshing_token') statusText = 'Unlocking notes…';
  if (!user) statusText = 'Login to Subscribe';
  if (isActivePaid) statusText = 'Plan Active';

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (!isInitialized || isPlansLoading) {
    return (
      <div className="plans-page">
        <div className="plans-header">
          <h1 className="plans-title font-serif">My Plan</h1>
        </div>
        <div className="plans-body">
          <div className="plan-skeleton" />
        </div>
      </div>
    );
  }

  // ── PAID user — show My Plan card ─────────────────────────────────────────
  if (isActivePaid && planExpiresAt) {
    return (
      <div className="plans-page">
        <div className="plans-header">
          <h1 className="plans-title font-serif">My Plan</h1>
          <p className="plans-subtitle">Your current subscription details</p>
        </div>

        <div className="plans-body">
          {/* My Plan card */}
          <div className={`my-plan-card ${isExpiringSoon ? 'my-plan-card--expiring' : ''}`}>
            <div className="my-plan-top">
              <div className="my-plan-badge">
                <span className="my-plan-badge-dot" />
                Active
              </div>
              <span className="my-plan-name">⭐ Premium Plan</span>
            </div>

            <div className="my-plan-expiry">
              <p className="my-plan-expiry-label">Valid until</p>
              <p className="my-plan-expiry-date">
                {planExpiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className={`my-plan-days ${isExpiringSoon ? 'my-plan-days--soon' : ''}`}>
                {isExpiringSoon ? '⚠️' : '✓'} {days} days remaining
              </p>
            </div>

            <div className="my-plan-perks">
              {['All notes unlocked', 'PDF downloads', 'Bilingual notes (Marathi & English)'].map((perk) => (
                <div key={perk} className="my-plan-perk">
                  <span className="perk-dot" />
                  {perk}
                </div>
              ))}
            </div>

            {isExpiringSoon && (
              <div className="expiring-alert">
                Your plan expires soon. You can renew after it expires to regain access.
              </div>
            )}

            <div className="my-plan-actions">
              <Link href="/notes" className="my-plan-notes-btn">
                Browse Notes →
              </Link>
            </div>
          </div>

          {checkoutState.status === 'error' && (
            <div className="plans-error">{checkoutState.message}</div>
          )}
        </div>
      </div>
    );
  }

  // ── Expired user ──────────────────────────────────────────────────────────
  if (isPaid && isExpired) {
    return (
      <div className="plans-page">
        <div className="plans-header">
          <h1 className="plans-title font-serif">My Plan</h1>
        </div>
        <div className="plans-body">
          <div className="expired-banner">
            <span className="expired-banner-icon">⚠️</span>
            <div>
              <strong>Your Premium Plan has expired.</strong>
              <p>It expired on {planExpiresAt?.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
              <p>Renew now to regain access to all premium notes.</p>
            </div>
          </div>
          <div className="plans-grid">
            {displayPlans.map((plan) => (
              <PlanCard
                key={plan.duration}
                plan={plan}
                isLoading={checkoutState.status === 'creating_order'}
                disabled={isCheckoutActive}
                statusText={statusText}
                onSelect={(duration) => checkout(duration.toString() as PlanDuration)}
              />
            ))}
          </div>
          {checkoutState.status === 'error' && (
            <div className="plans-error">{checkoutState.message}</div>
          )}
        </div>
      </div>
    );
  }

  // ── FREE / logged out user — show pricing ─────────────────────────────────
  return (
    <div className="plans-page">
      <div className="plans-header">
        <h1 className="plans-title font-serif">Upgrade to Premium</h1>
        <p className="plans-subtitle">One simple plan. Unlock all of Ajit Sir's handwritten notes.</p>
      </div>

      <div className="plans-body">
        <div className="plans-grid">
          {displayPlans.map((plan) => (
            <PlanCard
              key={plan.duration}
              plan={plan}
              isLoading={checkoutState.status === 'creating_order'}
              disabled={isCheckoutActive}
              statusText={statusText}
              onSelect={(duration) => checkout(duration.toString() as PlanDuration)}
            />
          ))}
        </div>
        {checkoutState.status === 'error' && (
          <div className="plans-error">{checkoutState.message}</div>
        )}
      </div>
    </div>
  );
}

const styles = `
  .plans-page {
    min-height: 100vh;
    background: var(--bg-page);
    color: var(--text-primary);
    padding-bottom: 2rem;
  }
  .plans-header {
    padding: 2.5rem 1.5rem 2rem;
    border-bottom: 1px solid var(--border);
    background: var(--bg-page);
    max-width: 700px;
    margin: 0 auto;
    text-align: center;
  }
  .plans-title {
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 700;
    margin-bottom: 0.5rem;
  }
  .plans-subtitle {
    font-size: 1rem;
    color: var(--text-secondary);
  }
  .plans-body {
    max-width: 700px;
    margin: 2.5rem auto;
    padding: 0 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* My Plan card */
  .my-plan-card {
    background: var(--bg-surface-2);
    border: 1px solid var(--border);
    border-radius: 24px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-shadow: 0 4px 24px rgba(0,0,0,0.06);
  }
  .my-plan-card--expiring {
    border-color: #f59e0b;
    box-shadow: 0 4px 24px rgba(245,158,11,0.12);
  }
  .my-plan-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .my-plan-badge {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: #16a34a;
    background: #dcfce7;
    padding: 0.3rem 0.75rem;
    border-radius: 999px;
  }
  .my-plan-badge-dot {
    width: 6px;
    height: 6px;
    background: #16a34a;
    border-radius: 50%;
    display: inline-block;
  }
  .my-plan-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  .my-plan-expiry {
    padding: 1.25rem;
    background: var(--bg-surface);
    border-radius: 14px;
    border: 1px solid var(--border);
  }
  .my-plan-expiry-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 0.25rem;
  }
  .my-plan-expiry-date {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.35rem;
  }
  .my-plan-days {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  .my-plan-days--soon {
    color: #d97706;
    font-weight: 600;
  }
  .my-plan-perks {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .my-plan-perk {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  .perk-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #16a34a;
    flex-shrink: 0;
  }
  .expiring-alert {
    padding: 0.875rem 1rem;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 10px;
    font-size: 0.875rem;
    color: #92400e;
    font-weight: 500;
  }
  .my-plan-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .my-plan-notes-btn {
    flex: 1;
    padding: 0.75rem 1.25rem;
    background: var(--accent-bg);
    color: var(--accent-text);
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 600;
    text-decoration: none;
    text-align: center;
    transition: opacity 0.15s;
  }
  .my-plan-notes-btn:hover { opacity: 0.88; }
  .my-plan-notes-btn:hover { opacity: 0.88; }

  /* Expired banner */
  .expired-banner {
    display: flex;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 14px;
    color: #92400e;
    font-size: 0.9rem;
    align-items: flex-start;
  }
  .expired-banner-icon { font-size: 1.5rem; flex-shrink: 0; }
  .expired-banner strong { display: block; margin-bottom: 0.25rem; font-size: 1rem; }
  .expired-banner p { margin: 0.25rem 0 0; }

  /* Skeleton */
  .plan-skeleton {
    height: 320px;
    background: var(--skeleton-bg);
    border-radius: 24px;
    animation: pulse 1.5s infinite ease-in-out;
  }

  /* Plans grid (for free/expired) */
  .plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  /* Error */
  .plans-error {
    padding: 1rem 1.5rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 10px;
    color: #ef4444;
    font-size: 0.875rem;
    text-align: center;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const id = 'plans-page-styles';
  if (!document.getElementById(id)) {
    const el = document.createElement('style');
    el.id = id;
    el.textContent = styles;
    document.head.appendChild(el);
  }
}

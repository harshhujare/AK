'use client';

import React, { useEffect, useState } from 'react';
import useAuthStore from '@/lib/auth-store';
import { useCheckout, type PlanDuration } from '@/features/payment/hooks/useCheckout';
import PlanCard, { type PlanData } from '@/features/payment/components/PlanCard';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// Single plan — ₹499 gives access to ALL premium handwritten notes by Ajit Sir.
// Backend supports multiple durations; additional plans can be added here in future.
const PLANS: readonly PlanData[] = [
  {
    duration: 30,
    label: 'Premium Access',
    price: '₹499',
    period: 'All premium notes',
    badge: 'Best Value',
    description: 'Unlock all premium handwritten notes by Ajit Sir. Chapter-wise PDFs, bilingual explanations, and complete TET study material — all in one plan.',
  },
] as const;

export default function PricingPage() {
  const { user, isInitialized } = useAuthStore();
  const { state: checkoutState, checkout } = useCheckout();

  // Fetch live pricing from backend
  const { data: serverPlans, isLoading: isPlansLoading } = useQuery({
    queryKey: ['public-plan-config'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { planDuration: number, price: number, label: string, description: string | null }[] }>('/api/payments/plan-config');
      return data.data;
    },
  });

  const displayPlans: readonly PlanData[] = serverPlans && serverPlans.length > 0
    ? serverPlans.map(p => ({
        duration: p.planDuration as 30 | 180 | 365,
        label: p.label,
        price: `₹${p.price / 100}`,
        period: 'All premium notes',
        badge: 'Best Value',
        description: p.description || undefined,
      }))
    : PLANS;

  // ── Neon cold-start UX — escalate message after 3s so users know it hasn't frozen
  const [coldStartMsg, setColdStartMsg] = useState('Preparing your order…');
  useEffect(() => {
    if (checkoutState.status !== 'creating_order') {
      setColdStartMsg('Preparing your order…'); // reset for next time
      return;
    }
    const t = setTimeout(() => setColdStartMsg('Almost there… waking up the server'), 3000);
    return () => clearTimeout(t);
  }, [checkoutState.status]);

  // ── Session restore — auto-resume checkout if user was redirected to login ──
  useEffect(() => {
    if (!isInitialized || !user) return;
    
    // We must check if user is paid inside the effect to avoid hook dependency issues
    const isPaid = user.plan === 'PAID';
    const planExpiresAt = user.planExpiresAt ? new Date(user.planExpiresAt) : null;
    const isExpired = planExpiresAt ? planExpiresAt < new Date() : false;
    const isActivePaid = isPaid && !isExpired;
    
    if (isActivePaid) return;
    
    const pending = sessionStorage.getItem('pendingPlanCheckout') as PlanDuration | null;
    if (pending && (['30', '180', '365'] as string[]).includes(pending)) {
      sessionStorage.removeItem('pendingPlanCheckout'); // clear BEFORE calling checkout to avoid loops
      checkout(pending);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, user]);

  // Show a loading skeleton while checking auth state on first load
  if (!isInitialized || isPlansLoading) {
    return (
      <div className="pricing-page">
        <div className="pricing-header">
          <h1 className="pricing-title font-serif">Upgrade to Premium</h1>
          <p className="pricing-subtitle">One plan. All of Ajit Sir's handwritten notes.</p>
        </div>
        <div className="pricing-container" style={{ opacity: 0.5 }}>
          <div className="plans-grid">
            <PlanCard 
              key={30} 
              plan={{
                duration: 30,
                label: 'Premium Access',
                price: '...',
                period: 'Loading...',
              }} 
              isLoading={true} 
              disabled={true} 
              onSelect={() => {}} 
            />
          </div>
        </div>
      </div>
    );
  }

  const isPaid = user?.plan === 'PAID';
  const planExpiresAt = user?.planExpiresAt ? new Date(user.planExpiresAt) : null;
  const isExpired = planExpiresAt ? planExpiresAt < new Date() : false;
  const isActivePaid = isPaid && !isExpired;

  // Derive display status
  let statusText: string | undefined;
  if (checkoutState.status === 'creating_order') statusText = coldStartMsg;
  if (checkoutState.status === 'awaiting_payment') statusText = 'Complete payment…';
  if (checkoutState.status === 'verifying') statusText = 'Verifying…';
  if (checkoutState.status === 'polling') statusText = 'Confirming…';
  if (checkoutState.status === 'refreshing_token') statusText = 'Unlocking notes…';
  if (!user) statusText = 'Login to Subscribe';
  if (isActivePaid) statusText = 'Plan Active';

  const isCheckoutActive =
    checkoutState.status !== 'idle' &&
    checkoutState.status !== 'error' &&
    checkoutState.status !== 'cancelled';

  return (
    <div className="pricing-page">
      <div className="pricing-header">
        <h1 className="pricing-title font-serif">Upgrade to Premium</h1>
        <p className="pricing-subtitle">One simple plan. Unlock unlimited access to all study materials.</p>
      </div>

      <div className="pricing-container">
        {isActivePaid && (
          <div className="active-plan-banner">
            <span className="banner-icon">🎉</span>
            <div className="banner-content">
              <strong>You have an active Premium Plan!</strong>
              <p>Your subscription is valid until {planExpiresAt?.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
            </div>
          </div>
        )}

        {isPaid && isExpired && (
          <div className="expired-plan-banner">
            <span className="banner-icon">⚠️</span>
            <div className="banner-content">
              <strong>Your Premium Plan has expired.</strong>
              <p>It expired on {planExpiresAt?.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
              <p className="banner-subtext">Renew now to regain access to all premium notes.</p>
            </div>
          </div>
        )}

        <div className="plans-grid">
          {displayPlans.map((plan) => (
            <PlanCard
              key={plan.duration}
              plan={plan}
              isLoading={checkoutState.status === 'creating_order'}
              disabled={isCheckoutActive || isActivePaid}
              statusText={statusText}
              onSelect={(duration) => checkout(duration.toString() as PlanDuration)}
            />
          ))}
        </div>
        
        {checkoutState.status === 'error' && (
          <div className="error-message">
            {checkoutState.message}
          </div>
        )}
      </div>

      <style>{`
        .pricing-page {
          background: var(--bg-page, #f9fafb);
          min-height: 100vh;
          padding: 4rem 1.5rem;
          color: var(--text-primary, #111827);
        }

        .pricing-header {
          text-align: center;
          margin-bottom: 4rem;
        }

        .pricing-title {
          font-size: clamp(2.5rem, 5vw, 4rem);
          font-weight: 700;
          margin-bottom: 1rem;
          letter-spacing: -0.02em;
        }

        .pricing-subtitle {
          font-size: 1.25rem;
          color: var(--text-secondary, #4b5563);
          max-width: 600px;
          margin: 0 auto;
        }

        .pricing-container {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
        }

        .plans-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 2rem;
          width: 100%;
          align-items: stretch;
          margin-top: 1rem;
        }

        .active-plan-banner, .expired-plan-banner {
          display: flex;
          gap: 1.5rem;
          padding: 1.5rem 2rem;
          border-radius: 16px;
          max-width: 600px;
          width: 100%;
        }

        .active-plan-banner {
          background: var(--success-bg);
          border: 1px solid var(--success-border);
          color: var(--success-text);
        }

        .expired-plan-banner {
          background: var(--warn-bg);
          border: 1px solid var(--warn-border);
          color: var(--warn-text);
        }

        .banner-icon {
          font-size: 2rem;
        }

        .banner-content strong {
          display: block;
          font-size: 1.1rem;
          margin-bottom: 0.25rem;
        }

        .banner-content p {
          margin: 0;
          font-size: 1rem;
        }

        .banner-subtext {
          margin-top: 0.5rem !important;
          font-size: 0.9rem !important;
          opacity: 0.8;
        }

        .error-message {
          color: var(--danger-text);
          background: var(--danger-bg);
          padding: 1rem 1.5rem;
          border-radius: 8px;
          border: 1px solid var(--danger-border);
          max-width: 420px;
          text-align: center;
          margin-top: 1rem;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

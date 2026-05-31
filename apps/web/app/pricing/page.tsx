'use client';

import React from 'react';
import useAuthStore from '@/lib/auth-store';
import { useCheckout } from '@/features/payment/hooks/useCheckout';
import PlanCard from '@/features/payment/components/PlanCard';

export default function PricingPage() {
  const { user, isInitialized } = useAuthStore();
  const { state: checkoutState, checkout } = useCheckout();

  // Show a loading skeleton or nothing while checking auth state on first load
  if (!isInitialized) {
    return (
      <div className="pricing-page">
        <div className="pricing-header">
          <h1 className="pricing-title font-serif">Upgrade to Premium</h1>
          <p className="pricing-subtitle">Unlock unlimited access to all study materials.</p>
        </div>
        <div className="pricing-container" style={{ opacity: 0.5 }}>
          <PlanCard isLoading={true} disabled={true} onSelect={() => {}} />
        </div>
      </div>
    );
  }

  // Derive display status
  let statusText: string | undefined;
  if (checkoutState.status === 'creating_order') statusText = 'Initializing...';
  if (checkoutState.status === 'awaiting_payment') statusText = 'Complete payment...';
  if (checkoutState.status === 'verifying') statusText = 'Verifying...';
  if (checkoutState.status === 'polling') statusText = 'Confirming...';
  if (checkoutState.status === 'refreshing_token') statusText = 'Unlocking notes...';
  
  if (!user) {
    statusText = 'Login to Subscribe';
  }

  const isCheckoutActive = 
    checkoutState.status !== 'idle' && 
    checkoutState.status !== 'error' && 
    checkoutState.status !== 'cancelled';

  const isPaid = user?.plan === 'PAID';
  const planExpiresAt = user?.planExpiresAt ? new Date(user.planExpiresAt) : null;
  const isExpired = planExpiresAt ? planExpiresAt < new Date() : false;
  const isActivePaid = isPaid && !isExpired;

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
              <p className="banner-subtext">You can renew early to add another 365 days to your existing expiry date.</p>
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

        <PlanCard 
          isLoading={isCheckoutActive}
          disabled={isCheckoutActive}
          statusText={statusText || (isActivePaid ? 'Renew Subscription' : undefined)}
          onSelect={() => checkout('365')}
        />
        
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
          font-weight: 800;
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

        .active-plan-banner, .expired-plan-banner {
          display: flex;
          gap: 1.5rem;
          padding: 1.5rem 2rem;
          border-radius: 16px;
          max-width: 600px;
          width: 100%;
        }

        .active-plan-banner {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
        }

        .expired-plan-banner {
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #92400e;
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
          color: #ef4444;
          background: #fef2f2;
          padding: 1rem 1.5rem;
          border-radius: 8px;
          border: 1px solid #fecaca;
          max-width: 420px;
          text-align: center;
          margin-top: 1rem;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

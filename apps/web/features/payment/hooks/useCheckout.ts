import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/lib/auth-store';
import { createOrderAPI, verifyPaymentAPI } from '../services/api';
import { loadRazorpayScript, RazorpayOptions, RazorpayResponse } from '../utils/razorpay';
import { pollForPlanUpgrade } from '../utils/polling';
import { planDurationToLabel } from '../utils/successPageUtils';

/** Valid plan durations accepted by the API (days). */
export type PlanDuration = '30' | '180' | '365';

export type CheckoutState =
  | { status: 'idle' }
  | { status: 'creating_order' }       // waiting for Neon/Render wakeup
  | { status: 'awaiting_payment' }     // Razorpay modal open
  | { status: 'verifying' }            // POST /verify in flight
  | { status: 'polling' }              // verify timed out, polling /me
  | { status: 'refreshing_token' }     // POST /refresh in flight
  | { status: 'success' }
  | { status: 'cancelled' }            // user dismissed modal
  | { status: 'error'; message: string };

export function useCheckout() {
  const [state, setState] = useState<CheckoutState>({ status: 'idle' });
  const { user, accessToken, refresh } = useAuthStore();
  const router = useRouter();
  // Ref to the background UPI poll — keeps the interval ID across renders
  const upiPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearUpiPoll = () => {
    if (upiPollRef.current) {
      clearInterval(upiPollRef.current);
      upiPollRef.current = null;
    }
  };

  const checkout = useCallback(async (planDuration: PlanDuration = '365') => {
    if (!user || !accessToken) {
      // Save intent and redirect to login
      sessionStorage.setItem('pendingPlanCheckout', planDuration);
      router.push('/login?callbackUrl=/pricing');
      return;
    }

    setState({ status: 'creating_order' });

    try {
      // Step 1: Create Order
      const { data: orderData } = await createOrderAPI(planDuration, accessToken);

      // Step 2: Load Razorpay JS + open modal
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        setState({ status: 'error', message: 'Payment service unavailable. Please try again later.' });
        return;
      }

      const options: RazorpayOptions = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'AjitSir Academy',
        description: 'TET Study Notes Subscription',
        order_id: orderData.orderId,
        prefill: {
          name: user.name,
          email: user.email,
        },
        theme: { color: '#2563eb' },
        handler: async (response: RazorpayResponse) => {
          // Step 3: Verify Payment
          setState({ status: 'verifying' });
          
          try {
            await verifyPaymentAPI({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }, accessToken);

            clearUpiPoll(); // cancel background UPI poll — normal flow succeeded
            await proceedToSuccess(planDuration);
          } catch (verifyError: any) {
            if (verifyError.message === 'Unauthorized') {
              router.push('/login?callbackUrl=/pricing');
              return;
            }
            
            // Timeout or network error during verify -> start polling
            if (verifyError.name === 'AbortError' || verifyError.message.includes('fetch')) {
              setState({ status: 'polling' });
              
              // We pass a getter function to pollForPlanUpgrade so it uses the freshest token if any
              const upgraded = await pollForPlanUpgrade(() => useAuthStore.getState().accessToken || '');
              
              if (upgraded) {
                await proceedToSuccess(planDuration);
              } else {
                setState({ status: 'error', message: 'Payment verification timed out. If money was deducted, it will be automatically refunded or credited. Contact support with order ID: ' + orderData.orderId });
              }
            } else {
              // 400 signature mismatch etc
              setState({ status: 'error', message: 'Payment verification failed. Contact support with order ID: ' + orderData.orderId });
            }
          }
        },
        modal: {
          ondismiss: () => {
            clearUpiPoll(); // cancel background UPI poll
            setState({ status: 'cancelled' });
          }
        }
      };

      setState({ status: 'awaiting_payment' });

      // Start a background poll for Android UPI redirect flow:
      // On some UPI apps Razorpay switches to a full-page redirect and the
      // handler callback never fires. This poll detects the plan upgrade
      // when the user comes back to the page.
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      upiPollRef.current = setInterval(async () => {
        const token = useAuthStore.getState().accessToken || '';
        if (!token) return;
        try {
          const res = await fetch(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const body = await res.json();
          if (body.data?.plan === 'PAID') {
            clearUpiPoll();
            await proceedToSuccess(planDuration);
          }
        } catch { /* network error — keep polling */ }
      }, 5000);

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        // This is handled by razorpay UI itself, but we can catch it
        console.error('Payment failed', response.error);
        setState({ status: 'error', message: response.error.description || 'Payment failed' });
      });
      rzp.open();

    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        sessionStorage.setItem('pendingPlanCheckout', planDuration);
        router.push('/login?callbackUrl=/pricing');
        return;
      }
      setState({ status: 'error', message: error.message || 'An unexpected error occurred during checkout' });
    }
  }, [user, accessToken, router, refresh]);

  // ─── Step 4 helper ──────────────────────────────────────────────────────────
  // Guards against concurrent calls (UPI poller + normal handler can both fire).
  // Polls Zustand until plan is actually 'PAID' before navigating — the fixed
  // 100ms delay was not enough on slow 4G connections where refresh() calls
  // /api/auth/refresh + /api/auth/me sequentially (can take 2–4 s on mobile).
  const proceedingRef = useRef(false);

  const proceedToSuccess = async (planDuration: PlanDuration) => {
    // Prevent double-call from UPI poller + normal handler racing each other
    if (proceedingRef.current) return;
    proceedingRef.current = true;

    setState({ status: 'refreshing_token' });
    try {
      await refresh();

      // Poll Zustand until plan is confirmed as PAID (up to 10 s on slow 4G).
      // refresh() calls /refresh then /me sequentially — both can be slow on
      // mobile; the old 100ms setTimeout was not enough on real devices.
      let freshUser = useAuthStore.getState().user;
      for (let i = 0; i < 20 && freshUser?.plan !== 'PAID'; i++) {
        await new Promise(r => setTimeout(r, 500));
        freshUser = useAuthStore.getState().user;
      }

      const planLabel = planDurationToLabel(parseInt(planDuration, 10));

      setState({ status: 'success' });
      router.push(
        `/payment/success?plan=${encodeURIComponent(planLabel)}&expires=${encodeURIComponent(freshUser?.planExpiresAt || '')}`
      );
    } catch {
      setState({
        status: 'error',
        message: 'Payment confirmed! Please refresh the page to unlock your notes.',
      });
    } finally {
      proceedingRef.current = false;
    }
  };

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, checkout, reset };
}

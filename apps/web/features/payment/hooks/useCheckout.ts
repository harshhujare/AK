import { useState, useCallback, useRef, useEffect } from 'react';
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

// ─── sessionStorage key for UPI redirect recovery ─────────────────────────────
// On Android, UPI payments via Razorpay cause a FULL PAGE REDIRECT to the UPI
// app. When the user returns, the browser either reloads the page or restores
// it from bfcache. In both cases React state is gone, setInterval is destroyed,
// and the Razorpay handler() callback never fires.
//
// Fix: Before opening the Razorpay modal we save the pending order info to
// sessionStorage. On mount, useCheckout checks for this saved state and
// immediately starts polling /me — which will return PAID once the Razorpay
// webhook has processed the payment (typically within 30–90 s of the capture).
const UPI_RECOVERY_KEY = 'pendingRazorpayOrder';

interface PendingOrderData {
  planDuration: PlanDuration;
  orderId: string;
  savedAt: number; // epoch ms — used to expire stale entries
}

export function useCheckout() {
  const [state, setState] = useState<CheckoutState>({ status: 'idle' });
  const { user, accessToken, refresh } = useAuthStore();
  const { refreshUserPlan } = useAuthStore.getState();
  const router = useRouter();
  // Ref to the background UPI poll — keeps the interval ID across renders
  const upiPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearUpiPoll = () => {
    if (upiPollRef.current) {
      clearInterval(upiPollRef.current);
      upiPollRef.current = null;
    }
  };

  // ─── UPI Redirect Recovery ─────────────────────────────────────────────────
  // On mount: check if there's a saved pending order from a UPI redirect that
  // destroyed the page. If found and less than 10 minutes old, start polling
  // immediately — the webhook will have updated the plan by the time we check.
  useEffect(() => {
    if (!user || !accessToken) return; // not logged in yet, wait

    const raw = sessionStorage.getItem(UPI_RECOVERY_KEY);
    if (!raw) return;

    let saved: PendingOrderData;
    try {
      saved = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem(UPI_RECOVERY_KEY);
      return;
    }

    // Expire recovery data after 10 minutes — beyond that, webhook has either
    // succeeded (plan is PAID) or Razorpay will not deliver it.
    const ageMs = Date.now() - saved.savedAt;
    if (ageMs > 10 * 60 * 1000) {
      sessionStorage.removeItem(UPI_RECOVERY_KEY);
      return;
    }

    // Found a recent pending order — this looks like a UPI redirect return.
    // Clear it immediately so we don't re-enter recovery on the next page load.
    sessionStorage.removeItem(UPI_RECOVERY_KEY);

    const { planDuration, orderId } = saved;

    console.log('[UPI Recovery] Detected return from UPI redirect, polling for plan upgrade...');
    setState({ status: 'polling' });

    // Poll /me to detect the plan upgrade triggered by Razorpay webhook.
    // ── Fix C: always flow through proceedToSuccess ──────────────────────────
    // proceedToSuccess calls refresh() which re-issues a fresh JWT containing
    // plan: 'PAID'. Without this, the Zustand store says Paid but the in-memory
    // accessToken still has plan: 'FREE', causing 403s on content requests until
    // the next page load. The polling path must go through proceedToSuccess so
    // the JWT is always updated before the user is shown the success page.
    pollForPlanUpgrade(() => useAuthStore.getState().accessToken || '').then(async (upgraded) => {
      if (upgraded) {
        // proceedToSuccess calls refresh() → fresh JWT → no 403 window
        await proceedToSuccess(planDuration);
      } else {
        // Webhook hasn't fired within the polling window — show a clear,
        // non-alarming message. The plan WILL activate once the webhook lands.
        setState({
          status: 'error',
          message:
            'Your UPI payment is being confirmed. This usually takes 1–2 minutes. ' +
            'Please refresh the page to check your plan status. ' +
            'If your plan is not activated after 10 minutes, contact support with Order ID: ' +
            orderId,
        });
      }
    });
  // proceedToSuccess is defined below and stable across renders (no deps change).
  // We intentionally run this effect only once on mount after auth is ready.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accessToken]);

  const checkout = useCallback(async (planDuration: PlanDuration = '365') => {
    if (!user || !accessToken) {
      // Save intent and redirect to login
      sessionStorage.setItem('pendingPlanCheckout', planDuration);
      router.push('/login?callbackUrl=/plans');
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
          // Clear the UPI recovery flag — the handler fired, so the page was NOT
          // destroyed by a redirect. Normal flow succeeded.
          sessionStorage.removeItem(UPI_RECOVERY_KEY);
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
              router.push('/login?callbackUrl=/plans');
              return;
            }
            
            // All verify retries failed (timeout / network) → start webhook polling.
            // verifyPaymentAPI already retried 3× with exponential backoff internally.
            if (verifyError.name === 'AbortError' || verifyError.message?.includes('fetch') || verifyError.message?.includes('Verification failed')) {
              setState({ status: 'polling' });
              
              // Poll /me for up to 100 s — enough for a Razorpay webhook to arrive
              const upgraded = await pollForPlanUpgrade(() => useAuthStore.getState().accessToken || '');
              
              if (upgraded) {
                await proceedToSuccess(planDuration);
              } else {
                // Last resort: try verify one final time.
                // By now the webhook has had 100 s to run, which means the payment
                // is marked SUCCESS on the server. The verify endpoint returns 200
                // idempotently for already-SUCCESS payments, so this will succeed
                // even without re-sending the signature — we still send it for
                // consistency; the server just won't re-process it.
                try {
                  await verifyPaymentAPI({
                    razorpayOrderId: response.razorpay_order_id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature,
                  }, accessToken, 1); // single attempt, no inner retry
                  await proceedToSuccess(planDuration);
                } catch {
                  // Final failure — give the user an accurate, reassuring message.
                  // The payment IS captured by Razorpay. It is NOT lost.
                  // The plan will be activated once our webhook processes the event.
                  setState({
                    status: 'error',
                    message:
                      'Your payment was received by Razorpay but our server took too long to confirm it. ' +
                      'Your plan will be activated automatically within a few minutes. ' +
                      'If it is not activated after 10 minutes, please contact support with Order ID: ' +
                      orderData.orderId,
                  });
                }
              }
            } else {
              // 400 signature mismatch or other definitive error
              setState({ status: 'error', message: 'Payment verification failed. Contact support with Order ID: ' + orderData.orderId });
            }
          }
        },
        modal: {
          ondismiss: () => {
            clearUpiPoll(); // cancel background UPI poll
            // Also clear recovery key — user dismissed the modal intentionally
            sessionStorage.removeItem(UPI_RECOVERY_KEY);
            setState({ status: 'cancelled' });
          }
        }
      };

      setState({ status: 'awaiting_payment' });

      // ── Save pending order to sessionStorage BEFORE opening the modal ───────
      // If the user selects UPI on Android, Razorpay does a full-page redirect
      // to the UPI app. The page is DESTROYED — React state, setInterval, and
      // the Razorpay handler all disappear. By saving the order info here, the
      // UPI recovery effect (on mount) can detect the return and poll for upgrade.
      const recoveryData: PendingOrderData = {
        planDuration,
        orderId: orderData.orderId,
        savedAt: Date.now(),
      };
      sessionStorage.setItem(UPI_RECOVERY_KEY, JSON.stringify(recoveryData));

      // Start a background poll for Android UPI redirect flow:
      // On some UPI apps Razorpay switches to a full-page redirect and the
      // handler callback never fires. This poll detects the plan upgrade
      // when the user comes back to the page (if page is NOT destroyed).
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
            sessionStorage.removeItem(UPI_RECOVERY_KEY);
            await proceedToSuccess(planDuration);
          }
        } catch { /* network error — keep polling */ }
      }, 5000);

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        // This is handled by razorpay UI itself, but we can catch it
        console.error('Payment failed', response.error);
        sessionStorage.removeItem(UPI_RECOVERY_KEY);
        setState({ status: 'error', message: response.error.description || 'Payment failed' });
      });

      // ── Fix D: wrap rzp.open() in try/catch ───────────────────────────────
      // If the Razorpay constructor succeeded (isLoaded === true) but open()
      // throws (e.g., a network error loading the checkout iframe, or an SDK
      // bug), the upiPollRef interval would run forever against a stale token
      // and the sessionStorage recovery key would never be cleared.
      try {
        rzp.open();
      } catch (openErr) {
        console.error('[Checkout] rzp.open() threw:', openErr);
        clearUpiPoll();
        sessionStorage.removeItem(UPI_RECOVERY_KEY);
        setState({ status: 'error', message: 'Could not open the payment window. Please try again.' });
      }

    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        sessionStorage.setItem('pendingPlanCheckout', planDuration);
        router.push('/login?callbackUrl=/plans');
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
      // Step 1: Get a fresh JWT with plan: 'PAID' embedded
      await refresh();

      // Step 2: Verify plan is actually PAID — poll server (not stale Zustand)
      // for up to 5 s to handle slow DB commits after /verify.
      let isPaid = useAuthStore.getState().user?.plan === 'PAID';
      for (let i = 0; i < 10 && !isPaid; i++) {
        await new Promise(r => setTimeout(r, 500));
        // Re-fetch from server instead of just checking stale in-memory state
        isPaid = await useAuthStore.getState().refreshUserPlan();
      }

      const freshUser = useAuthStore.getState().user;
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

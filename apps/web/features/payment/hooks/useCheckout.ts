import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/lib/auth-store';
import { createOrderAPI, verifyPaymentAPI } from '../services/api';
import { loadRazorpayScript, RazorpayOptions, RazorpayResponse } from '../utils/razorpay';
import { pollForPlanUpgrade } from '../utils/polling';

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

  const checkout = useCallback(async (planDuration: '365' = '365') => {
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
            
            await proceedToSuccess();
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
                await proceedToSuccess();
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
            setState({ status: 'cancelled' });
            // In a real UI we might toast here or just let the UI handle the state
          }
        }
      };

      setState({ status: 'awaiting_payment' });
      
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

  // Step 4 helper
  const proceedToSuccess = async () => {
    setState({ status: 'refreshing_token' });
    try {
      await refresh();
      // Wait a tick for Zustand to update its state
      await new Promise(r => setTimeout(r, 100));
      
      const freshUser = useAuthStore.getState().user;
      
      setState({ status: 'success' });
      router.push(`/payment/success?plan=Annual&expires=${freshUser?.planExpiresAt || ''}`);
    } catch (refreshError) {
      setState({ status: 'error', message: 'Payment confirmed! Please refresh the page to unlock your notes.' });
    }
  };

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, checkout, reset };
}

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import apiClient from '@/lib/api-client';
import useAuthStore from '@/lib/auth-store';
import type { User } from '@ajitsir/shared';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void;
          renderButton: (element: HTMLElement, config: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  onError?: (message: string) => void;
}

export default function GoogleSignInButton({ onError }: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);

  const handleCredentialResponse = useCallback(
    async (response: { credential: string }) => {
      setIsLoading(true);
      try {
        const { data } = await apiClient.post('/api/auth/google', {
          idToken: response.credential,
        });

        const { accessToken, user } = data.data as { accessToken: string; user: User };
        login(accessToken, user);

        const callbackUrl = searchParams.get('callbackUrl') || '/';
        router.push(callbackUrl);
      } catch (err) {
        setIsLoading(false);
        console.error('Google auth error:', err);
        onError?.('Sign in failed. Please try again.');
      }
    },
    [login, router, searchParams, onError]
  );

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set');
      return;
    }

    const initializeGoogle = () => {
      if (!window.google || !buttonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        width: buttonRef.current.offsetWidth,
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
      });
    };

    // Load GIS script if not already loaded
    if (window.google) {
      initializeGoogle();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    document.head.appendChild(script);

    return () => {
      // Cleanup: remove script on unmount
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) existingScript.remove();
    };
  }, [handleCredentialResponse]);

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '44px' }}>
      <div
        ref={buttonRef}
        id="google-signin-button"
        style={{
          width: '100%',
          minHeight: '44px',
          opacity: isLoading ? 0.5 : 1,
          pointerEvents: isLoading ? 'none' : 'auto',
          transition: 'opacity 0.2s'
        }}
      />
      {isLoading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justify: 'center',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(1px)',
          borderRadius: '4px',
          color: 'var(--text-primary, white)',
          fontSize: '0.85rem',
          fontWeight: 500,
          zIndex: 10
        }}>
          Signing in...
        </div>
      )}
    </div>
  );
}

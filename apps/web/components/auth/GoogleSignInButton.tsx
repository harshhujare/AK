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
          cancel: () => void;
        };
      };
    };
    __gsiInitialized?: boolean; // singleton flag — prevents double-init in Strict Mode
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

  // Store latest callback in a ref so the GIS initialize() call is only made once.
  // GIS internally holds a reference to the callback we pass at initialize time — if we
  // keep re-running initialize() every time the callback identity changes we get
  // origin-mismatch / double-init errors from the GIS state machine.
  const handleCredentialResponseRef = useRef<((response: { credential: string }) => Promise<void>) | null>(null);


  const login = useAuthStore((s) => s.login);

  // Keep the ref current on every render without re-running the effect
  handleCredentialResponseRef.current = useCallback(
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

    // Stable callback wrapper — this identity never changes across renders.
    // The actual handler inside the ref IS always fresh on every call.
    const stableCallback = (response: { credential: string }) => {
      handleCredentialResponseRef.current?.(response);
    };

    const initializeAndRender = () => {
      if (!window.google || !buttonRef.current) return;

      // Guard against Strict Mode double-invoke and hot-reload double-init
      if (!window.__gsiInitialized) {
        window.google.accounts.id.initialize({
          client_id:           clientId,
          callback:            stableCallback,
          auto_select:         false,
          cancel_on_tap_outside: true,
          ux_mode:             'popup',
        });
        window.__gsiInitialized = true;
      }

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme:          'outline',
        size:           'large',
        width:          buttonRef.current.offsetWidth || 340,
        text:           'continue_with',
        shape:          'rectangular',
        logo_alignment: 'left',
      });
    };

    if (window.google) {
      // GIS script already loaded (e.g. navigated back to login page)
      initializeAndRender();
      return;
    }

    // Avoid injecting duplicate script tags (Strict Mode mounts twice)
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      // Script already in DOM — wait for it or fire if already loaded
      if (window.google) {
        initializeAndRender();
      } else {
        existing.addEventListener('load', initializeAndRender, { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeAndRender;
    script.onerror = () => {
      console.error('Failed to load Google Identity Services script');
      onError?.('Google Sign-In unavailable. Check your connection.');
    };
    document.head.appendChild(script);

    // No cleanup: intentionally leave the script in the DOM.
    // Removing it on unmount then re-adding on re-mount causes the GIS origin
    // error because the library re-evaluates window.location.origin each load.
    // The __gsiInitialized guard prevents double-initialize without needing removal.
  // eslint-disable-next-line react-hooks/exhaustive-deps — runs once on mount
  }, []);

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
          transition: 'opacity 0.2s',
        }}
      />
      {isLoading && (
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(1px)',
            borderRadius: '4px',
            color: 'var(--text-primary, white)',
            fontSize: '0.85rem',
            fontWeight: 500,
            zIndex: 10,
          }}
        >
          Signing in...
        </div>
      )}
    </div>
  );
}

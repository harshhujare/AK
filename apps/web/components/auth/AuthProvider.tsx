'use client';

import { useEffect } from 'react';
import useAuthStore from '@/lib/auth-store';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initialize, isInitialized } = useAuthStore();

  // ─── Initial session restore ────────────────────────────────────────────────
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  return <>{children}</>;
}

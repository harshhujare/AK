'use client';

import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PaywallBanner() {
  const router = useRouter();

  return (
    <div className="paywall-banner">
      <Lock size={28} className="paywall-icon" />
      <p className="paywall-text">This note requires a paid subscription</p>
      <button 
        className="paywall-btn" 
        onClick={(e) => {
          e.stopPropagation();
          router.push('/pricing');
        }}
      >
        Upgrade plan
      </button>

      <style>{`
        .paywall-banner {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          color: white;
          padding: 1rem;
          text-align: center;
          z-index: 10;
        }
        .paywall-icon {
          color: var(--accent);
          opacity: 0.9;
        }
        .paywall-text {
          font-size: 0.85rem;
          font-weight: 500;
          line-height: 1.4;
        }
        .paywall-btn {
          background: var(--accent-bg);
          color: var(--accent-text);
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
          margin-top: 0.5rem;
        }
        .paywall-btn:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}

'use client';

import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * PaywallBanner
 *
 * Rendered inside the NoteCard image container when a user with a FREE plan
 * (or expired PAID plan) tries to interact with a paid note.
 *
 * Sits at position:absolute to cover the thumbnail area. The parent
 * (.note-card-image-container) must have `position: relative` — which it
 * already does in NoteCard.
 *
 * Props: none — navigates internally to /pricing.
 */
export default function PaywallBanner() {
  const router = useRouter();

  return (
    <>
      <div className="paywall-banner" role="region" aria-label="Premium content locked">
        <Lock size={28} className="paywall-icon" aria-hidden="true" />
        <p className="paywall-text">This note requires a paid subscription</p>
        <button
          className="paywall-btn"
          onClick={(e) => {
            e.stopPropagation();
            router.push('/pricing');
          }}
          aria-label="Go to pricing page to upgrade plan"
        >
          Upgrade plan
        </button>
      </div>

      <style>{`
        .paywall-banner {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          color: white;
          padding: 1rem;
          text-align: center;
          z-index: 10;
          transition: background 0.2s;
        }
        .paywall-icon {
          color: var(--accent, #6366f1);
          opacity: 0.9;
          flex-shrink: 0;
        }
        .paywall-text {
          font-size: 0.85rem;
          font-weight: 500;
          line-height: 1.4;
          margin: 0;
        }
        .paywall-btn {
          background: var(--accent-bg, #6366f1);
          color: var(--accent-text, #fff);
          border: none;
          padding: 0.5rem 1.25rem;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
          margin-top: 0.25rem;
        }
        .paywall-btn:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        .paywall-btn:active {
          transform: translateY(0);
        }
      `}</style>
    </>
  );
}

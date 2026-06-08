import React from 'react';

interface PdfErrorStateProps {
  message: string;
  onRetry: () => void;
  isOffline?: boolean;
}

export function PdfErrorState({ message, onRetry, isOffline }: PdfErrorStateProps) {
  const isCompatibilityError =
    message.toLowerCase().includes('tohex') ||
    message.toLowerCase().includes('not a function') ||
    message.toLowerCase().includes('structuredclone');

  // ── Offline — PDF not yet cached ────────────────────────────────────────────
  if (isOffline) {
    return (
      <div className="viewer-center-msg text-red" style={{ gap: '1rem', padding: '0 20px', textAlign: 'center' }}>
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
        </svg>
        <h3 style={{ margin: '0', fontSize: '1.25rem', color: '#f87171' }}>You&apos;re Offline</h3>
        <p style={{ margin: '0', fontSize: '0.95rem', color: '#9ca3af' }}>{message}</p>
        <button className="btn-retry" onClick={onRetry} style={{ marginTop: '0.5rem' }}>
          Try Again
        </button>
      </div>
    );
  }

  // ── Unsupported browser (WhatsApp / in-app viewer) ──────────────────────────
  if (isCompatibilityError) {
    return (
      <div className="viewer-center-msg text-red" style={{ gap: '1rem', padding: '0 20px', textAlign: 'center' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 style={{ margin: '0', fontSize: '1.25rem', color: '#f87171' }}>Unsupported Browser</h3>
        <p style={{ margin: '0', fontSize: '0.95rem', color: '#9ca3af' }}>
          This browser (like WhatsApp&apos;s in-app viewer) doesn&apos;t support the PDF viewer.
        </p>
        <p style={{ margin: '0', fontSize: '0.95rem', color: '#9ca3af', marginBottom: '1rem' }}>
          Please open this link in <strong>Chrome</strong> or <strong>Safari</strong> for the best experience.
        </p>
        <button
          className="btn-retry"
          onClick={() => {
            if (typeof window !== 'undefined') {
              navigator.clipboard.writeText(window.location.href)
                .then(() => alert('Link copied! Open Chrome or Safari and paste it.'))
                .catch(() => alert('Please manually copy the URL from the address bar.'));
            }
          }}
        >
          Copy Link
        </button>
      </div>
    );
  }

  // ── Generic error ────────────────────────────────────────────────────────────
  return (
    <div className="viewer-center-msg text-red">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <p>{message}</p>
      <button className="btn-retry" onClick={onRetry}>Retry</button>
    </div>
  );
}

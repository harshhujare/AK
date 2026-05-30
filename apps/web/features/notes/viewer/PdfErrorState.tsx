import React from 'react';

interface PdfErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function PdfErrorState({ message, onRetry }: PdfErrorStateProps) {
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

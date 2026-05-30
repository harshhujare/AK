import React from 'react';
import type { FetchState } from './useSecurePdf';

interface PdfLoadingStateProps {
  fetchState: Extract<FetchState, { stage: 'downloading' } | { stage: 'parsing' }>;
}

export function PdfLoadingState({ fetchState }: PdfLoadingStateProps) {
  if (fetchState.stage === 'parsing') {
    return (
      <div className="viewer-center-msg">
        <div className="spinner"></div>
        <p>Preparing document…</p>
      </div>
    );
  }

  // downloading state
  return (
    <div className="viewer-center-msg">
      <div className="spinner"></div>
      {fetchState.total > 0 ? (
        <div className="download-progress-wrap">
          <div className="download-progress-bar-track">
            <div
              className="download-progress-bar-fill"
              style={{ width: `${Math.round((fetchState.downloaded / fetchState.total) * 100)}%` }}
            />
          </div>
          <p className="download-progress-text">
            Downloading securely…&nbsp;
            <strong>{(fetchState.downloaded / (1024 * 1024)).toFixed(1)} MB</strong>
            {' / '}
            <strong>{(fetchState.total / (1024 * 1024)).toFixed(1)} MB</strong>
            {' '}({Math.round((fetchState.downloaded / fetchState.total) * 100)}%)
          </p>
          {fetchState.total > 30 * 1024 * 1024 && fetchState.downloaded < fetchState.total * 0.05 && (
            <p className="large-file-hint">Large document — please wait, loading once keeps it fast.</p>
          )}
        </div>
      ) : (
        <p>Loading document securely…</p>
      )}
    </div>
  );
}

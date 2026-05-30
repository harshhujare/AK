'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { NoteWithSubject } from '@/hooks/useNotes';
import { useViewerSecurity } from './useViewerSecurity';
import { useSecurePdf } from './useSecurePdf';
import { PdfLoadingState } from './PdfLoadingState';
import { PdfErrorState } from './PdfErrorState';
import { PdfPages } from './PdfPages';
import './viewer.css';

// Use local worker copy in /public (PDF.js v5 .mjs not on cdnjs yet)
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface SecureViewerProps {
  note: NoteWithSubject;
  onClose: () => void;
}

export default function SecureViewer({ note, onClose }: SecureViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomWrapperRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [retryNonce, setRetryNonce] = useState(0);
  const [scale, setScale] = useState(1);
  const [transformOrigin, setTransformOrigin] = useState<string>('top center');
  const [rotation, setRotation] = useState(0);

  const { isFullscreen, toggleFullscreen } = useViewerSecurity(viewerRef);
  const { fetchState, fromCache } = useSecurePdf(note, retryNonce);

  // ─── Touch Pinch Zoom Handling ─────────────────────────────────────────────
  const [initialPinchDist, setInitialPinchDist] = useState<number | null>(null);
  const [initialScale, setInitialScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [lastTouch, setLastTouch] = useState<{ x: number, y: number } | null>(null);

  useEffect(() => {
    if (scale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setInitialPinchDist(dist);
      setInitialScale(scale);
      setLastTouch(null); // Reset single touch pan

      if (scale === 1 && zoomWrapperRef.current) {
        const rect = zoomWrapperRef.current.getBoundingClientRect();
        const clientX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const clientY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        
        const originX = clientX - rect.left;
        const originY = clientY - rect.top;
        setTransformOrigin(`${originX}px ${originY}px`);
      }
    } else if (e.touches.length === 1 && scale > 1) {
      setLastTouch({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDist !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const newScale = Math.min(Math.max(initialScale * (dist / initialPinchDist), 0.5), 3.0);
      setScale(newScale);
      setLastTouch(null);
    } else if (e.touches.length === 1 && lastTouch && scale > 1) {
      const dx = e.touches[0].clientX - lastTouch.x;
      const dy = e.touches[0].clientY - lastTouch.y;
      setPosition(prev => ({ x: prev.x + dx / scale, y: prev.y + dy / scale }));
      setLastTouch({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setInitialPinchDist(null);
    }
    if (e.touches.length === 0) {
      setLastTouch(null);
    }
  };

  // ─── Track current visible page ───────────────────────────────────────────
  const handlePageVisible = useCallback((pageNumber: number) => {
    setCurrentPage(pageNumber);
  }, []);

  const numPages = fetchState.stage === 'ready' ? fetchState.numPages : 0;

  return (
    <div 
      className="secure-viewer-overlay" 
      role="dialog" 
      aria-modal="true" 
      aria-label={`Viewing ${note.title}`}
      ref={viewerRef}
    >
      {/* Header */}
      <header className="viewer-header">
        <div className="viewer-title-group">
          <h2 className="viewer-title font-serif">{note.title}</h2>
          <span className="viewer-badge">{note.subject.name}</span>
          {fetchState.stage === 'ready' && (
            <span className="viewer-page-count">{currentPage} / {numPages}</span>
          )}
          {fromCache && fetchState.stage === 'ready' && (
            <span className="viewer-cache-badge" title="Loaded from local cache">
              ⚡ Instant
            </span>
          )}
        </div>

        {/* Desktop Controls */}
        <div className="viewer-controls hidden-mobile">
          <button className="control-btn" onClick={() => setScale(s => Math.max(0.5, s - 0.25))} aria-label="Zoom out">−</button>
          <span className="control-text">{Math.round(scale * 100)}%</span>
          <button className="control-btn" onClick={() => setScale(s => Math.min(3, s + 0.25))} aria-label="Zoom in">+</button>
          <div className="control-divider" />
          <button className="control-btn" onClick={() => setRotation(r => (r - 90 + 360) % 360)} aria-label="Rotate left">
            ↺
          </button>
          <button className="control-btn" onClick={() => setRotation(r => (r + 90) % 360)} aria-label="Rotate right">
            ↻
          </button>
          <div className="control-divider" />
          <button className="control-btn" onClick={toggleFullscreen} aria-label="Toggle fullscreen">
            {isFullscreen ? '⤓' : '⤢'}
          </button>
        </div>

        <button className="viewer-close-btn" onClick={onClose} aria-label="Close viewer">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </header>

      {/* Content */}
      <main 
        className="viewer-content" 
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {fetchState.stage === 'downloading' || fetchState.stage === 'parsing' ? (
          <PdfLoadingState fetchState={fetchState} />
        ) : null}

        {fetchState.stage === 'error' && (
          <PdfErrorState message={fetchState.message} onRetry={() => setRetryNonce(n => n + 1)} />
        )}

        {/* Ready state — lazy page rendering */}
        {fetchState.stage === 'ready' && (
          <div 
            className="pdf-zoom-wrapper" 
            style={{ transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`, transformOrigin }}
            ref={zoomWrapperRef}
          >
            <PdfPages 
              numPages={fetchState.numPages} 
              pdfDoc={fetchState.doc} 
              rotation={rotation} 
              onPageVisible={handlePageVisible}
              pageRefs={pageRefs}
            />
          </div>
        )}
      </main>

      {/* Mobile Floating Pill Controls */}
      <div className="mobile-floating-pill visible-mobile">
        <button className="control-btn" onClick={() => setRotation(r => (r - 90 + 360) % 360)} aria-label="Rotate left">
          ↺
        </button>
        <div className="control-divider" />
        <button className="control-btn" onClick={() => setRotation(r => (r + 90) % 360)} aria-label="Rotate right">
          ↻
        </button>
        <div className="control-divider" />
        <button className="control-btn" onClick={toggleFullscreen} aria-label="Toggle fullscreen">
          {isFullscreen ? '⤓' : '⤢'}
        </button>
      </div>
    </div>
  );
}

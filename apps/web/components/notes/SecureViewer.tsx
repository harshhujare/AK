'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import WatermarkCanvas from './WatermarkCanvas';
import type { NoteWithSubject } from '@/hooks/useNotes';

// Use local worker copy in /public (PDF.js v5 .mjs not on cdnjs yet)
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface SecureViewerProps {
  note: NoteWithSubject;
  onClose: () => void;
}

// ─── Fetch state machine ───────────────────────────────────────────────────────
type FetchState =
  | { stage: 'downloading'; downloaded: number; total: number }
  | { stage: 'parsing' }
  | { stage: 'ready'; doc: pdfjsLib.PDFDocumentProxy; numPages: number }
  | { stage: 'error'; message: string };

export default function SecureViewer({ note, onClose }: SecureViewerProps) {
  const [fetchState, setFetchState] = useState<FetchState>({ stage: 'downloading', downloaded: 0, total: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ─── Security blockers ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['p', 's', 'c', 'a'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        return false;
      }
    };
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // ─── Streaming fetch + PDF parse ───────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;

    async function loadPdf() {
      try {
        setFetchState({ stage: 'downloading', downloaded: 0, total: 0 });

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

        const response = await fetch(`${apiUrl}/api/notes/${note.id}/stream`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
          const msg =
            response.status === 401 ? 'Please log in to view this document.' :
            response.status === 403 ? 'You do not have access to this document.' :
            'Failed to load document. Please try again.';
          throw new Error(msg);
        }

        // ── Streaming download with progress ────────────────────────────────
        const contentLength = Number(response.headers.get('Content-Length') || 0);
        const reader = response.body?.getReader();

        if (!reader) {
          // Fallback: no streaming support (older browsers)
          const buffer = await response.arrayBuffer();
          if (!isMounted) return;
          setFetchState({ stage: 'parsing' });
          const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
          if (!isMounted) { doc.destroy(); return; }
          pdfDoc = doc;
          setFetchState({ stage: 'ready', doc, numPages: doc.numPages });
          return;
        }

        const chunks: Uint8Array[] = [];
        let downloaded = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!isMounted) { reader.cancel(); return; }
          chunks.push(value);
          downloaded += value.byteLength;
          setFetchState({ stage: 'downloading', downloaded, total: contentLength });
        }

        if (!isMounted) return;

        // Assemble all chunks into one buffer
        const totalBytes = chunks.reduce((sum, c) => sum + c.byteLength, 0);
        const merged = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.byteLength;
        }

        setFetchState({ stage: 'parsing' });
        const doc = await pdfjsLib.getDocument({ data: merged }).promise;
        if (!isMounted) { doc.destroy(); return; }
        pdfDoc = doc;
        setFetchState({ stage: 'ready', doc, numPages: doc.numPages });
      } catch (err) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Failed to load document. Please try again.';
          setFetchState({ stage: 'error', message: msg });
        }
      }
    }

    loadPdf();

    return () => {
      isMounted = false;
      pdfDoc?.destroy();
    };
  }, [note.id]);

  // ─── Track current visible page ───────────────────────────────────────────
  const handlePageVisible = useCallback((pageNumber: number) => {
    setCurrentPage(pageNumber);
  }, []);

  const numPages = fetchState.stage === 'ready' ? fetchState.numPages : 0;

  return (
    <div className="secure-viewer-overlay" role="dialog" aria-modal="true" aria-label={`Viewing ${note.title}`}>
      {/* Header */}
      <header className="viewer-header">
        <div className="viewer-title-group">
          <h2 className="viewer-title font-serif">{note.title}</h2>
          <span className="viewer-badge">{note.subject.name}</span>
          {fetchState.stage === 'ready' && (
            <span className="viewer-page-count">{currentPage} / {numPages}</span>
          )}
        </div>
        <button className="viewer-close-btn" onClick={onClose} aria-label="Close viewer">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </header>

      {/* Content */}
      <main className="viewer-content" ref={containerRef}>
        {/* ── Downloading state ── */}
        {fetchState.stage === 'downloading' && (
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
        )}

        {/* ── Parsing state ── */}
        {fetchState.stage === 'parsing' && (
          <div className="viewer-center-msg">
            <div className="spinner"></div>
            <p>Preparing document…</p>
          </div>
        )}

        {/* ── Error state ── */}
        {fetchState.stage === 'error' && (
          <div className="viewer-center-msg text-red">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p>{fetchState.message}</p>
            <button className="btn-retry" onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        {/* ── Ready state — lazy page rendering ── */}
        {fetchState.stage === 'ready' && (
          <div className="pdf-pages-container">
            {Array.from({ length: fetchState.numPages }, (_, i) => (
              <LazyPdfPage
                key={i + 1}
                pageNumber={i + 1}
                pdfDoc={fetchState.doc}
                onVisible={handlePageVisible}
                ref={(el) => { pageRefs.current[i] = el; }}
              />
            ))}
          </div>
        )}
      </main>

      {/* Security CSS */}
      <style>{`
        .secure-viewer-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #0a0a0a;
          display: flex;
          flex-direction: column;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
        }

        @media print {
          .secure-viewer-overlay { display: none !important; }
          body { display: none !important; }
        }

        .viewer-header {
          height: 64px;
          flex-shrink: 0;
          background: rgba(20,20,20,0.95);
          border-bottom: 1px solid rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 1.5rem;
          backdrop-filter: blur(10px);
        }
        .viewer-title-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 0;
        }
        .viewer-title {
          color: white;
          font-size: 1.1rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }
        .viewer-badge {
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.7);
          font-size: 0.7rem;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          text-transform: uppercase;
          flex-shrink: 0;
        }
        .viewer-page-count {
          background: rgba(255,255,255,0.07);
          color: rgba(255,255,255,0.5);
          font-size: 0.72rem;
          padding: 0.2rem 0.55rem;
          border-radius: 4px;
          font-variant-numeric: tabular-nums;
          flex-shrink: 0;
        }
        .viewer-close-btn {
          background: none;
          border: none;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 8px;
          transition: background 0.2s, color 0.2s;
          flex-shrink: 0;
        }
        .viewer-close-btn:hover {
          background: rgba(255,255,255,0.1);
          color: white;
        }
        .viewer-content {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 2rem;
          background: #111;
          -webkit-overflow-scrolling: touch;
        }
        .viewer-center-msg {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 200px;
          color: rgba(255,255,255,0.5);
          gap: 1rem;
          text-align: center;
          padding: 2rem;
        }
        .text-red { color: #fca5a5; }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Download progress bar */
        .download-progress-wrap {
          width: 100%;
          max-width: 360px;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          align-items: center;
        }
        .download-progress-bar-track {
          width: 100%;
          height: 5px;
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
          overflow: hidden;
        }
        .download-progress-bar-fill {
          height: 100%;
          background: rgba(255,255,255,0.7);
          border-radius: 3px;
          transition: width 0.3s ease;
        }
        .download-progress-text {
          font-size: 0.78rem;
          color: rgba(255,255,255,0.5);
          text-align: center;
        }
        .download-progress-text strong { color: rgba(255,255,255,0.8); }
        .large-file-hint {
          font-size: 0.72rem;
          color: rgba(255,255,255,0.35);
          text-align: center;
        }

        .btn-retry {
          margin-top: 0.5rem;
          padding: 0.5rem 1.5rem;
          background: white;
          color: black;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
        }

        .pdf-pages-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
          max-width: 1000px;
          margin: 0 auto;
        }

        .pdf-page-wrapper {
          position: relative;
          background: white;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          border-radius: 4px;
          overflow: hidden;
        }

        /* Placeholder for pages not yet rendered */
        .pdf-page-placeholder {
          background: #1a1a1a;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.15);
          font-size: 0.75rem;
          min-height: 100px;
        }

        @media (max-width: 768px) {
          .viewer-content { padding: 0.75rem; }
          .pdf-pages-container { gap: 0.75rem; }
          .viewer-title { max-width: 120px; font-size: 0.95rem; }
          .viewer-badge { display: none; }
        }
      `}</style>
    </div>
  );
}

// ─── Lazy Page Renderer ────────────────────────────────────────────────────────
// Uses IntersectionObserver to only render pages that are near the viewport.
// Off-screen pages show a placeholder with estimated height to maintain scroll position.
// Zero extra HTTP requests — all rendering is from the already-downloaded PDF data.

interface LazyPdfPageProps {
  pageNumber: number;
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  onVisible: (pageNumber: number) => void;
}

const LazyPdfPage = React.forwardRef<HTMLDivElement, LazyPdfPageProps>(
  function LazyPdfPage({ pageNumber, pdfDoc, onVisible }, ref) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [rendered, setRendered] = useState(false);
    const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
    const [estimatedHeight, setEstimatedHeight] = useState(1100); // reasonable default

    // Expose ref to parent
    useEffect(() => {
      if (typeof ref === 'function') ref(wrapperRef.current);
      else if (ref) ref.current = wrapperRef.current;
    }, [ref]);

    // Pre-calculate page dimensions for the placeholder (no rendering)
    useEffect(() => {
      async function calcDimensions() {
        try {
          const page = await pdfDoc.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1 });
          const containerWidth = Math.min(window.innerWidth - (window.innerWidth <= 768 ? 24 : 64), 1000);
          // Cap DPR at 2.0 — DPR 3 triples memory with no visible gain on small screens
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const scale = (containerWidth / viewport.width) * dpr;
          const scaledViewport = page.getViewport({ scale: scale / dpr });
          setEstimatedHeight(Math.floor(scaledViewport.height));
        } catch {
          // Keep default
        }
      }
      calcDimensions();
    }, [pdfDoc, pageNumber]);

    // IntersectionObserver — render when close to viewport, destroy when far away
    useEffect(() => {
      const el = wrapperRef.current;
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry.isIntersecting) {
            setRendered(true);
            onVisible(pageNumber);
          }
        },
        {
          root: null,
          // Render 1 screen-height ahead/behind so pages appear before user reaches them
          rootMargin: '100% 0px',
          threshold: 0,
        }
      );

      observer.observe(el);
      return () => observer.disconnect();
    }, [pageNumber, onVisible]);

    // Actual canvas rendering — only when this page is close to viewport
    useEffect(() => {
      if (!rendered) return;

      let isMounted = true;
      let renderTask: pdfjsLib.RenderTask | null = null;

      async function renderPage() {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        try {
          const page = await pdfDoc.getPage(pageNumber);
          if (!isMounted) return;

          // Fit to container width, cap DPR at 2.0 to protect mobile GPU/RAM
          const containerWidth = Math.min(
            window.innerWidth - (window.innerWidth <= 768 ? 24 : 64),
            1000
          );
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const viewportUnscaled = page.getViewport({ scale: 1 });
          const scale = containerWidth / viewportUnscaled.width;
          const viewport = page.getViewport({ scale });

          // Physical pixels (canvas attribute)
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);

          // Logical pixels (CSS) — must match container
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;

          if (isMounted) {
            setDimensions({ w: Math.floor(viewport.width), h: Math.floor(viewport.height) });
          }

          const renderContext = {
            canvas,
            canvasContext: ctx,
            viewport,
            transform: [dpr, 0, 0, dpr, 0, 0] as [number, number, number, number, number, number],
          };

          if (!isMounted) return;
          renderTask = page.render(renderContext);
          await renderTask.promise;
        } catch (err: unknown) {
          const e = err as { name?: string; message?: string };
          if (e?.name === 'RenderingCancelledException' || e?.message?.includes('cancelled')) {
            // Expected on fast scroll — not an error
          } else {
            console.error(`Page ${pageNumber} render error:`, err);
          }
        }
      }

      renderPage();

      return () => {
        isMounted = false;
        renderTask?.cancel();
      };
    }, [rendered, pageNumber, pdfDoc]);

    return (
      <div
        ref={wrapperRef}
        className={rendered ? 'pdf-page-wrapper' : 'pdf-page-placeholder'}
        style={!rendered ? { width: '100%', maxWidth: '1000px', height: `${estimatedHeight}px` } : undefined}
      >
        {rendered && (
          <>
            <canvas ref={canvasRef} />
            {dimensions && (
              <WatermarkCanvas width={dimensions.w} height={dimensions.h} />
            )}
          </>
        )}
        {!rendered && <span>Loading page {pageNumber}…</span>}
      </div>
    );
  }
);

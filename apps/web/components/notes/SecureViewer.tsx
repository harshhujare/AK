'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import apiClient from '@/lib/api-client';
import WatermarkCanvas from './WatermarkCanvas';
import type { NoteWithSubject } from '@/hooks/useNotes';

// Initialize PDF.js worker from CDN (avoids local Webpack build issues)
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface SecureViewerProps {
  note: NoteWithSubject;
  onClose: () => void;
}

export default function SecureViewer({ note, onClose }: SecureViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Security blockers
  useEffect(() => {
    // Block context menu
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    
    // Block keyboard shortcuts (Ctrl+P, Ctrl+S, Ctrl+C, Ctrl+A)
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

  // Fetch and load PDF
  useEffect(() => {
    let isMounted = true;

    async function loadPdf() {
      try {
        setLoading(true);
        
        // 1. Get signed URL (5-min expiry)
        const { data: tokenData } = await apiClient.get<{ data: { url: string } }>(
          `/api/notes/${note.id}/view-token`
        );
        
        // 2. Fetch raw bytes (doesn't expose URL to DOM)
        const response = await fetch(tokenData.data.url);
        if (!response.ok) throw new Error('Failed to download document');
        const arrayBuffer = await response.arrayBuffer();
        
        if (!isMounted) return;

        // 3. Load into PDF.js
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        
        if (!isMounted) return;
        
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      } catch (err) {
        console.error('PDF load error:', err);
        if (isMounted) {
          setError('Failed to load document securely. Please try again.');
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isMounted = false;
      // Cleanup PDF memory
      if (pdfDoc) pdfDoc.destroy();
    };
  }, [note.id]);

  return (
    <div className="secure-viewer-overlay" role="dialog" aria-modal="true" aria-label={`Viewing ${note.title}`}>
      {/* Header */}
      <header className="viewer-header">
        <div className="viewer-title-group">
          <h2 className="viewer-title font-serif">{note.title}</h2>
          <span className="viewer-badge">{note.subject.name}</span>
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
        {loading && (
          <div className="viewer-center-msg">
            <div className="spinner"></div>
            <p>Loading document securely...</p>
          </div>
        )}
        
        {error && (
          <div className="viewer-center-msg text-red">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p>{error}</p>
            <button className="btn-retry" onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        {!loading && !error && pdfDoc && (
          <div className="pdf-pages-container">
            {Array.from(new Array(numPages), (_, index) => (
              <PdfPage key={index + 1} pageNumber={index + 1} pdfDoc={pdfDoc} />
            ))}
          </div>
        )}
      </main>

      {/* Security CSS Blockers */}
      <style>{`
        .secure-viewer-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #0a0a0a;
          display: flex;
          flex-direction: column;
          
          /* CRITICAL SECURITY CSS */
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
        }

        /* Prevent printing */
        @media print {
          .secure-viewer-overlay {
            display: none !important;
          }
          body {
            display: none !important;
          }
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
          gap: 1rem;
        }
        
        .viewer-title {
          color: white;
          font-size: 1.1rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 300px;
        }
        
        .viewer-badge {
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.7);
          font-size: 0.7rem;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          text-transform: uppercase;
        }
        
        .viewer-close-btn {
          background: none;
          border: none;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 8px;
          transition: background 0.2s, color 0.2s;
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
        }

        .viewer-center-msg {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: rgba(255,255,255,0.5);
          gap: 1rem;
        }
        
        .text-red {
          color: #fca5a5;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .btn-retry {
          margin-top: 1rem;
          padding: 0.5rem 1.5rem;
          background: white;
          color: black;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
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
        
        @media (max-width: 768px) {
          .viewer-content { padding: 1rem; }
          .pdf-pages-container { gap: 1rem; }
          .viewer-title { max-width: 150px; font-size: 1rem; }
          .viewer-badge { display: none; }
        }
      `}</style>
    </div>
  );
}

// ─── Individual Page Renderer ──────────────────────────────────────────────────

function PdfPage({ pageNumber, pdfDoc }: { pageNumber: number; pdfDoc: pdfjsLib.PDFDocumentProxy }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let isMounted = true;
    let renderTask: pdfjsLib.RenderTask | null = null;

    async function renderPage() {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        const page = await pdfDoc.getPage(pageNumber);
        
        // Calculate scale to fit width (max 900px)
        const viewportUnscaled = page.getViewport({ scale: 1 });
        const containerWidth = Math.min(window.innerWidth - 32, 900);
        const scale = containerWidth / viewportUnscaled.width;
        
        const viewport = page.getViewport({ scale });
        
        // Handle High DPI
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        
        if (isMounted) {
          setDimensions({ w: Math.floor(viewport.width), h: Math.floor(viewport.height) });
        }

        const renderContext = {
          canvas: canvas,
          canvasContext: ctx,
          viewport: viewport,
          transform: [dpr, 0, 0, dpr, 0, 0] // Apply DPR scaling
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;

      } catch (err: any) {
        if (err?.name === 'RenderingCancelledException') {
          // Expected when navigating away quickly
        } else {
          console.error(`Error rendering page ${pageNumber}:`, err);
        }
      }
    }

    renderPage();

    return () => {
      isMounted = false;
      if (renderTask) renderTask.cancel();
    };
  }, [pageNumber, pdfDoc]);

  return (
    <div className="pdf-page-wrapper">
      <canvas ref={canvasRef} className="pdf-canvas" />
      {/* Watermark overlay */}
      {dimensions && <WatermarkCanvas width={dimensions.w} height={dimensions.h} />}
    </div>
  );
}

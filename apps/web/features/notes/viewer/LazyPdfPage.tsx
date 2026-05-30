import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import WatermarkCanvas from '@/components/notes/WatermarkCanvas';

interface LazyPdfPageProps {
  pageNumber: number;
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  rotation: number;
  onVisible: (pageNumber: number) => void;
}

export const LazyPdfPage = React.forwardRef<HTMLDivElement, LazyPdfPageProps>(
  function LazyPdfPage({ pageNumber, pdfDoc, rotation, onVisible }, ref) {
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
          const viewport = page.getViewport({ scale: 1, rotation });
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
    }, [pdfDoc, pageNumber, rotation]);

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
          const viewportUnscaled = page.getViewport({ scale: 1, rotation });
          const scale = containerWidth / viewportUnscaled.width;
          const viewport = page.getViewport({ scale, rotation });

          // Physical pixels (canvas attribute) — setting canvas.width resets the 2D context
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);

          // Logical pixels (CSS) — constrains visual display to container size
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;

          if (isMounted) {
            setDimensions({ w: Math.floor(viewport.width), h: Math.floor(viewport.height) });
          }

          // Scale the canvas context by dpr so PDF.js draws at full physical resolution.
          // DO NOT use the `transform` render parameter — it applies on top of the viewport
          // transform and causes content to render off-canvas on mobile (blank white pages).
          // ctx.scale() here is safe because canvas.width assignment above resets the context.
          ctx.scale(dpr, dpr);

          // Render without transform — ctx.scale handles the DPR scaling
          const renderContext = {
            canvas,
            canvasContext: ctx,
            viewport,
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
    }, [rendered, pageNumber, pdfDoc, rotation]);

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

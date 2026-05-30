import React from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { LazyPdfPage } from './LazyPdfPage';

interface PdfPagesProps {
  numPages: number;
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  rotation: number;
  onPageVisible: (pageNumber: number) => void;
  pageRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
}

export function PdfPages({ numPages, pdfDoc, rotation, onPageVisible, pageRefs }: PdfPagesProps) {
  return (
    <div className="pdf-pages-container">
      {Array.from({ length: numPages }, (_, i) => (
        <LazyPdfPage
          key={i + 1}
          pageNumber={i + 1}
          pdfDoc={pdfDoc}
          rotation={rotation}
          onVisible={onPageVisible}
          ref={(el) => { pageRefs.current[i] = el; }}
        />
      ))}
    </div>
  );
}

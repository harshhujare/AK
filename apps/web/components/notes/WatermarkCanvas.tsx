'use client';

import { useEffect, useRef } from 'react';
import useAuthStore from '@/lib/auth-store';

interface WatermarkCanvasProps {
  width: number;
  height: number;
}

export default function WatermarkCanvas({ width, height }: WatermarkCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // If no user, keep canvas hidden and do nothing — an invisible empty canvas
    // with position:absolute and z-index:10 can block touch events on mobile.
    if (!user) {
      canvas.style.visibility = 'hidden';
      return;
    }

    canvas.style.visibility = 'visible';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays for crisp text.
    // IMPORTANT: cap DPR at 2 — DPR 3 triples memory usage with no visual gain on small screens.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Physical pixel dimensions (canvas attribute)
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    // Logical display dimensions (CSS) — must match the wrapper div size exactly.
    // Without this, on 3× DPR phones the canvas element overflows its container
    // and covers the PDF canvas below it, making pages look blank.
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Mask email: j***@gmail.com
    const emailParts = user.email.split('@');
    const maskedEmail = emailParts.length === 2 
      ? emailParts[0].charAt(0) + '***@' + emailParts[1]
      : '***';

    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const watermarkText = `${user.name} · ${maskedEmail} · ${dateStr}`;

    // Setup text style
    ctx.font = 'bold 20px "DM Sans", sans-serif';
    ctx.fillStyle = 'rgba(150, 150, 150, 0.15)'; // Very faint
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Measure text to prevent overlap
    const metrics = ctx.measureText(watermarkText);
    const textWidth = metrics.width;
    
    // Draw watermark diagonally across the page repeatedly
    // Use dynamic spacing based on actual text width
    const stepX = Math.max(textWidth + 80, 400); // At least 400px, or text + 80px gap
    const stepY = 280;

    ctx.save();
    ctx.rotate((-30 * Math.PI) / 180); // -30 degrees diagonal

    // Draw outside the literal bounds to cover full area after rotation
    // We expand the rendering area to ensure corners are covered
    const maxDimension = Math.max(width, height);
    for (let x = -maxDimension * 1.5; x < maxDimension * 2.5; x += stepX) {
      for (let y = -maxDimension * 1.5; y < maxDimension * 2.5; y += stepY) {
        ctx.fillText(watermarkText, x, y);
      }
    }

    ctx.restore();
  }, [width, height, user]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: 'none', // Never intercept clicks/touches
        zIndex: 10,
        visibility: user ? 'visible' : 'hidden',
      }}
      aria-hidden="true"
    />
  );
}

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
    if (!canvas || !user) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays for crisp text
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // Mask email: j***@gmail.com
    const emailParts = user.email.split('@');
    const maskedEmail = emailParts[0].charAt(0) + '***@' + emailParts[1];
    
    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const watermarkText = `${user.name} · ${maskedEmail} · ${dateStr}`;

    // Setup text style
    ctx.font = 'bold 24px "DM Sans", sans-serif';
    ctx.fillStyle = 'rgba(150, 150, 150, 0.15)'; // Very faint
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw watermark diagonally across the page repeatedly
    const stepX = 400;
    const stepY = 300;
    
    // Rotate canvas for diagonal text
    ctx.save();
    ctx.rotate((-30 * Math.PI) / 180); // -30 degrees

    // We need to draw outside the literal bounds because of rotation
    for (let x = -width; x < width * 2; x += stepX) {
      for (let y = -height; y < height * 2; y += stepY) {
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
        pointerEvents: 'none', // Crucial: lets clicks pass through to PDF if needed
        zIndex: 10,
      }}
      aria-hidden="true"
    />
  );
}

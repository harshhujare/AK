'use client';
import { useState, useEffect, useRef, useLayoutEffect } from 'react';

interface CountdownTimerProps {
  /** Total seconds for this test. null = untimed (no timer shown). */
  timeLimitSec: number | null;
  /** Unix timestamp (Date.now()) when the session started */
  startedAt: number | null;
  /** Called when the timer reaches zero — triggers auto-submit */
  onExpire: () => void;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function CountdownTimer({ timeLimitSec, startedAt, onExpire }: CountdownTimerProps) {
  const [secsLeft, setSecsLeft] = useState<number>(() => {
    if (!timeLimitSec || !startedAt) return 0;
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    return Math.max(0, timeLimitSec - elapsed);
  });

  const onExpireRef = useRef(onExpire);
  useLayoutEffect(() => { onExpireRef.current = onExpire; });

  useEffect(() => {
    if (!timeLimitSec || !startedAt) return;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, timeLimitSec - elapsed);
      setSecsLeft(remaining);
      if (remaining === 0) {
        onExpireRef.current();
      }
    };

    // Run immediately so display is accurate on mount
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timeLimitSec, startedAt]);

  // Untimed test
  if (!timeLimitSec) return null;

  const timerClass =
    secsLeft < 120 ? 'timer timer--danger' :
    secsLeft < 300 ? 'timer timer--warn' :
    'timer';

  return (
    <div className={`timer-pill ${timerClass === 'timer timer--danger' ? 'timer-pill--danger' : timerClass === 'timer timer--warn' ? 'timer-pill--warn' : ''}`}
      role="timer"
      aria-label={`${formatTime(secsLeft)} remaining`}
      aria-live="off" /* Don't announce every second — too noisy on screen readers */
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
      </svg>
      <span className={timerClass}>{formatTime(secsLeft)}</span>

      <style>{`
        .timer-pill {
          display: flex;
          align-items: center;
          gap: 5px;
          background: var(--bg-surface-2);
          border: 1px solid var(--border);
          border-radius: 99px;
          padding: 5px 10px;
          flex-shrink: 0;
          transition: border-color 0.3s;
        }
        .timer-pill--warn  { border-color: var(--warn-border); }
        .timer-pill--danger { border-color: var(--danger-border); }
        .timer {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.04em;
          font-variant-numeric: tabular-nums;
          color: var(--text-secondary);
          transition: color 0.3s;
        }
        .timer--warn   { color: var(--warn-text); }
        .timer--danger {
          color: var(--danger-text);
          animation: timer-pulse 1s ease-in-out infinite;
        }
        @keyframes timer-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

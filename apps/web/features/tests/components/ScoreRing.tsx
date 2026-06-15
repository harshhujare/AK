'use client';
import { useEffect, useRef } from 'react';

interface ScoreRingProps {
  score: number;
  totalMarks: number;
  /** Ring size in px — defaults to 100 */
  size?: number;
}

// SVG circle radius — circumference = 2π × r
const R   = 45;
const C   = 2 * Math.PI * R; // ≈ 282.74

function gradeInfo(pct: number): { label: string; emoji: string; ringColor: string } {
  if (pct >= 70) return { label: 'Great Work!',       emoji: '🎉', ringColor: '#86efac' }; // green
  if (pct >= 40) return { label: 'Good Effort!',      emoji: '👍', ringColor: '#fde68a' }; // amber
  return            { label: 'Keep Practising!',   emoji: '💪', ringColor: '#fca5a5' }; // red
}

export function ScoreRing({ score, totalMarks, size = 100 }: ScoreRingProps) {
  const pct   = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const grade = gradeInfo(pct);
  const circleRef = useRef<SVGCircleElement>(null);

  // Animate the ring fill on mount (CSS transition would fire before paint — useEffect is safe here)
  useEffect(() => {
    const offset = C - (pct / 100) * C;
    const el     = circleRef.current;
    if (!el) return;

    // Start at full offset (empty ring), then transition to actual value
    el.style.strokeDashoffset = String(C);
    el.style.transition = 'none';

    // Force a reflow so the browser registers the starting state
    void el.getBoundingClientRect();

    requestAnimationFrame(() => {
      el.style.transition = 'stroke-dashoffset 0.9s cubic-bezier(0.4, 0, 0.2, 1)';
      el.style.strokeDashoffset = String(offset);
    });
  }, [pct]);

  return (
    <div className="score-ring-wrap" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx="50" cy="50" r={R}
          fill="none"
          stroke="var(--bg-surface-2)"
          strokeWidth="8"
        />
        {/* Fill — animated */}
        <circle
          ref={circleRef}
          cx="50" cy="50" r={R}
          fill="none"
          stroke={grade.ringColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C} /* starts empty, JS animates to actual */
        />
      </svg>

      <div className="score-ring-label" aria-label={`Score: ${pct}%`}>
        <span className="score-ring-pct">{pct}%</span>
        <span className="score-ring-sub">{score} / {totalMarks}</span>
      </div>

      <style>{`
        .score-ring-wrap {
          position: relative;
          flex-shrink: 0;
        }
        .score-ring-label {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
        }
        .score-ring-pct {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--text-primary);
          line-height: 1;
        }
        .score-ring-sub {
          font-size: 9px;
          font-weight: 500;
          color: var(--text-muted);
          letter-spacing: 0.01em;
        }
      `}</style>
    </div>
  );
}

export { gradeInfo };

'use client';
import { useState } from 'react';
import type { AttemptBreakdownItem } from '@ajitsir/shared';

interface BreakdownItemProps {
  item: AttemptBreakdownItem;
  index: number;
}

export function BreakdownItem({ item, index }: BreakdownItemProps) {
  const [expanded, setExpanded] = useState(false);

  const isCorrect = item.isCorrect;
  const isSkipped = !item.selected;
  const numClass  = isCorrect ? 'bi-num--correct' : isSkipped ? 'bi-num--skip' : 'bi-num--wrong';

  const hasExplanation = !!item.explanation && (isSkipped || !isCorrect);

  return (
    <div className={`breakdown-item ${hasExplanation && !expanded ? 'breakdown-item--expandable' : ''}`}>
      <div
        className="bi-top"
        onClick={() => hasExplanation && setExpanded((v) => !v)}
        role={hasExplanation ? 'button' : undefined}
        aria-expanded={hasExplanation ? expanded : undefined}
        tabIndex={hasExplanation ? 0 : undefined}
        onKeyDown={hasExplanation ? (e) => e.key === 'Enter' && setExpanded((v) => !v) : undefined}
      >
        <span className={`bi-num ${numClass}`}>Q{index + 1}</span>
        <p className="bi-q marathi-text">{item.questionText}</p>
        {hasExplanation && (
          <span className="bi-expand-icon" aria-hidden="true">
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>

      <div className="bi-answer-row">
        {isSkipped ? (
          <span className="bi-chip bi-chip--skip">— Skipped</span>
        ) : (
          <span className={`bi-chip ${isCorrect ? 'bi-chip--correct' : 'bi-chip--wrong'}`}>
            {isCorrect ? '✓' : '✗'} Option {item.selected}
          </span>
        )}
        {!isCorrect && (
          <span className="bi-chip bi-chip--correct">
            ✓ Correct: Option {item.correct}
          </span>
        )}
      </div>

      {hasExplanation && expanded && (
        <div className="bi-explanation">
          <span className="bi-expl-label">EXPLANATION</span>
          <p className="bi-expl-text marathi-text">{item.explanation}</p>
        </div>
      )}

      <style>{`
        .breakdown-item {
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
        }
        .breakdown-item:last-child { border-bottom: none; }
        .bi-top {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 8px;
          cursor: default;
        }
        .breakdown-item--expandable .bi-top { cursor: pointer; }
        .bi-num {
          width: 26px;
          height: 26px;
          border-radius: 7px;
          font-size: 9px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
          border: 1px solid transparent;
        }
        .bi-num--correct { background: var(--success-bg); color: var(--success-text); border-color: var(--success-border); }
        .bi-num--wrong   { background: var(--danger-bg);  color: var(--danger-text);  border-color: var(--danger-border);  }
        .bi-num--skip    { background: var(--bg-surface-2); color: var(--text-muted); border-color: var(--border); }
        .bi-q {
          flex: 1;
          font-size: 13px;
          color: var(--text-primary);
          line-height: 1.5;
        }
        .bi-expand-icon {
          font-size: 8px;
          color: var(--text-muted);
          margin-top: 4px;
          flex-shrink: 0;
        }
        .bi-answer-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          padding-left: 36px;
        }
        .bi-chip {
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 6px;
          font-weight: 500;
          border: 1px solid transparent;
        }
        .bi-chip--correct { background: var(--success-bg); color: var(--success-text); border-color: var(--success-border); }
        .bi-chip--wrong   { background: var(--danger-bg);  color: var(--danger-text);  border-color: var(--danger-border); }
        .bi-chip--skip    { background: var(--bg-surface-2); color: var(--text-muted); border-color: var(--border); }
        .bi-explanation {
          margin-top: 8px;
          margin-left: 36px;
          background: var(--info-bg);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px 12px;
        }
        .bi-expl-label {
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          text-transform: uppercase;
          display: block;
          margin-bottom: 4px;
        }
        .bi-expl-text { font-size: 12px; color: var(--text-secondary); line-height: 1.6; }
      `}</style>
    </div>
  );
}

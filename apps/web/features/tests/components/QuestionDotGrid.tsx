'use client';

export type DotState = 'unanswered' | 'answered' | 'current' | 'correct' | 'wrong' | 'skipped';

interface QuestionDotGridProps {
  total: number;
  currentIndex: number;
  answers: Record<string, string>; // { questionId: 'A'|'B'|'C'|'D' }
  questionIds: string[];
  /** Optional — pass correct answers to show correct/wrong states (result review mode) */
  correctAnswers?: Record<string, string>;
  onDotClick: (index: number) => void;
}

function getDotState(
  idx: number,
  currentIndex: number,
  questionIds: string[],
  answers: Record<string, string>,
  correctAnswers?: Record<string, string>,
): DotState {
  const qId = questionIds[idx];
  if (idx === currentIndex) return 'current';
  if (correctAnswers) {
    const selected = answers[qId];
    if (!selected) return 'skipped';
    return selected === correctAnswers[qId] ? 'correct' : 'wrong';
  }
  return answers[qId] ? 'answered' : 'unanswered';
}

export function QuestionDotGrid({
  total,
  currentIndex,
  answers,
  questionIds,
  correctAnswers,
  onDotClick,
}: QuestionDotGridProps) {
  return (
    <div className="qdot-grid" role="navigation" aria-label="Question navigator">
      {Array.from({ length: total }, (_, i) => {
        const state = getDotState(i, currentIndex, questionIds, answers, correctAnswers);
        return (
          <button
            key={i}
            className={`qdot qdot--${state}`}
            onClick={() => onDotClick(i)}
            aria-label={`Question ${i + 1}${state !== 'unanswered' ? ` (${state})` : ''}`}
            aria-current={state === 'current' ? 'true' : undefined}
          >
            {i + 1}
          </button>
        );
      })}

      <style>{`
        .qdot-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
          padding: 12px;
          max-height: 148px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--border-strong) transparent;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border);
        }
        @media (min-width: 768px) {
          .qdot-grid {
            max-height: none;
            overflow-y: visible;
            grid-template-columns: repeat(6, 1fr);
          }
        }
        .qdot {
          width: 100%;
          aspect-ratio: 1;
          min-width: 0;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--bg-surface-2);
          color: var(--text-muted);
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.12s;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }
        .qdot:hover { border-color: var(--border-strong); }
        .qdot--current {
          background: var(--accent-bg);
          color: var(--accent-text);
          border-color: var(--accent-bg);
        }
        .qdot--answered {
          background: var(--success-bg);
          border-color: var(--success-border);
          color: var(--success-text);
        }
        .qdot--correct {
          background: var(--success-bg);
          border-color: var(--success-border);
          color: var(--success-text);
        }
        .qdot--wrong {
          background: var(--danger-bg);
          border-color: var(--danger-border);
          color: var(--danger-text);
        }
        .qdot--skipped {
          background: var(--bg-surface-2);
          border-color: var(--border);
          color: var(--text-muted);
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
}

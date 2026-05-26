'use client';

import { useSubjects } from '@/hooks/useSubjects';

interface SubjectFilterProps {
  selectedSubject: string | null;
  onSelect: (subjectId: string | null) => void;
}

export default function SubjectFilter({ selectedSubject, onSelect }: SubjectFilterProps) {
  const { data: subjects, isLoading } = useSubjects();

  if (isLoading) {
    return (
      <div className="subject-filter-skeleton">
        <div className="skeleton-chip" />
        <div className="skeleton-chip" />
        <div className="skeleton-chip" />
      </div>
    );
  }

  if (!subjects || subjects.length === 0) return null;

  return (
    <div className="subject-filter">
      <div className="subject-filter-scroll">
        <button
          className={`filter-chip ${selectedSubject === null ? 'active' : ''}`}
          onClick={() => onSelect(null)}
        >
          All Subjects
        </button>
        {subjects.map((sub) => (
          <button
            key={sub.id}
            className={`filter-chip ${selectedSubject === sub.id ? 'active' : ''}`}
            onClick={() => onSelect(sub.id)}
          >
            {sub.name}
          </button>
        ))}
      </div>

      <style>{`
        .subject-filter {
          margin-bottom: 2rem;
          width: 100%;
        }
        .subject-filter-scroll {
          display: flex;
          gap: 0.75rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
          scrollbar-width: none; /* Firefox */
        }
        .subject-filter-scroll::-webkit-scrollbar {
          display: none; /* Chrome */
        }
        .filter-chip {
          padding: 0.5rem 1.25rem;
          border-radius: 9999px;
          border: 1px solid var(--border);
          background: var(--bg-surface-2);
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 500;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s;
        }
        .filter-chip:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-strong);
        }
        .filter-chip.active {
          background: var(--accent-bg);
          color: var(--accent-text);
          border-color: var(--accent-bg);
        }
        .subject-filter-skeleton {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 2rem;
        }
        .skeleton-chip {
          width: 100px;
          height: 36px;
          border-radius: 9999px;
          background: var(--skeleton-bg);
          animation: pulse 1.5s infinite ease-in-out;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

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
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.02);
          color: rgba(255,255,255,0.6);
          font-size: 0.85rem;
          font-weight: 500;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s;
        }
        .filter-chip:hover {
          background: rgba(255,255,255,0.05);
          color: white;
        }
        .filter-chip.active {
          background: white;
          color: black;
          border-color: white;
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
          background: rgba(255,255,255,0.05);
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

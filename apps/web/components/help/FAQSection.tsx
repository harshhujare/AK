'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
}

interface FAQSectionProps {
  faqs: FAQ[];
}

export default function FAQSection({ faqs }: FAQSectionProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const categories = Array.from(new Set(faqs.map(f => f.category)));

  return (
    <>
      <div className="faq-wrapper">
        {categories.map((category) => (
          <div key={category} className="faq-category">
            <h3 className="faq-category-title">{category}</h3>
            <div className="faq-list">
              {faqs.filter(f => f.category === category).map((faq) => (
                <div key={faq.id} className={`faq-item ${openId === faq.id ? 'faq-item--open' : ''}`}>
                  <button
                    className="faq-question"
                    onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                  >
                    <span>{faq.question}</span>
                    {openId === faq.id
                      ? <ChevronUp className="faq-icon" />
                      : <ChevronDown className="faq-icon" />
                    }
                  </button>
                  {openId === faq.id && (
                    <div className="faq-answer">{faq.answer}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {faqs.length === 0 && (
          <div className="faq-empty">No FAQs available yet.</div>
        )}
      </div>

      <style>{`
        .faq-wrapper { display: flex; flex-direction: column; gap: 2rem; }

        .faq-category-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--border);
          margin-bottom: 0.75rem;
        }

        .faq-list { display: flex; flex-direction: column; gap: 0.5rem; }

        .faq-item {
          background: var(--bg-surface-2);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .faq-item--open { border-color: var(--border-strong); }

        .faq-question {
          width: 100%;
          padding: 1rem 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          color: var(--text-primary);
          font-size: 0.95rem;
          font-weight: 500;
          font-family: inherit;
        }
        .faq-question:hover { background: var(--bg-hover); }

        .faq-icon { width: 18px; height: 18px; flex-shrink: 0; color: var(--text-secondary); }

        .faq-answer {
          padding: 0 1.25rem 1.25rem;
          color: var(--text-secondary);
          line-height: 1.7;
          font-size: 0.9rem;
          border-top: 1px solid var(--border);
          padding-top: 1rem;
        }

        .faq-empty {
          text-align: center;
          padding: 2.5rem;
          color: var(--text-secondary);
          background: var(--bg-surface-2);
          border: 1px solid var(--border);
          border-radius: 12px;
        }
      `}</style>
    </>
  );
}

import React from 'react';

export interface PlanData {
  duration: 30 | 180 | 365;
  label: string;
  price: string;
  period: string;
  badge?: string;
}

interface PlanCardProps {
  plan: PlanData;
  isLoading: boolean;
  disabled: boolean;
  onSelect: (duration: 30 | 180 | 365) => void;
  statusText?: string;
}

export default function PlanCard({ plan, isLoading, disabled, onSelect, statusText }: PlanCardProps) {
  return (
    <div className="plan-card">
      <div className="plan-header">
        <h3 className="plan-title">{plan.label} Plan</h3>
        {plan.badge && <span className="plan-badge">{plan.badge}</span>}
      </div>
      
      <div className="plan-price-wrapper">
        <span className="plan-price">{plan.price}</span>
        <span className="plan-period">/ {plan.period}</span>
      </div>

      <p className="plan-desc">
        Get unlimited access to all premium TET study notes, chapter-wise PDFs, and exclusive content curated by Ajit Sir for {plan.period}.
      </p>

      <ul className="plan-features">
        <li>
          <CheckIcon />
          <span>Access to all premium notes</span>
        </li>
        <li>
          <CheckIcon />
          <span>High-quality PDF downloads</span>
        </li>
        <li>
          <CheckIcon />
          <span>Bilingual explanations (Marathi & English)</span>
        </li>
        <li>
          <CheckIcon />
          <span>Valid for {plan.period}</span>
        </li>
      </ul>

      <button
        className="plan-button"
        onClick={() => onSelect(plan.duration)}
        disabled={disabled || isLoading}
      >
        {statusText || (isLoading ? 'Processing...' : 'Get Access Now')}
      </button>

      <style>{`
        .plan-card {
          background: var(--bg-surface-2, #ffffff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 20px;
          padding: 2.5rem 2rem;
          max-width: 420px;
          margin: 0 auto;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          display: flex;
          flex-direction: column;
        }
        
        .plan-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 50px rgba(0, 0, 0, 0.12);
          border-color: var(--accent, #2563eb);
        }

        .plan-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .plan-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary, #111827);
          margin: 0;
        }

        .plan-badge {
          background: #dbeafe;
          color: #1e40af;
          padding: 0.35rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .plan-price-wrapper {
          display: flex;
          align-items: baseline;
          margin-bottom: 1.5rem;
          color: var(--text-primary, #111827);
        }

        .plan-price {
          font-size: 3rem;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.02em;
        }

        .plan-period {
          font-size: 1rem;
          color: var(--text-secondary, #6b7280);
          margin-left: 0.5rem;
          font-weight: 500;
        }

        .plan-desc {
          color: var(--text-secondary, #4b5563);
          line-height: 1.6;
          margin-bottom: 2rem;
          font-size: 1.05rem;
        }

        .plan-features {
          list-style: none;
          padding: 0;
          margin: 0 0 2.5rem 0;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .plan-features li {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          color: var(--text-primary, #374151);
          font-size: 1rem;
          line-height: 1.5;
        }

        .plan-button {
          margin-top: auto;
          width: 100%;
          padding: 1rem;
          border-radius: 12px;
          background: var(--accent, #2563eb);
          color: white;
          font-size: 1.1rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: background 0.2s, opacity 0.2s;
        }

        .plan-button:hover:not(:disabled) {
          background: #1d4ed8; /* darken accent */
        }

        .plan-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }}
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}

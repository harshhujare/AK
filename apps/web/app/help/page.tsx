'use client';

// useSearchParams() requires opting out of static generation
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { HelpCircle, Ticket, ArrowLeft, Inbox, Plus } from 'lucide-react';
import FAQSection from '@/components/help/FAQSection';
import ContactForm from '@/components/help/ContactForm';
import TicketCard from '@/components/help/TicketCard';
import useAuthStore from '@/lib/auth-store';
import apiClient from '@/lib/api-client';

type Tab = 'help' | 'tickets';

interface FAQ {
  id: string; category: string; question: string; answer: string;
}

export default function HelpCenterPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isInitialized, initialize } = useAuthStore();

  const activeTab: Tab = searchParams.get('tab') === 'tickets' ? 'tickets' : 'help';

  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState('');

  // Init auth
  useEffect(() => {
    if (!isInitialized) initialize();
  }, [initialize, isInitialized]);

  // Fetch FAQs once
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/faqs`)
      .then(r => r.json())
      .then(j => setFaqs(j.data || []))
      .catch(() => {});
  }, []);

  // Fetch tickets when that tab is active and user is logged in
  const fetchTickets = useCallback(() => {
    if (!user) return;
    setTicketsLoading(true);
    setTicketsError('');
    apiClient.get('/api/support/mine')
      .then(res => setTickets(res.data.data))
      .catch(err => setTicketsError(err.response?.data?.error || 'Failed to load tickets'))
      .finally(() => setTicketsLoading(false));
  }, [user]);

  useEffect(() => {
    if (activeTab === 'tickets') fetchTickets();
  }, [activeTab, fetchTickets]);

  const setTab = (tab: Tab) => {
    const url = tab === 'tickets' ? '/help?tab=tickets' : '/help';
    router.push(url, { scroll: false });
  };

  return (
    <div className="help-page">

      {/* ── Hero ── */}
      <div className="help-hero">
        <div className="help-hero-icon">
          <HelpCircle size={30} />
        </div>
        <h1 className="help-hero-title font-serif">How can we help you?</h1>
        <p className="help-hero-subtitle">
          Browse FAQs, contact support, or track your existing requests — all in one place.
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="help-tabs-bar">
        <div className="help-tabs">
          <button
            className={`help-tab ${activeTab === 'help' ? 'help-tab--active' : ''}`}
            onClick={() => setTab('help')}
          >
            <HelpCircle size={16} />
            Help &amp; FAQs
          </button>

          {user && (
            <button
              className={`help-tab ${activeTab === 'tickets' ? 'help-tab--active' : ''}`}
              onClick={() => setTab('tickets')}
            >
              <Ticket size={16} />
              My Tickets
              {tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length > 0 && (
                <span className="help-tab-badge">
                  {tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="help-content">

        {/* TAB 1 — Help & FAQs */}
        {activeTab === 'help' && (
          <div className="help-layout">
            <div className="help-faq-col">
              <h2 className="help-section-title">Frequently Asked Questions</h2>
              <FAQSection faqs={faqs} />
            </div>

            <div className="help-contact-col">
              {user ? (
                <ContactForm onSuccess={() => setTab('tickets')} />
              ) : (
                <div className="help-login-prompt">
                  <HelpCircle size={28} className="help-login-icon" />
                  <h3 className="help-login-title">Need personal support?</h3>
                  <p className="help-login-desc">Log in to submit a support ticket and track your replies.</p>
                  <Link href="/login" className="help-login-btn">Log in to Contact Support</Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2 — My Tickets */}
        {activeTab === 'tickets' && (
          <div className="help-tickets">
            <div className="help-tickets-header">
              <div>
                <h2 className="help-section-title">My Support Tickets</h2>
                <p className="help-tickets-sub">View status and history of your requests.</p>
              </div>
              <button className="help-new-ticket-btn" onClick={() => setTab('help')}>
                <Plus size={15} />
                New Ticket
              </button>
            </div>

            {ticketsError && (
              <div className="help-tickets-error">{ticketsError}</div>
            )}

            {ticketsLoading ? (
              <div className="help-ticket-skeletons">
                {[1, 2, 3].map(i => <div key={i} className="help-ticket-skeleton" />)}
              </div>
            ) : tickets.length === 0 ? (
              <div className="help-tickets-empty">
                <div className="help-tickets-empty-icon"><Inbox size={30} /></div>
                <h3 className="help-tickets-empty-title">No tickets yet</h3>
                <p className="help-tickets-empty-sub">Submit a request from the Help &amp; FAQs tab.</p>
                <button className="help-new-ticket-btn" onClick={() => setTab('help')}>
                  Contact Support
                </button>
              </div>
            ) : (
              <div className="help-ticket-list">
                {tickets.map(ticket => (
                  <TicketCard key={ticket.id} ticket={ticket} />
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      <style>{`
        .help-page {
          min-height: 100vh;
          background: var(--bg-page);
          padding-top: 5.5rem;
          padding-bottom: 4rem;
        }

        /* ── Hero ── */
        .help-hero {
          text-align: center;
          max-width: 580px;
          margin: 0 auto 2.5rem;
          padding: 0 1.5rem;
        }

        .help-hero-icon {
          width: 60px; height: 60px;
          background: var(--accent-bg);
          color: var(--accent-text);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 1.25rem;
        }

        .help-hero-title {
          font-size: clamp(1.75rem, 3.5vw, 2.5rem);
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.75rem;
          line-height: 1.2;
        }

        .help-hero-subtitle {
          font-size: 1rem;
          color: var(--text-secondary);
          line-height: 1.65;
        }

        /* ── Tabs Bar ── */
        .help-tabs-bar {
          border-bottom: 1px solid var(--border);
          margin-bottom: 2.5rem;
          padding: 0 1.5rem;
        }

        .help-tabs {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          gap: 0;
        }

        .help-tab {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.75rem 1.25rem;
          font-size: 0.9rem;
          font-weight: 500;
          font-family: inherit;
          color: var(--text-secondary);
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
          position: relative;
        }

        .help-tab:hover { color: var(--text-primary); }

        .help-tab--active {
          color: var(--text-primary);
          border-bottom-color: var(--text-primary);
          font-weight: 600;
        }

        .help-tab-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          background: var(--accent-bg);
          color: var(--accent-text);
          border-radius: 999px;
          font-size: 0.65rem;
          font-weight: 700;
        }

        /* ── Content ── */
        .help-content {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 1.5rem;
        }

        /* Tab 1: Two-column layout */
        .help-layout {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 3rem;
          align-items: start;
        }

        .help-faq-col { display: flex; flex-direction: column; gap: 1.5rem; }

        .help-section-title {
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.25rem;
        }

        .help-contact-col {
          position: sticky;
          top: 5.5rem;
        }

        /* Login prompt (for logged-out users) */
        .help-login-prompt {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 2rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .help-login-icon { color: var(--text-muted); }

        .help-login-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .help-login-desc {
          font-size: 0.875rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .help-login-btn {
          display: inline-block;
          background: var(--accent-bg);
          color: var(--accent-text);
          padding: 0.65rem 1.5rem;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 600;
          text-decoration: none;
          margin-top: 0.5rem;
          transition: opacity 0.2s;
        }
        .help-login-btn:hover { opacity: 0.88; }

        /* Tab 2: Tickets */
        .help-tickets { display: flex; flex-direction: column; gap: 1.5rem; }

        .help-tickets-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .help-tickets-sub { font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem; }

        .help-new-ticket-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.55rem 1.1rem;
          background: var(--accent-bg);
          color: var(--accent-text);
          border: none;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: opacity 0.2s;
          text-decoration: none;
        }
        .help-new-ticket-btn:hover { opacity: 0.88; }

        .help-tickets-error {
          padding: 0.875rem 1rem;
          background: var(--danger-bg);
          color: var(--danger-text);
          border: 1px solid var(--danger-border);
          border-radius: 10px;
          font-size: 0.875rem;
        }

        .help-ticket-skeletons { display: flex; flex-direction: column; gap: 0.75rem; }
        .help-ticket-skeleton {
          height: 90px;
          background: var(--skeleton-bg);
          border-radius: 14px;
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

        .help-tickets-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 4rem 2rem;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          gap: 0.75rem;
        }

        .help-tickets-empty-icon {
          width: 60px; height: 60px;
          background: var(--bg-surface-2);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: var(--text-muted);
          margin-bottom: 0.25rem;
        }

        .help-tickets-empty-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .help-tickets-empty-sub {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .help-ticket-list { display: flex; flex-direction: column; gap: 0.75rem; }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .help-layout {
            grid-template-columns: 1fr;
            gap: 2rem;
          }
          .help-contact-col {
            position: static;
            order: -1;
          }
        }

        @media (max-width: 480px) {
          .help-tab { padding: 0.65rem 0.875rem; font-size: 0.82rem; }
        }
      `}</style>
    </div>
  );
}

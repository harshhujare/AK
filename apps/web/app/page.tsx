'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import useAuthStore from '@/lib/auth-store';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useNotes, type NoteWithSubject } from '@/hooks/useNotes';
import Slider from '@/components/ui/Slider';
import SubjectFilter from '@/components/notes/SubjectFilter';
import NoteCard from '@/components/notes/NoteCard';
import dynamic from 'next/dynamic';
import { useCheckout } from '@/features/payment/hooks/useCheckout';

const SecureViewer = dynamic(() => import('@/features/notes/viewer/SecureViewer'), {
  ssr: false,
});

export default function Home() {
  const { user, isInitialized } = useAuthStore();
  const { data: announcements, isLoading: loadingAnnouncements } = useAnnouncements();
  
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { data: notesResponse, isLoading: loadingNotes } = useNotes(selectedSubject, page, 20);
  
  const { state: checkoutState, checkout } = useCheckout();
  
  const [viewingNote, setViewingNote] = useState<NoteWithSubject | null>(null);

  // Hydration fix for localStorage (React Query offline mode / Zustand)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleSubjectSelect = (subjectId: string | null) => {
    setSelectedSubject(subjectId);
    setPage(1);
  };

  return (
    <div className="homepage">
      {/* ─── Hero Slider ──────────────────────────────────────────────────────── */}
      <section className="section-hero">
        <div className="hero-container">
          {(!mounted || loadingAnnouncements) ? (
            <div className="slider-skeleton" />
          ) : announcements && announcements.length > 0 ? (
            <Slider announcements={announcements} />
          ) : (
            <div className="hero-fallback">
              <h1 className="hero-title font-serif">Prepare for Maharashtra TET</h1>
              <p className="hero-subtitle">Access expert study notes and past question papers.</p>
              {!user && isInitialized && (
                <Link href="/login" className="btn-primary">
                  Login to Access Notes
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ─── Notes Section ────────────────────────────────────────────────────── */}
      <section id="notes" className="section-notes">
        <div className="notes-container">
          <div className="section-header">
            <h2 className="section-title font-serif">Study Notes</h2>
            <p className="section-desc">Download chapter-wise PDFs curated by Ajit Sir.</p>
          </div>

          <SubjectFilter 
            selectedSubject={selectedSubject} 
            onSelect={handleSubjectSelect} 
          />

          {loadingNotes ? (
            <div className="notes-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="note-skeleton" />
              ))}
            </div>
          ) : notesResponse && notesResponse.notes.length > 0 ? (
            <>
              <div className="notes-grid">
                {notesResponse.notes.map((note) => (
                  <NoteCard 
                    key={note.id} 
                    note={note} 
                    user={user} 
                    onClick={setViewingNote} 
                  />
                ))}
              </div>

              {notesResponse.totalPages > 1 && (
                <div className="pagination" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2.5rem' }}>
                  <button 
                    className="btn-secondary" 
                    disabled={page <= 1} 
                    onClick={() => setPage(p => p - 1)}
                  >
                    &larr; Previous
                  </button>
                  <span style={{ alignSelf: 'center', color: 'var(--text-muted)' }}>
                    Page {page} of {notesResponse.totalPages}
                  </span>
                  <button 
                    className="btn-secondary" 
                    disabled={page >= notesResponse.totalPages} 
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next &rarr;
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <p>No notes found for this subject.</p>
            </div>
          )}
        </div>
      </section>

      {/* ─── Testimonials Section ──────────────────────────────────────────────── */}
      <section id="testimonials" className="section-testimonials">
        <div className="testimonials-container">

          <div className="testimonials-header">
            <p className="testimonials-eyebrow">Student Stories</p>
            <h2 className="testimonials-title font-serif">What Our Students Say</h2>
            <p className="testimonials-subtitle">
              Thousands of Maharashtra TET aspirants have cleared their exam with Ajit Sir&apos;s guidance.
            </p>
          </div>

          <div className="testimonials-grid">
            {([
              {
                name: 'Priya Deshmukh',
                location: 'Pune, Maharashtra',
                initials: 'PD',
                color: '#6366f1',
                badge: 'TET Paper 1 Cleared ✓',
                text: 'Ajit Sir\'s notes are incredibly well-structured. The bilingual explanations in Marathi and English made it so much easier to understand concepts I\'d struggled with for years. Cleared TET Paper 1 on my very first attempt!',
              },
              {
                name: 'Rahul Patil',
                location: 'Nashik, Maharashtra',
                initials: 'RP',
                color: '#0ea5e9',
                badge: 'Score: 87/150',
                text: 'The premium notes are worth every rupee. Chapter-wise PDFs are concise and exam-focused. I wasted 2 years with random YouTube videos before finding this platform. Cleared TET with 87 marks last month.',
              },
              {
                name: 'Snehal Jadhav',
                location: 'Aurangabad, Maharashtra',
                initials: 'SJ',
                color: '#10b981',
                badge: 'TET Paper 2 Cleared ✓',
                text: 'As a working woman preparing alongside my job, I needed structured and to-the-point material. Ajit Sir\'s notes let me prepare in just 2–3 hours a day. The offline PDF feature is a lifesaver during commutes!',
              },
              {
                name: 'Akash Kulkarni',
                location: 'Kolhapur, Maharashtra',
                initials: 'AK',
                color: '#f59e0b',
                badge: 'Score improved: 62 → 93',
                text: 'I was skeptical at first but the quality blew me away. Every topic is covered with real exam examples. My score jumped from 62 to 93 in just 3 months of consistent study with these notes.',
              },
              {
                name: 'Pooja Shinde',
                location: 'Nagpur, Maharashtra',
                initials: 'PS',
                color: '#ec4899',
                badge: 'TET Paper 1 Cleared ✓',
                text: 'The platform is clean, fast, and the notes download instantly even on slow internet. Sir personally covers topics that frequently appear in exams. Highly recommend to every TET aspirant in Maharashtra.',
              },
              {
                name: 'Vijay Mane',
                location: 'Satara, Maharashtra',
                initials: 'VM',
                color: '#8b5cf6',
                badge: 'Cleared on 3rd attempt ✓',
                text: 'Failed TET twice before discovering AjitSir Academy. The systematic approach and subject-wise breakdown made all the difference. Third attempt — cleared with distinction. Sir\'s teaching style is truly unique.',
              },
            ] as const).map((t) => (
              <div key={t.name} className="testimonial-card">
                <div className="testimonial-stars" aria-label="5 out of 5 stars">
                  {[0,1,2,3,4].map((i) => (
                    <svg key={i} width="15" height="15" viewBox="0 0 24 24" fill="#f59e0b" aria-hidden="true">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ))}
                </div>
                <p className="testimonial-text">&ldquo;{t.text}&rdquo;</p>
                <span className="testimonial-badge">{t.badge}</span>
                <div className="testimonial-author">
                  <span className="testimonial-avatar" style={{ background: t.color }} aria-hidden="true">{t.initials}</span>
                  <div>
                    <p className="testimonial-name">{t.name}</p>
                    <p className="testimonial-location">{t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ─── About Section ────────────────────────────────────────────────────── */}
      <section id="about" className="section-about">
        <div className="about-container">

          {/* Left — text */}
          <div className="about-content">
            <p className="about-eyebrow">Meet Your Mentor</p>
            <h2 className="about-title font-serif">About Ajit Sir</h2>
            <p className="about-desc">
              With over <strong>10 years of dedicated teaching experience</strong>, Ajit Sir has guided
              thousands of aspirants to crack the Maharashtra Teacher Eligibility Test (TET).
              His clear explanations, structured study plans, and bilingual approach in Marathi &amp;
              English make even the toughest topics easy to master.
            </p>
            <p className="about-desc">
              From concept-building notes to full-length mock tests, every resource is crafted to
              give you the best possible chance at success.
            </p>

            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-num font-serif">10k+</span>
                <span className="stat-label">Students</span>
              </div>
              <div className="stat-item">
                <span className="stat-num font-serif">500+</span>
                <span className="stat-label">Study Notes</span>
              </div>
              <div className="stat-item">
                <span className="stat-num font-serif">98%</span>
                <span className="stat-label">Pass Rate</span>
              </div>
            </div>

            <div className="social-links">
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="social-btn youtube">
                YouTube Channel
              </a>
              <a href="https://wa.me" target="_blank" rel="noopener noreferrer" className="social-btn whatsapp">
                Join WhatsApp Group
              </a>
            </div>
          </div>

          {/* Right — photo */}
          <div className="about-image-wrap">
            <div className="about-image-card">
              <img
                src="/ajit_sir_img.png"
                alt="Ajit Sir — Founder of AjitSir Academy"
                className="about-photo"
              />
            </div>
          </div>

        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="footer">
        <div className="footer-inner">
          <p className="footer-copy">© {new Date().getFullYear()} AjitSir Academy. All rights reserved.</p>
          <div className="footer-links">
            <Link href="/help" className="footer-link">Help &amp; Support</Link>
            <Link href="/pricing" className="footer-link">Pricing</Link>
            <Link href="/terms" className="footer-link">Terms</Link>
            <Link href="/privacy" className="footer-link">Privacy</Link>
          </div>
        </div>
      </footer>

      {/* ─── Secure PDF Viewer Modal ──────────────────────────────────────────── */}
      {viewingNote && (
        <SecureViewer 
          note={viewingNote} 
          onClose={() => setViewingNote(null)} 
        />
      )}

      {/* ─── Styles ───────────────────────────────────────────────────────────── */}
      <style>{`
        .homepage {
          background: var(--bg-page);
          color: var(--text-primary);
          min-height: 100vh;
        }

        /* Hero */
        .section-hero {
          padding: 2rem 1.5rem;
          background: var(--bg-page);
        }
        .hero-container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .slider-skeleton {
          width: 100%;
          aspect-ratio: 16/7;
          background: var(--skeleton-bg);
          border-radius: 20px;
          animation: pulse 1.5s infinite ease-in-out;
        }
        .hero-fallback {
          text-align: center;
          padding: 6rem 2rem;
          background: var(--bg-surface-2);
          border-radius: 20px;
          border: 1px solid var(--border);
        }
        .hero-title {
          font-size: clamp(2rem, 5vw, 4rem);
          font-weight: 700;
          margin-bottom: 1rem;
        }
        .hero-subtitle {
          font-size: 1.1rem;
          color: var(--text-secondary);
          margin-bottom: 2rem;
        }
        .btn-primary {
          display: inline-block;
          background: var(--accent-bg);
          color: var(--accent-text);
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 500;
          text-decoration: none;
          transition: opacity 0.2s;
        }
        .btn-primary:hover {
          opacity: 0.9;
        }

        /* Notes */
        .section-notes {
          padding: 4rem 1.5rem;
          background: var(--bg-surface);
          border-top: 1px solid var(--border);
        }
        .notes-container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .section-header {
          margin-bottom: 2rem;
        }
        .section-title {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }
        .section-desc {
          color: var(--text-secondary);
          font-size: 1rem;
        }
        .notes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        .note-skeleton {
          height: 180px;
          background: var(--skeleton-bg);
          border-radius: 16px;
          animation: pulse 1.5s infinite ease-in-out;
        }
        .empty-state {
          text-align: center;
          padding: 4rem;
          background: var(--bg-surface-2);
          border-radius: 16px;
          color: var(--text-secondary);
        }

        /* About */
        .section-about {
          padding: 6rem 1.5rem;
          background: var(--bg-page);
          border-top: 1px solid var(--border);
        }
        .about-container {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 4rem;
          align-items: center;
        }
        /* Left column */
        .about-content {
          display: flex;
          flex-direction: column;
        }
        .about-eyebrow {
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 0.75rem;
        }
        .about-title {
          font-size: 2.5rem;
          margin-bottom: 1.25rem;
          color: var(--text-primary);
          line-height: 1.2;
        }
        .about-desc {
          font-size: 1.05rem;
          line-height: 1.75;
          color: var(--text-secondary);
          margin-bottom: 1.25rem;
        }
        .about-desc strong {
          color: var(--text-primary);
          font-weight: 600;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          margin: 1.75rem 0 2rem;
          padding: 1.75rem 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }
        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .stat-num {
          font-size: 2.25rem;
          font-weight: 700;
          color: var(--accent);
          line-height: 1;
        }
        .stat-label {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-secondary);
        }
        .social-links {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .social-btn {
          padding: 0.7rem 1.4rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.9rem;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .social-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        }
        .youtube {
          background: #ef4444;
          color: white;
        }
        .whatsapp {
          background: #22c55e;
          color: white;
        }
        /* Right column — image */
        .about-image-wrap {
          display: flex;
          justify-content: center;
          align-items: flex-end;
        }
        .about-image-card {
          position: relative;
          border-radius: 24px;
          overflow: hidden;
          background: var(--bg-card);
          border: 1px solid var(--border);
          box-shadow:
            0 20px 60px rgba(0,0,0,0.12),
            0 4px 16px rgba(0,0,0,0.08);
          width: 100%;
          max-width: 380px;
          transition: box-shadow 0.3s;
        }
        .about-image-card:hover {
          box-shadow:
            0 28px 72px rgba(0,0,0,0.18),
            0 6px 24px rgba(0,0,0,0.1);
        }
        .about-photo {
          display: block;
          width: 100%;
          height: auto;
          object-fit: cover;
          /* PNG has transparent bg — card bg shows through cleanly */
        }

        /* ── Testimonials ─────────────────────────────────────────────────────── */
        .section-testimonials {
          padding: 6rem 1.5rem;
          background: var(--bg-surface);
          border-top: 1px solid var(--border);
        }
        .testimonials-container {
          max-width: 1150px;
          margin: 0 auto;
        }
        .testimonials-header {
          text-align: center;
          max-width: 580px;
          margin: 0 auto 3.5rem;
        }
        .testimonials-eyebrow {
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 0.75rem;
        }
        .testimonials-title {
          font-size: clamp(1.8rem, 3.5vw, 2.5rem);
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.2;
          margin-bottom: 1rem;
        }
        .testimonials-subtitle {
          font-size: 1rem;
          color: var(--text-secondary);
          line-height: 1.65;
        }
        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }
        .testimonial-card {
          background: var(--bg-surface-2);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .testimonial-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 48px rgba(0,0,0,0.12);
        }
        .testimonial-stars {
          display: flex;
          gap: 2px;
        }
        .testimonial-text {
          font-size: 0.92rem;
          line-height: 1.7;
          color: var(--text-secondary);
          flex: 1;
        }
        .testimonial-badge {
          display: inline-block;
          padding: 0.3rem 0.75rem;
          background: var(--accent-bg);
          color: var(--accent-text);
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 600;
          align-self: flex-start;
        }
        .testimonial-author {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding-top: 0.5rem;
          border-top: 1px solid var(--border);
        }
        .testimonial-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
        }
        .testimonial-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .testimonial-location {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 0.1rem;
        }
        @media (max-width: 960px) {
          .testimonials-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 600px) {
          .section-testimonials {
            padding: 3.5rem 0;
          }
          .testimonials-header {
            margin-bottom: 2rem;
            padding: 0 1.25rem;
          }
          .testimonials-grid {
            /* Switch to horizontal scroll track */
            display: flex;
            flex-direction: row;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            gap: 1rem;
            padding: 0.5rem 1.25rem 1.25rem;
            /* Hide scrollbar but keep scroll */
            scrollbar-width: none;
          }
          .testimonials-grid::-webkit-scrollbar {
            display: none;
          }
          .testimonial-card {
            /* Each card is ~80vw so the next one peeks in */
            flex: 0 0 80vw;
            min-width: 0;
            scroll-snap-align: start;
          }
        }

        /* Footer */
        .footer {
          padding: 2rem 1.5rem;
          border-top: 1px solid var(--border);
        }
        .footer-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .footer-copy {
          color: var(--text-muted);
          font-size: 0.85rem;
        }
        .footer-links {
          display: flex;
          gap: 1.5rem;
          flex-wrap: wrap;
        }
        .footer-link {
          color: var(--text-muted);
          font-size: 0.8rem;
          text-decoration: none;
          transition: color 0.15s;
        }
        .footer-link:hover {
          color: var(--text-secondary);
        }

        @media (max-width: 480px) {
          .footer-inner { flex-direction: column; align-items: center; text-align: center; }
          .footer-links { justify-content: center; gap: 1rem; }
        }

        @media (max-width: 900px) {
          .about-container {
            grid-template-columns: 1fr;
            gap: 2.5rem;
          }
          .about-image-wrap {
            order: -1; /* image above text on mobile */
          }
          .about-image-card {
            max-width: 280px;
            margin: 0 auto;
          }
        }
        @media (max-width: 768px) {
          /* Notes section hidden on mobile — use the Notes tab instead */
          .section-notes {
            display: none;
          }
          .stats-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
          }
          .about-title {
            font-size: 2rem;
          }
        }
        @media (max-width: 480px) {
          .stats-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 0.5rem;
          }
          .stat-num {
            font-size: 1.5rem;
          }
          .stat-label {
            font-size: 0.65rem;
          }
          .social-links {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

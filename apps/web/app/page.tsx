'use client';

import { useState } from 'react';
import Link from 'next/link';
import useAuthStore from '@/lib/auth-store';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useNotes, type NoteWithSubject } from '@/hooks/useNotes';
import Slider from '@/components/ui/Slider';
import SubjectFilter from '@/components/notes/SubjectFilter';
import NoteCard from '@/components/notes/NoteCard';
import dynamic from 'next/dynamic';

const SecureViewer = dynamic(() => import('@/features/notes/viewer/SecureViewer'), {
  ssr: false,
});

export default function Home() {
  const { user, isInitialized } = useAuthStore();
  const { data: announcements, isLoading: loadingAnnouncements } = useAnnouncements();
  
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { data: notesResponse, isLoading: loadingNotes } = useNotes(selectedSubject, page, 20);
  
  const [viewingNote, setViewingNote] = useState<NoteWithSubject | null>(null);

  const handleSubjectSelect = (subjectId: string | null) => {
    setSelectedSubject(subjectId);
    setPage(1);
  };

  return (
    <div className="homepage">
      {/* ─── Hero Slider ──────────────────────────────────────────────────────── */}
      <section className="section-hero">
        <div className="hero-container">
          {loadingAnnouncements ? (
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
                    isAuthenticated={!!user} 
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
        <p>© {new Date().getFullYear()} AjitSir Academy. All rights reserved.</p>
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
          max-width: 1350px;
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
          background: linear-gradient(
            160deg,
            var(--bg-card) 0%,
            var(--bg-subtle, var(--bg-card)) 100%
          );
          border: 1px solid var(--border);
          box-shadow:
            0 20px 60px rgba(0,0,0,0.12),
            0 4px 16px rgba(0,0,0,0.08);
          width: 100%;
          max-width: 380px;
          /* subtle inner glow that adapts to dark/light */
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

        /* Footer */
        .footer {
          padding: 2rem;
          text-align: center;
          color: var(--text-muted);
          font-size: 0.85rem;
          border-top: 1px solid var(--border);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
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
            grid-template-columns: 1fr;
            gap: 1.25rem;
          }
          .social-links {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

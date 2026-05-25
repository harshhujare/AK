'use client';

import { useState } from 'react';
import Link from 'next/link';
import useAuthStore from '@/lib/auth-store';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useNotes, type NoteWithSubject } from '@/hooks/useNotes';
import Slider from '@/components/ui/Slider';
import SubjectFilter from '@/components/notes/SubjectFilter';
import NoteCard from '@/components/notes/NoteCard';
import SecureViewer from '@/components/notes/SecureViewer';

export default function Home() {
  const { user, isInitialized } = useAuthStore();
  const { data: announcements, isLoading: loadingAnnouncements } = useAnnouncements();
  
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const { data: notes, isLoading: loadingNotes } = useNotes(selectedSubject);
  
  const [viewingNote, setViewingNote] = useState<NoteWithSubject | null>(null);

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
            onSelect={setSelectedSubject} 
          />

          {loadingNotes ? (
            <div className="notes-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="note-skeleton" />
              ))}
            </div>
          ) : notes && notes.length > 0 ? (
            <div className="notes-grid">
              {notes.map((note) => (
                <NoteCard 
                  key={note.id} 
                  note={note} 
                  isAuthenticated={!!user} 
                  onClick={setViewingNote} 
                />
              ))}
            </div>
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
          <div className="about-content">
            <h2 className="about-title font-serif">About AjitSir Academy</h2>
            <p className="about-desc">
              AjitSir Academy is dedicated to helping aspirants crack the Maharashtra Teacher Eligibility Test (TET). 
              With over 10 years of teaching experience, Ajit Sir provides top-quality study materials, 
              mock tests, and video lectures in both Marathi and English.
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
          background: #0a0a0a;
          color: white;
          min-height: 100vh;
        }

        /* Hero */
        .section-hero {
          padding: 2rem 1.5rem;
          background: #0a0a0a;
        }
        .hero-container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .slider-skeleton {
          width: 100%;
          aspect-ratio: 21/9;
          background: rgba(255,255,255,0.05);
          border-radius: 20px;
          animation: pulse 1.5s infinite ease-in-out;
        }
        .hero-fallback {
          text-align: center;
          padding: 6rem 2rem;
          background: rgba(255,255,255,0.02);
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .hero-title {
          font-size: clamp(2rem, 5vw, 4rem);
          font-weight: 700;
          margin-bottom: 1rem;
        }
        .hero-subtitle {
          font-size: 1.1rem;
          color: rgba(255,255,255,0.6);
          margin-bottom: 2rem;
        }
        .btn-primary {
          display: inline-block;
          background: white;
          color: black;
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
          background: #0f0f0f;
          border-top: 1px solid rgba(255,255,255,0.05);
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
          color: rgba(255,255,255,0.5);
          font-size: 1rem;
        }
        .notes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        .note-skeleton {
          height: 180px;
          background: rgba(255,255,255,0.03);
          border-radius: 16px;
          animation: pulse 1.5s infinite ease-in-out;
        }
        .empty-state {
          text-align: center;
          padding: 4rem;
          background: rgba(255,255,255,0.02);
          border-radius: 16px;
          color: rgba(255,255,255,0.5);
        }

        /* About */
        .section-about {
          padding: 6rem 1.5rem;
          background: #0a0a0a;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .about-container {
          max-width: 800px;
          margin: 0 auto;
          text-align: center;
        }
        .about-title {
          font-size: 2.5rem;
          margin-bottom: 1.5rem;
        }
        .about-desc {
          font-size: 1.1rem;
          line-height: 1.6;
          color: rgba(255,255,255,0.7);
          margin-bottom: 3rem;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
          margin-bottom: 3rem;
          padding: 2rem 0;
          border-top: 1px solid rgba(255,255,255,0.1);
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .stat-num {
          font-size: 2.5rem;
          font-weight: 700;
          color: white;
        }
        .stat-label {
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255,255,255,0.5);
        }
        .social-links {
          display: flex;
          justify-content: center;
          gap: 1rem;
        }
        .social-btn {
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 500;
          text-decoration: none;
          transition: transform 0.2s;
        }
        .social-btn:hover {
          transform: translateY(-2px);
        }
        .youtube {
          background: #ef4444;
          color: white;
        }
        .whatsapp {
          background: #22c55e;
          color: white;
        }

        /* Footer */
        .footer {
          padding: 2rem;
          text-align: center;
          color: rgba(255,255,255,0.4);
          font-size: 0.85rem;
          border-top: 1px solid rgba(255,255,255,0.05);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }
          .social-links {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

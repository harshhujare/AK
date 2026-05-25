'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

function LoginContent() {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="login-page">
      {/* Background */}
      <div className="login-bg" aria-hidden="true">
        <div className="login-bg-grid" />
        <div className="login-bg-glow" />
      </div>

      {/* Card */}
      <main className="login-card">
        {/* Logo / Brand */}
        <div className="login-brand">
          <Link href="/" className="login-logo-link" aria-label="Back to homepage">
            <span className="login-logo-dot" />
            <span className="login-logo-text font-serif">AjitSir Academy</span>
          </Link>
        </div>

        <div className="login-header">
          <h1 className="login-title font-serif">Welcome back</h1>
          <p className="login-subtitle">
            Sign in to access your TET study notes and practice tests.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="login-error" role="alert" id="login-error-message">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v3M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}

        {/* Google Sign-In */}
        <div className="login-google-wrapper">
          <Suspense fallback={<div className="login-google-skeleton" />}>
            <GoogleSignInButton onError={setError} />
          </Suspense>
        </div>

        <div className="login-divider">
          <span>Only Google Sign-In is supported</span>
        </div>

        <p className="login-note">
          By signing in, you agree to our{' '}
          <Link href="/terms" className="login-link">Terms of Service</Link>{' '}
          and{' '}
          <Link href="/privacy" className="login-link">Privacy Policy</Link>.
        </p>

        <div className="login-back">
          <Link href="/" className="login-back-link">
            ← Back to homepage
          </Link>
        </div>
      </main>

      <style>{`
        .login-page {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          position: relative;
          background: #0a0a0a;
          overflow: hidden;
        }

        .login-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .login-bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        .login-bg-glow {
          position: absolute;
          top: -20%;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%);
          border-radius: 50%;
        }

        .login-card {
          position: relative;
          z-index: 1;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          padding: 2.5rem 2rem;
          width: 100%;
          max-width: 420px;
          backdrop-filter: blur(12px);
        }

        .login-brand {
          margin-bottom: 2rem;
        }

        .login-logo-link {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          text-decoration: none;
          color: white;
        }

        .login-logo-dot {
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
          display: block;
        }

        .login-logo-text {
          font-size: 1rem;
          font-weight: 500;
          letter-spacing: -0.01em;
          color: white;
        }

        .login-header {
          margin-bottom: 2rem;
        }

        .login-title {
          font-size: 2rem;
          font-weight: 700;
          color: white;
          margin-bottom: 0.5rem;
          line-height: 1.2;
          letter-spacing: -0.02em;
        }

        .login-subtitle {
          font-size: 0.9rem;
          color: rgba(255,255,255,0.5);
          line-height: 1.5;
        }

        .login-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 10px;
          color: #fca5a5;
          font-size: 0.85rem;
          margin-bottom: 1.25rem;
        }

        .login-google-wrapper {
          margin-bottom: 1.25rem;
        }

        .login-google-skeleton {
          height: 44px;
          background: rgba(255,255,255,0.06);
          border-radius: 8px;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .login-divider {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
          color: rgba(255,255,255,0.25);
          font-size: 0.75rem;
        }

        .login-divider::before,
        .login-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.1);
        }

        .login-note {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.3);
          text-align: center;
          line-height: 1.5;
          margin-bottom: 1.5rem;
        }

        .login-link {
          color: rgba(255,255,255,0.5);
          text-decoration: underline;
          text-underline-offset: 2px;
          transition: color 0.15s;
        }

        .login-link:hover {
          color: white;
        }

        .login-back {
          text-align: center;
        }

        .login-back-link {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.4);
          text-decoration: none;
          transition: color 0.15s;
        }

        .login-back-link:hover {
          color: rgba(255,255,255,0.8);
        }

        @media (max-width: 480px) {
          .login-card {
            padding: 2rem 1.5rem;
            border-radius: 16px;
          }
          .login-title {
            font-size: 1.75rem;
          }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

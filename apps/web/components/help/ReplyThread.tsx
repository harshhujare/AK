'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Loader2, User, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import apiClient from '@/lib/api-client';

interface Reply {
  id: string;
  message: string;
  isStaffReply: boolean;
  createdAt: string;
  author: { name: string; role?: string };
}

interface ReplyThreadProps {
  ticketId: string;
  replies: Reply[];
  status: string;
  isAdmin?: boolean;
}

export default function ReplyThread({ ticketId, replies, status, isAdmin = false }: ReplyThreadProps) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    setError('');
    try {
      const endpoint = isAdmin
        ? `/api/support/${ticketId}/reply`
        : `/api/support/mine/${ticketId}/reply`;
      await apiClient.post(endpoint, { message });
      setMessage('');
      router.refresh();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send reply');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="reply-thread">
        {/* Messages */}
        <div className="reply-list">
          {replies.length === 0 ? (
            <div className="reply-empty">No replies yet.</div>
          ) : (
            replies.map((reply) => {
              const alignRight = isAdmin ? reply.isStaffReply : !reply.isStaffReply;
              return (
                <div key={reply.id} className={`reply-bubble-wrap ${alignRight ? 'reply-bubble-wrap--right' : ''}`}>
                  <div className="reply-meta">
                    {reply.isStaffReply
                      ? <ShieldCheck className="reply-meta-icon reply-meta-icon--staff" />
                      : <User className="reply-meta-icon" />
                    }
                    <span className="reply-author">{reply.author.name}</span>
                    <span className="reply-time">{format(new Date(reply.createdAt), 'MMM d, h:mm a')}</span>
                  </div>
                  <div className={`reply-bubble ${alignRight ? 'reply-bubble--accent' : 'reply-bubble--neutral'}`}>
                    <p className="reply-text">{reply.message}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Reply Input */}
        {(status !== 'RESOLVED' || isAdmin) && (
          <form onSubmit={handleSubmit} className="reply-form">
            {error && <div className="reply-error">{error}</div>}
            <div className="reply-input-wrap">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your reply..."
                className="reply-input"
                required
              />
              <button
                type="submit"
                disabled={loading || !message.trim()}
                className="reply-send-btn"
              >
                {loading ? <Loader2 className="reply-send-icon spinning" /> : <Send className="reply-send-icon" />}
              </button>
            </div>
          </form>
        )}

        {status === 'RESOLVED' && !isAdmin && (
          <p className="reply-resolved-note">
            This ticket is resolved. Reply above to re-open it if you need further help.
          </p>
        )}
      </div>

      <style>{`
        .reply-thread { display: flex; flex-direction: column; gap: 1.5rem; }

        .reply-list { display: flex; flex-direction: column; gap: 1rem; }

        .reply-empty {
          text-align: center;
          padding: 2.5rem;
          color: var(--text-secondary);
          background: var(--bg-surface-2);
          border: 1px solid var(--border);
          border-radius: 12px;
          font-size: 0.9rem;
        }

        .reply-bubble-wrap { display: flex; flex-direction: column; max-width: 80%; gap: 0.3rem; }
        .reply-bubble-wrap--right { align-self: flex-end; align-items: flex-end; }

        .reply-meta {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0 0.25rem;
        }

        .reply-meta-icon { width: 13px; height: 13px; color: var(--text-muted); }
        .reply-meta-icon--staff { color: #3b82f6; }

        .reply-author { font-size: 0.8rem; font-weight: 500; color: var(--text-primary); }
        .reply-time { font-size: 0.75rem; color: var(--text-muted); }

        .reply-bubble {
          padding: 0.75rem 1rem;
          border-radius: 14px;
        }
        .reply-bubble--accent {
          background: var(--accent-bg);
          color: var(--accent-text);
          border-radius: 14px 14px 2px 14px;
        }
        .reply-bubble--neutral {
          background: var(--bg-surface-2);
          border: 1px solid var(--border);
          color: var(--text-primary);
          border-radius: 14px 14px 14px 2px;
        }

        .reply-text { font-size: 0.9rem; line-height: 1.6; white-space: pre-wrap; }

        .reply-form { display: flex; flex-direction: column; gap: 0.75rem; }

        .reply-error {
          padding: 0.75rem 1rem;
          background: var(--danger-bg);
          color: var(--danger-text);
          border: 1px solid var(--danger-border);
          border-radius: 10px;
          font-size: 0.85rem;
        }

        .reply-input-wrap {
          position: relative;
          display: flex;
          align-items: flex-end;
        }

        .reply-input {
          flex: 1;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 0.85rem 3.5rem 0.85rem 1rem;
          color: var(--text-primary);
          font-size: 0.9rem;
          font-family: inherit;
          outline: none;
          resize: none;
          min-height: 90px;
          transition: border-color 0.15s;
        }
        .reply-input:focus { border-color: var(--border-strong); }
        .reply-input::placeholder { color: var(--text-placeholder); }

        .reply-send-btn {
          position: absolute;
          right: 0.75rem;
          bottom: 0.75rem;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-bg);
          color: var(--accent-text);
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .reply-send-btn:hover:not(:disabled) { opacity: 0.85; }
        .reply-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .reply-send-icon { width: 16px; height: 16px; }

        .reply-resolved-note {
          text-align: center;
          font-size: 0.85rem;
          color: var(--text-muted);
          padding: 0.5rem;
        }

        .spinning { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

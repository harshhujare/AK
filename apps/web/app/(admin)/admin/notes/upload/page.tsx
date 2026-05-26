'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

interface Subject { id: string; name: string; }

export default function NoteUploadPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<Blob | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', subjectId: '', isPaid: false });
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Subject[] }>('/api/subjects');
      return data.data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('subjectId', form.subjectId);
      fd.append('isPaid', String(form.isPaid));
      if (thumbnail) {
        fd.append('thumbnail', thumbnail, 'thumbnail.jpg');
      }

      const { data } = await apiClient.post('/api/notes', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notes'] });
      qc.invalidateQueries({ queryKey: ['notes'] });
      router.push('/admin/notes');
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Upload failed');
      setUploadProgress(null);
    },
  });

  const handleFile = async (f: File) => {
    if (f.type !== 'application/pdf') { setError('Only PDF files are allowed'); return; }
    if (f.size > 50 * 1024 * 1024) { setError('File must be under 50 MB'); return; }
    setError(null);
    setFile(f);
    if (!form.title) setForm(prev => ({ ...prev, title: f.name.replace('.pdf', '') }));

    // Generate Thumbnail
    try {
      const arrayBuffer = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;
        canvas.toBlob((blob) => {
          if (blob) {
            setThumbnail(blob);
            setThumbnailPreview(URL.createObjectURL(blob));
          }
        }, 'image/jpeg', 0.8);
      }
    } catch (err) {
      console.error('Thumbnail generation failed:', err);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file) { setError('Please select a PDF file'); return; }
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.subjectId) { setError('Please select a subject'); return; }
    uploadMutation.mutate();
  };

  const isPending = uploadMutation.isPending;

  return (
    <div className="upload-page">
      <header className="admin-page-header">
        <div>
          <Link href="/admin/notes" className="back-link">← Back to Notes</Link>
          <h1 className="admin-page-title font-serif" style={{ marginTop: '0.5rem' }}>Upload Note</h1>
        </div>
      </header>

      <form className="upload-form" onSubmit={handleSubmit} id="note-upload-form">
        {error && <div className="form-error" role="alert">{error}</div>}

        {/* Drop zone */}
        <div
          className={`drop-zone ${dragOver ? 'drop-zone--over' : ''} ${file ? 'drop-zone--filled' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !file && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <input
            ref={fileInputRef} type="file" accept="application/pdf" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {file ? (
            <div className="drop-zone-filled">
              <span className="file-icon">📄</span>
              <div>
                <div className="file-name">{file.name}</div>
                <div className="file-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
              </div>
              {thumbnailPreview && (
                <img src={thumbnailPreview} alt="Preview" style={{ height: '60px', width: 'auto', borderRadius: '4px', marginLeft: 'auto', marginRight: '1rem', objectFit: 'cover' }} />
              )}
              <button
                type="button" className="remove-file-btn"
                onClick={e => { e.stopPropagation(); setFile(null); setUploadProgress(null); setThumbnail(null); setThumbnailPreview(null); }}
              >✕</button>
            </div>
          ) : (
            <div className="drop-zone-prompt">
              <span className="drop-icon">⬆</span>
              <p className="drop-text">Drop a PDF here or <span className="drop-link">browse</span></p>
              <p className="drop-hint">PDF only · Max 50 MB</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {uploadProgress !== null && (
          <div className="progress-bar-wrapper">
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
            <span className="progress-text">{uploadProgress}%</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="note-title">Title *</label>
          <input
            id="note-title" type="text" className="form-input"
            placeholder="e.g. Child Development — Chapter 4"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="note-desc">Description <span className="optional">(optional)</span></label>
          <textarea
            id="note-desc" className="form-textarea" rows={2}
            placeholder="Brief summary of the note content…"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="note-subject">Subject *</label>
            <select
              id="note-subject" className="form-select"
              value={form.subjectId}
              onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}
              required
            >
              <option value="">Select subject…</option>
              {subjects?.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Access</label>
            <label className="toggle-label">
              <input type="checkbox" className="toggle-input"
                checked={form.isPaid}
                onChange={e => setForm(f => ({ ...f, isPaid: e.target.checked }))}
              />
              <span className="toggle-track"><span className="toggle-thumb" /></span>
              <span className="toggle-text">{form.isPaid ? 'Paid only' : 'Free for all logged-in users'}</span>
            </label>
          </div>
        </div>

        <div className="form-submit-row">
          <Link href="/admin/notes" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? (uploadProgress !== null ? `Uploading ${uploadProgress}%…` : 'Uploading…') : '⬆ Upload to S3'}
          </button>
        </div>
      </form>

      <style>{`
        .upload-page { max-width: 640px; }
        .admin-page-header { margin-bottom: 2rem; }
        .admin-page-title { font-size: 2rem; font-weight: 700; color: var(--text-primary); }
        .back-link { font-size: 0.8rem; color: var(--text-muted); text-decoration: none; }
        .back-link:hover { color: var(--text-secondary); }

        .upload-form {
          background: var(--bg-surface-2); border: 1px solid var(--border);
          border-radius: 16px; padding: 2rem;
          display: flex; flex-direction: column; gap: 1.5rem;
        }

        .form-error {
          padding: 0.75rem 1rem; border-radius: 8px;
          background: var(--danger-bg); border: 1px solid var(--danger-border);
          color: var(--danger-text); font-size: 0.85rem;
        }

        .drop-zone {
          border: 2px dashed var(--border); border-radius: 12px;
          padding: 2rem; cursor: pointer; transition: all 0.2s;
          min-height: 120px; display: flex; align-items: center; justify-content: center;
        }
        .drop-zone:hover, .drop-zone--over {
          border-color: var(--border-strong); background: var(--bg-hover);
        }
        .drop-zone--filled { cursor: default; border-style: solid; border-color: var(--border); }

        .drop-zone-prompt { text-align: center; }
        .drop-icon { font-size: 2rem; display: block; margin-bottom: 0.75rem; opacity: 0.4; }
        .drop-text { font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.25rem; }
        .drop-link { color: var(--text-primary); text-decoration: underline; }
        .drop-hint { font-size: 0.75rem; color: var(--text-muted); }

        .drop-zone-filled {
          display: flex; align-items: center; gap: 1rem; width: 100%;
        }
        .file-icon { font-size: 2rem; flex-shrink: 0; }
        .file-name { font-size: 0.9rem; color: var(--text-primary); font-weight: 500; word-break: break-all; }
        .file-size { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem; }
        .remove-file-btn {
          margin-left: auto; background: var(--bg-surface-2); border: 1px solid var(--border);
          color: var(--text-muted); border-radius: 50%; width: 28px; height: 28px;
          cursor: pointer; font-size: 0.75rem; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .remove-file-btn:hover { background: var(--bg-hover); color: var(--danger-text); border-color: var(--danger-border); }

        .progress-bar-wrapper { display: flex; align-items: center; gap: 0.75rem; }
        .progress-bar-track {
          flex: 1; height: 6px; background: var(--bg-surface-2); border-radius: 3px; overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%; background: var(--accent-bg); border-radius: 3px; transition: width 0.3s;
        }
        .progress-text { font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; }

        .form-group { display: flex; flex-direction: column; gap: 0.5rem; flex: 1; }
        .form-label { font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
        .optional { font-weight: 400; text-transform: none; color: var(--text-muted); }

        .form-input, .form-textarea, .form-select {
          background: var(--input-bg); border: 1px solid var(--border);
          border-radius: 8px; padding: 0.65rem 0.875rem;
          color: var(--text-primary); font-size: 0.9rem; font-family: inherit; outline: none;
          transition: border-color 0.15s;
        }
        .form-input:focus, .form-textarea:focus, .form-select:focus { border-color: var(--border-strong); }
        .form-input::placeholder, .form-textarea::placeholder { color: var(--text-placeholder); }
        .form-textarea { resize: vertical; }
        .form-select option { background: var(--bg-surface); color: var(--text-primary); }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }

        .toggle-label { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; margin-top: 0.25rem; }
        .toggle-input { display: none; }
        .toggle-track {
          width: 40px; height: 22px; border-radius: 11px;
          background: var(--border); position: relative; transition: background 0.2s; flex-shrink: 0;
        }
        .toggle-input:checked + .toggle-track { background: var(--success-bg); }
        .toggle-thumb {
          position: absolute; top: 3px; left: 3px; width: 16px; height: 16px;
          border-radius: 50%; background: var(--success-text); transition: transform 0.2s;
        }
        .toggle-input:checked + .toggle-track .toggle-thumb { transform: translateX(18px); background: var(--success-text); }
        .toggle-text { font-size: 0.8rem; color: var(--text-secondary); }

        .form-submit-row { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem; }
        .btn-primary {
          padding: 0.65rem 1.5rem; background: var(--accent-bg); color: var(--accent-text); border: none; border-radius: 8px;
          font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: opacity 0.15s; text-decoration: none;
        }
        .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
        .btn-secondary {
          padding: 0.65rem 1.25rem; background: var(--bg-surface-2); color: var(--text-secondary);
          border: 1px solid var(--border); border-radius: 8px;
          font-size: 0.875rem; cursor: pointer; text-decoration: none;
        }

        @media (max-width: 600px) {
          .form-row { grid-template-columns: 1fr; }
          .upload-form { padding: 1.25rem; }
        }
      `}</style>
    </div>
  );
}

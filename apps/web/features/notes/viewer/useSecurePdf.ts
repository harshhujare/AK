import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { NoteWithSubject } from '@/hooks/useNotes';
import apiClient from '@/lib/api-client';
import useAuthStore from '@/lib/auth-store';
import { pdfCacheGet, pdfCacheSet } from '@/lib/pdf-cache';

export type FetchState =
  | { stage: 'downloading'; downloaded: number; total: number }
  | { stage: 'parsing' }
  | { stage: 'ready'; doc: pdfjsLib.PDFDocumentProxy; numPages: number }
  | { stage: 'error'; message: string };

export function useSecurePdf(note: NoteWithSubject, retryNonce: number) {
  const [fetchState, setFetchState] = useState<FetchState>({ stage: 'downloading', downloaded: 0, total: 0 });
  const [fromCache, setFromCache] = useState(false);
  
  const { user, accessToken, isInitialized, setAccessToken } = useAuthStore();

  useEffect(() => {
    let isMounted = true;
    let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;

    async function loadPdf() {
      if (!isInitialized) {
        setFetchState({ stage: 'downloading', downloaded: 0, total: 0 });
        return;
      }

      if (!user) {
        setFetchState({ stage: 'error', message: 'Please log in to view this document.' });
        return;
      }

      try {
        setFetchState({ stage: 'downloading', downloaded: 0, total: 0 });
        setFromCache(false);

        // 1. Check IndexedDB cache first
        const cachedData = await pdfCacheGet(note.id, note.updatedAt);
        if (cachedData) {
          if (!isMounted) return;
          setFetchState({ stage: 'parsing' });
          const doc = await pdfjsLib.getDocument({ data: cachedData }).promise;
          if (!isMounted) { doc.destroy(); return; }
          pdfDoc = doc;
          setFromCache(true);
          setFetchState({ stage: 'ready', doc, numPages: doc.numPages });
          return;
        }

        // 2. Cache miss — stream from server
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const fetchPdf = async (token: string | null) => {
          return fetch(`${apiUrl}/api/notes/${note.id}/stream`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            credentials: 'include',
          });
        };

        let token = accessToken;
        let response = await fetchPdf(token);

        if (response.status === 401 && typeof window !== 'undefined') {
          const { data } = await apiClient.post('/api/auth/refresh');
          const refreshedToken = data.data.accessToken as string;
          token = refreshedToken;
          setAccessToken(refreshedToken);
          response = await fetchPdf(refreshedToken);
        }

        if (!response.ok) {
          const msg =
            response.status === 401 ? 'Please log in to view this document.' :
            response.status === 403 ? 'You do not have access to this document.' :
            'Failed to load document. Please try again.';
          throw new Error(msg);
        }

        // Streaming download with progress
        const contentLength = Number(response.headers.get('Content-Length') || 0);
        const reader = response.body?.getReader();

        if (!reader) {
          // Fallback: no streaming support (older browsers)
          const buffer = await response.arrayBuffer();
          if (!isMounted) return;
          setFetchState({ stage: 'parsing' });
          const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
          if (!isMounted) { doc.destroy(); return; }
          pdfDoc = doc;
          setFetchState({ stage: 'ready', doc, numPages: doc.numPages });
          pdfCacheSet(note.id, new Uint8Array(buffer), note.updatedAt);
          return;
        }

        const chunks: Uint8Array[] = [];
        let downloaded = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!isMounted) { reader.cancel(); return; }
          chunks.push(value);
          downloaded += value.byteLength;
          setFetchState({ stage: 'downloading', downloaded, total: contentLength });
        }

        if (!isMounted) return;

        // Assemble all chunks into one buffer
        const totalBytes = chunks.reduce((sum, c) => sum + c.byteLength, 0);
        const merged = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.byteLength;
        }

        // 3. Save assembled bytes to cache
        pdfCacheSet(note.id, merged, note.updatedAt);

        setFetchState({ stage: 'parsing' });
        const doc = await pdfjsLib.getDocument({ data: merged }).promise;
        if (!isMounted) { doc.destroy(); return; }
        pdfDoc = doc;
        setFetchState({ stage: 'ready', doc, numPages: doc.numPages });
      } catch (err) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Failed to load document. Please try again.';
          setFetchState({ stage: 'error', message: msg });
        }
      }
    }

    loadPdf();

    return () => {
      isMounted = false;
      pdfDoc?.destroy();
    };
  }, [note.id, note.updatedAt, user, accessToken, isInitialized, setAccessToken, retryNonce]);

  return { fetchState, fromCache };
}

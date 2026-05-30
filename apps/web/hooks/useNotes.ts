import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';
import type { Note, Subject } from '@ajitsir/shared';

// The Notes returned by API include nested subject object
export type NoteWithSubject = Note & { subject: Subject };

export interface NotesResponse {
  notes: NoteWithSubject[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useNotes(subjectId?: string | null, page: number = 1, limit: number = 20, search: string = '') {
  return useQuery({
    queryKey: ['notes', subjectId, page, limit, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (subjectId) params.set('subjectId', subjectId);
      if (search) params.set('search', search);

      const { data } = await apiClient.get<{ data: NotesResponse }>(`/api/notes?${params.toString()}`);
      return data.data;
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';
import type { Note, Subject } from '@ajitsir/shared';

// The Notes returned by API include nested subject object
export type NoteWithSubject = Note & { subject: Subject };

export function useNotes(subjectId?: string | null) {
  return useQuery({
    queryKey: ['notes', subjectId],
    queryFn: async () => {
      const url = subjectId ? `/api/notes?subjectId=${subjectId}` : '/api/notes';
      const { data } = await apiClient.get<{ data: NoteWithSubject[] }>(url);
      return data.data;
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';
import type { Subject } from '@ajitsir/shared';

export function useSubjects() {
  return useQuery({
    queryKey: ['subjects'],
    // Subjects are admin-managed and rarely change — treat as static within a session
    staleTime: Infinity,
    // Serve from localStorage cache even when offline (PersistQueryClientProvider)
    networkMode: 'offlineFirst',
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Subject[] }>('/api/subjects');
      return data.data;
    },
  });
}

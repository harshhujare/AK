import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';
import type { Subject } from '@ajitsir/shared';

export function useSubjects() {
  return useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Subject[] }>('/api/subjects');
      return data.data;
    },
  });
}

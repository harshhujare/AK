import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';
import type { Announcement } from '@ajitsir/shared';

export function useAnnouncements() {
  return useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Announcement[] }>('/api/announcements');
      return data.data;
    },
  });
}

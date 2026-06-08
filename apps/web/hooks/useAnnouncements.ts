import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';
import type { Announcement } from '@ajitsir/shared';

export function useAnnouncements() {
  return useQuery({
    queryKey: ['announcements'],
    // Announcements change occasionally — re-validate every 5 minutes
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Announcement[] }>('/api/announcements');
      return data.data;
    },
  });
}

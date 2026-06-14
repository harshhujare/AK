import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';
import type { Announcement } from '@ajitsir/shared';

export function useAnnouncements() {
  return useQuery({
    queryKey: ['announcements'],
    // offlineFirst: serve cached announcements even when offline, consistent with
    // useNotes / useSubjects / useFaqs. Without this, React Query defaults to
    // 'online' mode and skips the query entirely when the network is unavailable,
    // showing a loading spinner even though the data exists in the persisted cache.
    networkMode: 'offlineFirst',
    // Announcements change occasionally — re-validate every 5 minutes
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Announcement[] }>('/api/announcements');
      return data.data;
    },
  });
}

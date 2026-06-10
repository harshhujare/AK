import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

export interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export function useFaqs() {
  return useQuery<FAQ[]>({
    queryKey: ['faqs'],
    // FAQs are admin-managed and rarely change — treat as static within 7 days
    staleTime: 7 * 24 * 60 * 60 * 1000,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: FAQ[] }>('/api/faqs');
      return data.data;
    },
  });
}

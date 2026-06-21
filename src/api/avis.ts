import { api } from './axios';
import type { Avis, AvisStats } from '@/types';

export const avisApi = {
  list: (note?: number) =>
    api.get<{ data: Avis[]; stats: AvisStats }>('/admin/avis', { params: note ? { note } : undefined }),
};

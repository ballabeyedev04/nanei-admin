import { api } from './axios';
import { nettoyerParams } from './pagination';
import type { Pagination, ParamsListe } from '@/types';

export interface MessageClient {
  id: string;
  email: string;
  objet: string;
  description: string;
  createdAt: string;
}

export const messagesApi = {
  /** `q` : e-mail, objet, message. */
  list:     (params?: ParamsListe)          =>
    api.get<{ success: boolean; data: MessageClient[]; pagination?: Pagination }>('/admin/messages', { params: nettoyerParams(params) }),
  stats:    ()                              => api.get<{ success: boolean; total: number }>('/admin/messages/stats'),
  repondre: (id: string, reponse: string)  => api.post(`/admin/messages/${id}/repondre`, { reponse }),
};

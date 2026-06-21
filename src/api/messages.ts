import { api } from './axios';

export interface MessageClient {
  id: string;
  email: string;
  objet: string;
  description: string;
  createdAt: string;
}

export const messagesApi = {
  list:     ()                              => api.get<{ success: boolean; data: MessageClient[] }>('/admin/messages'),
  stats:    ()                              => api.get<{ success: boolean; total: number }>('/admin/messages/stats'),
  repondre: (id: string, reponse: string)  => api.post(`/admin/messages/${id}/repondre`, { reponse }),
};

import { api } from './axios';

export const etiquettesApi = {
  telecharger: (colisId: string) =>
    api.get(`/admin/etiquettes/${colisId}`, { responseType: 'blob' }),
};

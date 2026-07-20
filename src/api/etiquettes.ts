import { api } from './axios';

export const etiquettesApi = {
  telecharger: (colisId: string) =>
    api.get(`/admin/etiquettes/${colisId}`, { responseType: 'blob' }),
  telechargerZPL: (colisId: string) =>
    api.get(`/admin/etiquettes/${colisId}`, { params: { format: 'zpl' }, responseType: 'blob' }),
};

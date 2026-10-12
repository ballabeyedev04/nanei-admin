import { api } from './axios';

export const etiquettesApi = {
  telecharger: (colisId: string) =>
    api.get(`/admin/etiquettes/${colisId}`, { responseType: 'blob', timeout: 60_000 }),
  telechargerZPL: (colisId: string) =>
    api.get(`/admin/etiquettes/${colisId}`, { params: { format: 'zpl' }, responseType: 'blob', timeout: 60_000 }),
};

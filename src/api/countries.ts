import { api } from './axios';
import type { Country, ShippingPrice, ServicePrice } from '@/types';

export const countriesApi = {
  list: () => api.get<{ data: Country[] }>('/admin/countries'),
  getById: (id: string) => api.get<{ data: Country }>(`/admin/countries/${id}`),
  create: (data: { name: string; code: string; isActive?: boolean }) =>
    api.post('/admin/countries', data),
  update: (id: string, data: Partial<Country>) =>
    api.put(`/admin/countries/${id}`, data),
  delete: (id: string) => api.delete(`/admin/countries/${id}`),
};

export const shippingPricesApi = {
  list: () => api.get<{ data: ShippingPrice[] }>('/admin/shipping-prices'),
  create: (data: Omit<ShippingPrice, 'id' | 'country'>) =>
    api.post('/admin/shipping-prices', data),
  update: (id: string, data: Partial<ShippingPrice>) =>
    api.put(`/admin/shipping-prices/${id}`, data),
  delete: (id: string) => api.delete(`/admin/shipping-prices/${id}`),
};

export interface ShippingRate {
  id: string;
  countryId: string;
  country?: { id: string; name: string; code: string };
  minWeightAerien: number; maxWeightAerien: number; priceAerienPerKg: number;
  minWeightMaritime: number; maxWeightMaritime: number; priceMaritimePerKg: number;
}

export const shippingRatesApi = {
  list:   ()                              => api.get<{ data: ShippingRate[] }>('/admin/shipping-rates'),
  create: (data: Omit<ShippingRate, 'id' | 'country'>) => api.post('/admin/shipping-rates', data),
  update: (id: string, data: Partial<ShippingRate>)     => api.put(`/admin/shipping-rates/${id}`, data),
  delete: (id: string)                    => api.delete(`/admin/shipping-rates/${id}`),
};

export const servicePricesApi = {
  list: () => api.get<{ data: ServicePrice[] }>('/admin/service-prices'),
  create: (data: Omit<ServicePrice, 'id' | 'country'>) =>
    api.post('/admin/service-prices', data),
  update: (id: string, data: Partial<ServicePrice>) =>
    api.put(`/admin/service-prices/${id}`, data),
  delete: (id: string) => api.delete(`/admin/service-prices/${id}`),
};

export interface ServiceRate {
  id: string;
  countryId: string;
  country?: { id: string; name: string; code: string };
  prixRecuperation: number;
  prixLivraison: number;
}

export const serviceRatesApi = {
  list:   ()                               => api.get<{ data: ServiceRate[] }>('/admin/service-rates'),
  create: (data: Omit<ServiceRate, 'id' | 'country'>) => api.post('/admin/service-rates', data),
  update: (id: string, data: Partial<ServiceRate>)     => api.put(`/admin/service-rates/${id}`, data),
  delete: (id: string)                     => api.delete(`/admin/service-rates/${id}`),
};

export interface TauxChange {
  id: string;
  devise_source: string;
  devise_cible: string;
  valeur: number;
  updatedAt?: string;
}

// Taux de conversion EUR -> FCFA — modifiable uniquement, jamais supprimable
// (pas de route DELETE côté back).
export const tauxChangeApi = {
  list:   ()                           => api.get<{ data: TauxChange[] }>('/admin/taux-change'),
  update: (id: string, valeur: number) => api.put(`/admin/taux-change/${id}`, { valeur }),
};

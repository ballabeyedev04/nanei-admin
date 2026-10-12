import { describe, it, expect, beforeEach } from 'vitest';
import { api } from './axios';
import { countriesApi, shippingPricesApi, shippingRatesApi, servicePricesApi, serviceRatesApi, tauxChangeApi } from './countries';
import { intercepter } from '@/test/axiosFactice';

/**
 * Contrat des clients « pays et tarifs » avec le back (routes/admin/country,
 * shippingPrice, shippingRate, servicePrice, serviceRate, tauxChange ;
 * services/*.service.js). Rend impossible : un champ renommé que le back
 * ignorerait (ex. `price` au lieu de `pricePerKg`, `taux` au lieu de
 * `valeur`), un chemin REST erroné, une pagination envoyée vide.
 */
describe('countriesApi', () => {
  let reseau: ReturnType<typeof intercepter>;
  beforeEach(() => {
    reseau = intercepter(api, () => ({ data: { data: [] } }));
  });

  it('list : GET /admin/countries, sans paramètre = liste complète (listes déroulantes)', async () => {
    await countriesApi.list();
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/countries', params: undefined });
    await countriesApi.list({ page: 2, limit: 20 });
    expect(reseau.dernier().params).toEqual({ page: 2, limit: 20 });
  });

  it('getById : GET /admin/countries/:id', async () => {
    await countriesApi.getById('p1');
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/countries/p1' });
  });

  it('create / update / delete : corps { name, code, isActive } (country.service.js)', async () => {
    await countriesApi.create({ name: 'Mali', code: 'ML', isActive: true });
    expect(reseau.dernier()).toMatchObject({ methode: 'POST', url: '/admin/countries', corps: { name: 'Mali', code: 'ML', isActive: true } });
    await countriesApi.update('p1', { isActive: false });
    expect(reseau.dernier()).toMatchObject({ methode: 'PUT', url: '/admin/countries/p1', corps: { isActive: false } });
    await countriesApi.delete('p1');
    expect(reseau.dernier()).toMatchObject({ methode: 'DELETE', url: '/admin/countries/p1' });
  });
});

describe('shippingPricesApi', () => {
  let reseau: ReturnType<typeof intercepter>;
  beforeEach(() => { reseau = intercepter(api, () => ({ data: { data: [] } })); });

  it('CRUD sur /admin/shipping-prices avec countryId, type, minWeight, maxWeight, pricePerKg', async () => {
    await shippingPricesApi.list({ page: 1, limit: 20 });
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/shipping-prices', params: { page: 1, limit: 20 } });
    const corps = { countryId: 'p1', type: 'aérien' as const, minWeight: 0, maxWeight: 10, pricePerKg: 8 };
    await shippingPricesApi.create(corps);
    expect(reseau.dernier()).toMatchObject({ methode: 'POST', url: '/admin/shipping-prices', corps });
    await shippingPricesApi.update('s1', { pricePerKg: 9 });
    expect(reseau.dernier()).toMatchObject({ methode: 'PUT', url: '/admin/shipping-prices/s1', corps: { pricePerKg: 9 } });
    await shippingPricesApi.delete('s1');
    expect(reseau.dernier()).toMatchObject({ methode: 'DELETE', url: '/admin/shipping-prices/s1' });
  });
});

describe('shippingRatesApi', () => {
  let reseau: ReturnType<typeof intercepter>;
  beforeEach(() => { reseau = intercepter(api, () => ({ data: { success: true, data: [] } })); });

  it('CRUD sur /admin/shipping-rates avec les champs aérien / maritime du back', async () => {
    await shippingRatesApi.list();
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/shipping-rates' });
    const corps = {
      countryId: 'p1',
      minWeightAerien: 0, maxWeightAerien: 30, priceAerienPerKg: 9,
      minWeightMaritime: 0, maxWeightMaritime: 500, priceMaritimePerKg: 3,
    };
    await shippingRatesApi.create(corps);
    expect(reseau.dernier()).toMatchObject({ methode: 'POST', url: '/admin/shipping-rates', corps });
    await shippingRatesApi.update('r1', { priceAerienPerKg: 10 });
    expect(reseau.dernier()).toMatchObject({ methode: 'PUT', url: '/admin/shipping-rates/r1', corps: { priceAerienPerKg: 10 } });
    await shippingRatesApi.delete('r1');
    expect(reseau.dernier()).toMatchObject({ methode: 'DELETE', url: '/admin/shipping-rates/r1' });
  });
});

describe('servicePricesApi', () => {
  let reseau: ReturnType<typeof intercepter>;
  beforeEach(() => { reseau = intercepter(api, () => ({ data: { data: [] } })); });

  it('CRUD sur /admin/service-prices avec serviceType, countryId, price', async () => {
    await servicePricesApi.list();
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/service-prices' });
    const corps = { serviceType: 'récupération' as const, countryId: 'p1', price: 5 };
    await servicePricesApi.create(corps);
    expect(reseau.dernier()).toMatchObject({ methode: 'POST', url: '/admin/service-prices', corps });
    await servicePricesApi.update('sp1', { price: 6 });
    expect(reseau.dernier()).toMatchObject({ methode: 'PUT', url: '/admin/service-prices/sp1', corps: { price: 6 } });
    await servicePricesApi.delete('sp1');
    expect(reseau.dernier()).toMatchObject({ methode: 'DELETE', url: '/admin/service-prices/sp1' });
  });
});

describe('serviceRatesApi', () => {
  let reseau: ReturnType<typeof intercepter>;
  beforeEach(() => { reseau = intercepter(api, () => ({ data: { data: [] } })); });

  it('CRUD sur /admin/service-rates avec prixRecuperation, prixLivraison', async () => {
    await serviceRatesApi.list({ page: 1 });
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/service-rates', params: { page: 1 } });
    await serviceRatesApi.create({ countryId: 'p1', prixRecuperation: 5, prixLivraison: 7 });
    expect(reseau.dernier()).toMatchObject({
      methode: 'POST', url: '/admin/service-rates', corps: { countryId: 'p1', prixRecuperation: 5, prixLivraison: 7 },
    });
    await serviceRatesApi.update('sr1', { prixLivraison: 8 });
    expect(reseau.dernier()).toMatchObject({ methode: 'PUT', url: '/admin/service-rates/sr1', corps: { prixLivraison: 8 } });
    await serviceRatesApi.delete('sr1');
    expect(reseau.dernier()).toMatchObject({ methode: 'DELETE', url: '/admin/service-rates/sr1' });
  });
});

describe('tauxChangeApi', () => {
  let reseau: ReturnType<typeof intercepter>;
  beforeEach(() => { reseau = intercepter(api, () => ({ data: { data: [] } })); });

  it('list : GET /admin/taux-change ; update : PUT /admin/taux-change/:id avec { valeur }', async () => {
    await tauxChangeApi.list();
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/taux-change' });
    await tauxChangeApi.update('t1', 655.957);
    expect(reseau.dernier()).toMatchObject({ methode: 'PUT', url: '/admin/taux-change/t1', corps: { valeur: 655.957 } });
  });

  it('aucune suppression possible : pas de route DELETE côté back', () => {
    expect('delete' in tauxChangeApi).toBe(false);
  });
});

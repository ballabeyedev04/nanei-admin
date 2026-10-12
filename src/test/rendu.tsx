import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

/**
 * Monte un écran comme dans l'application (React Query + routeur), avec un
 * client de requêtes NEUF à chaque test (aucun cache partagé) et sans
 * nouvel essai automatique (une erreur simulée s'affiche immédiatement).
 */
export function rendreEcran(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  const rendu = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...rendu, client };
}

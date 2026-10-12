import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/router';
import { ErrorBoundary } from '@/lib/errorBoundary';
import logger from '@/lib/logger';
import { APP_VERSION } from '@/config/version';
import 'sweetalert2/dist/sweetalert2.min.css';
import './index.css';

// Version servie, lisible dans le DOM (<html data-version="…">) : le test de
// démarrage de la chaîne de déploiement la vérifie dans un vrai navigateur.
document.documentElement.dataset.version = APP_VERSION;

logger.info('Admin Nanei démarré', {
  version: APP_VERSION,
  env: import.meta.env.MODE,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);

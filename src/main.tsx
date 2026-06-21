import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/router';
import { ErrorBoundary } from '@/lib/errorBoundary';
import logger from '@/lib/logger';
import 'sweetalert2/dist/sweetalert2.min.css';
import './index.css';

logger.info('Admin Nanei démarré', {
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
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

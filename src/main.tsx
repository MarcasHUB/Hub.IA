import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

// Tratamento global para erros de lazy loading de módulos (novo deploy durante uso)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Falha no lazy load do Vite, forçando reload da página para obter novos assets.', event);
  window.location.reload();
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60000, // 1 minuto
      gcTime: 300000,   // 5 minutos
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
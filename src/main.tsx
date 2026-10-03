import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import { PrivateSessionBoundary } from './modules/auth/presentation/context/PrivateSessionBoundary.tsx';
import './index.css';

// Tratamento global para erros de lazy loading de módulos (novo deploy durante uso)
const CHUNK_RELOAD_KEY = 'supplyhub_chunk_reload_attempted';

function shouldReloadForChunkError(message: string) {
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('ChunkLoadError') ||
    message.includes('Loading chunk') ||
    message.includes('dynamically imported module') ||
    message.includes('not a valid JavaScript MIME type') ||
    message.includes('MIME type for module script')
  );
}

const handleChunkError = async (message: string) => {
  if (!shouldReloadForChunkError(message)) return;

  const alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY);
  if (alreadyReloaded) return;

  sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true');
  console.warn('Versão antiga do App Campo detectada. Limpando cache e atualizando...');

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('supplyhub-pwa-'))
          .map((key) => caches.delete(key))
      );
    }

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.update()));
    }
  } catch (error) {
    console.warn('[SupplyHub PWA] Não foi possível limpar todo o cache:', error);
  }

  const url = new URL(window.location.href);
  url.searchParams.set('_appv', Date.now().toString());
  window.location.replace(url.toString());
};

window.addEventListener('error', (event) => {
  void handleChunkError(event.message || '');
});

window.addEventListener('unhandledrejection', (event) => {
  const message = String(event.reason?.message || event.reason || '');
  void handleChunkError(message);
});

// Limpa a flag se renderizou com sucesso
setTimeout(() => {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
}, 3000);

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
      <PrivateSessionBoundary>
        <App />
      </PrivateSessionBoundary>
    </QueryClientProvider>
  </React.StrictMode>,
);
console.log("Cache bust v2");

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => registration.update())
      .catch((error) => {
        console.warn('[SupplyHub PWA] Falha ao registrar service worker:', error);
      });
  });
}

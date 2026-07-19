import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

// Tratamento global para erros de lazy loading de módulos (novo deploy durante uso)
const CHUNK_RELOAD_KEY = 'supplyhub_chunk_reload_attempted';

function shouldReloadForChunkError(message: string) {
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('ChunkLoadError') ||
    message.includes('Loading chunk') ||
    message.includes('dynamically imported module')
  );
}

const handleChunkError = (message: string) => {
  if (shouldReloadForChunkError(message)) {
    const alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY);
    if (!alreadyReloaded) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true');
      console.warn('Falha no lazy load do Vite detectada. Forçando reload...');
      window.location.reload();
    }
  }
};

window.addEventListener('error', (event) => {
  handleChunkError(event.message || '');
});

window.addEventListener('unhandledrejection', (event) => {
  const message = String(event.reason?.message || event.reason || '');
  handleChunkError(message);
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
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
console.log("Cache bust v2");
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isMockMode } from '@/infrastructure/supabase/client';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'connection_request_received'
  | 'connection_request_accepted'
  | 'quotation_received'
  | 'quotation_responded'
  | 'quotation_rejected'
  | 'sla_overdue'
  | 'price_anomaly'
  | 'sourcing_suggestion';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  action_url?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addMockNotification: (n: Omit<Notification, 'id' | 'created_at'>) => void;
}

// ─── Mock data (usado enquanto Supabase Auth não está conectado) ──────────────

// Mocks de notificações removidos para transição de dados reais.

// ─── Context ──────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem('supplyhub_notifications');
    return saved ? JSON.parse(saved) : []; // Inicia vazio
  });
  const [isLoading, setIsLoading] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // TODO: quando Auth real estiver conectado, substituir por:
  //   const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
  //   setNotifications(data ?? []);
  // e configurar realtime subscription:
  //   supabase.channel('notifications').on('postgres_changes', ..., handleNewNotification).subscribe();

  const fetchNotifications = useCallback(async () => {
    // Em modo mock (sem Supabase real configurado), mantém os dados de demonstração
    if (isMockMode) {
      const saved = localStorage.getItem('supplyhub_notifications');
      if (saved) {
        setNotifications(JSON.parse(saved));
      }
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) {
        setNotifications(data as Notification[]);
      }
    } catch {
      // Fallback para mock em dev
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, is_read: true } : n));
      localStorage.setItem('supplyhub_notifications', JSON.stringify(updated));
      return updated;
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, is_read: true }));
      localStorage.setItem('supplyhub_notifications', JSON.stringify(updated));
      return updated;
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    }
  }, []);

  const addMockNotification = useCallback((n: Omit<Notification, 'id' | 'created_at'>) => {
    setNotifications((prev) => {
      const updated = [
        { ...n, id: Date.now().toString(), created_at: new Date().toISOString() },
        ...prev,
      ];
      localStorage.setItem('supplyhub_notifications', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, isLoading, markAsRead, markAllAsRead, addMockNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}

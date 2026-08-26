import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isMockMode } from '@/infrastructure/supabase/client';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  action_url?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  priority: string;
  organization_id?: string;
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => n.read_at === null).length;

  const fetchNotifications = useCallback(async (uid: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) {
        setNotifications(data as Notification[]);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    async function init() {
      if (isMockMode) {
        setIsLoading(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }
      setUserId(user.id);
      await fetchNotifications(user.id);

      channel = supabase
        .channel(`notifications_${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
          setNotifications(prev => {
            // Dedupe locally if needed
            if (prev.some(n => n.id === payload.new.id)) return prev;
            return [payload.new as Notification, ...prev];
          });
        })
        .subscribe();
    }
    
    init();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    if (userId) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    }
  }, [userId]);

  const markAllAsRead = useCallback(async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at === null ? { ...n, read_at: now } : n)));
    if (userId) {
      await supabase.from('notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null);
    }
  }, [userId]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, isLoading, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
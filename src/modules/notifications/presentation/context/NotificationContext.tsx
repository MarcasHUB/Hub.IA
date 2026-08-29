import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/infrastructure/supabase/client';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  archived_at?: string | null;
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
  clearNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { data: identity } = useAuthenticatedIdentity();
  const userId = identity?.userId || null;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const unreadCount = useMemo(() => notifications.filter(notification => notification.read_at === null).length, [notifications]);

  const fetchNotifications = useCallback(async (uid: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) console.error('Notification inbox unavailable', error);
    else setNotifications((data ?? []) as Notification[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!userId) { setNotifications([]); setIsLoading(false); return; }
    void fetchNotifications(userId);
    const channel = supabase
      .channel(`notifications_${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => {
        const inserted = payload.new as Notification;
        setNotifications(previous => previous.some(item => item.id === inserted.id) ? previous : [inserted, ...previous]);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchNotifications, userId]);

  const markAsRead = useCallback(async (id: string) => {
    if (!userId) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from('notifications').update({ read_at: now }).eq('id', id).eq('user_id', userId);
    if (error) throw error;
    setNotifications(previous => previous.map(item => item.id === id ? { ...item, read_at: now } : item));
  }, [userId]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from('notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null).is('archived_at', null);
    if (error) throw error;
    setNotifications(previous => previous.map(item => item.read_at === null ? { ...item, read_at: now } : item));
  }, [userId]);

  const clearNotifications = useCallback(async () => {
    if (!userId) return;
    const { error } = await supabase.from('notifications').update({ archived_at: new Date().toISOString() }).eq('user_id', userId).is('archived_at', null);
    if (error) throw error;
    setNotifications([]);
  }, [userId]);

  return <NotificationContext.Provider value={{ notifications, unreadCount, isLoading, markAsRead, markAllAsRead, clearNotifications }}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider');
  return context;
}

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Bell, CheckCheck, FileText, Handshake, MessageSquare, Trash2, UserCheck, Wifi, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Notification, useNotifications } from '../context/NotificationContext';
import { useChatDrawer } from '@/modules/messages/presentation/context/ChatDrawerContext';
import { getNotificationConversationId, isChatNotificationType } from '@/modules/messages/application/services/chatDeepLink';

function formatRelativeTime(isoDate: string): string {
  const minutes = Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000);
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

function iconFor(type: string) {
  const style = 'h-5 w-5 flex-shrink-0';
  if (isChatNotificationType(type)) return <MessageSquare className={`${style} text-indigo-500`} />;
  if (type.includes('connection_request')) return <Wifi className={`${style} text-blue-500`} />;
  if (type.includes('connection_accepted')) return <Handshake className={`${style} text-green-500`} />;
  if (type.includes('quotation')) return <FileText className={`${style} text-violet-500`} />;
  if (type.includes('approval')) return <UserCheck className={`${style} text-amber-500`} />;
  return <Bell className={`${style} text-slate-400`} />;
}

function NotificationCard({ notification, close }: { notification: Notification; close: () => void }) {
  const { markAsRead } = useNotifications();
  const { openConversation } = useChatDrawer();
  const navigate = useNavigate();
  const activate = async () => {
    await markAsRead(notification.id);
    if (isChatNotificationType(notification.type)) {
      const conversationId = getNotificationConversationId(notification.metadata);
      if (conversationId && await openConversation(conversationId)) { close(); return; }
    }
    if (notification.action_url) navigate(notification.action_url);
    close();
  };
  return (
    <button onClick={() => void activate()} className={`flex w-full gap-3 rounded-lg border border-l-4 p-4 text-left transition hover:shadow-sm ${notification.read_at ? 'border-slate-200 bg-white' : 'border-l-indigo-500 bg-indigo-50/60'}`}>
      <div className="mt-0.5">{iconFor(notification.type)}</div>
      <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className={`text-sm font-semibold ${notification.read_at ? 'text-slate-500' : 'text-slate-900'}`}>{notification.title}</p>{!notification.read_at && <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500" />}</div><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{notification.body}</p><div className="mt-2 flex items-center gap-3"><span className="text-[10px] font-medium text-slate-400">{formatRelativeTime(notification.created_at)}</span>{notification.action_url && <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600">Ver detalhes <ArrowRight className="h-3 w-3" /></span>}</div></div>
    </button>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, markAllAsRead, clearNotifications, isLoading } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node) && buttonRef.current && !buttonRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [isOpen]);

  const unread = notifications.filter(notification => !notification.read_at);
  const read = notifications.filter(notification => notification.read_at);
  const run = async (action: () => Promise<void>) => {
    setError('');
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível atualizar as notificações.'); }
  };

  return (
    <div className="relative">
      <button ref={buttonRef} id="notification-bell-btn" onClick={() => setIsOpen(open => !open)} className="relative rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-100" aria-label="Notificações"><Bell className="h-5 w-5" />{unreadCount > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}</button>
      {isOpen && <div ref={panelRef} id="notification-center-panel" className="absolute right-0 top-12 z-[9999] flex max-h-[560px] w-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4"><div><h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><Bell className="h-4 w-4 text-indigo-600" /> Central de Notificações</h3>{unreadCount > 0 && <p className="mt-0.5 text-xs text-slate-500">{unreadCount} não lida{unreadCount === 1 ? '' : 's'}</p>}</div><div className="flex items-center gap-1">{unreadCount > 0 && <button onClick={() => void run(markAllAsRead)} className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"><CheckCheck className="h-3.5 w-3.5" /> Marcar todas</button>}{notifications.length > 0 && <button onClick={() => { if (window.confirm('Limpar a caixa de entrada? O histórico será preservado.')) void run(clearNotifications); }} className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /> Limpar</button>}<button onClick={() => setIsOpen(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div></div>
        {error && <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
        <div className="flex-1 space-y-2 overflow-y-auto p-3">{isLoading ? <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" /></div> : notifications.length === 0 ? <div className="flex flex-col items-center py-16 text-slate-400"><Bell className="mb-3 h-12 w-12 text-slate-200" /><p className="text-sm font-medium">Tudo em dia!</p><p className="mt-1 text-xs">Nenhuma notificação no momento.</p></div> : <>{unread.length > 0 && <section className="space-y-2"><p className="px-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Novas</p>{unread.map(item => <NotificationCard key={item.id} notification={item} close={() => setIsOpen(false)} />)}</section>}{read.length > 0 && <section className="space-y-2 pt-2"><p className="px-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Anteriores</p>{read.map(item => <NotificationCard key={item.id} notification={item} close={() => setIsOpen(false)} />)}</section>}</>}</div>
        <div className="border-t bg-slate-50/80 px-4 py-3"><p className="text-center text-[10px] text-slate-400">Hub.IA · Notificações em tempo real</p></div>
      </div>}
    </div>
  );
}

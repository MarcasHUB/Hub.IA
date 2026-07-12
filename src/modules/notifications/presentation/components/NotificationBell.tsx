import { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCheck, ArrowRight, Wifi, TrendingDown, Lightbulb, Handshake, FileText, UserCheck } from 'lucide-react';
import { useNotifications, Notification, NotificationType } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

function getNotificationIcon(type: NotificationType) {
  const iconProps = { className: 'h-5 w-5 flex-shrink-0' };
  switch (type) {
    case 'connection_request_received': return <Wifi {...iconProps} className="h-5 w-5 flex-shrink-0 text-blue-500" />;
    case 'connection_request_accepted': return <Handshake {...iconProps} className="h-5 w-5 flex-shrink-0 text-green-500" />;
    case 'quotation_received':          return <FileText {...iconProps} className="h-5 w-5 flex-shrink-0 text-violet-500" />;
    case 'quotation_responded':         return <UserCheck {...iconProps} className="h-5 w-5 flex-shrink-0 text-indigo-500" />;
    case 'quotation_rejected':          return <X {...iconProps} className="h-5 w-5 flex-shrink-0 text-red-500" />;
    case 'sla_overdue':                 return <Bell {...iconProps} className="h-5 w-5 flex-shrink-0 text-orange-500" />;
    case 'price_anomaly':               return <TrendingDown {...iconProps} className="h-5 w-5 flex-shrink-0 text-yellow-500" />;
    case 'sourcing_suggestion':         return <Lightbulb {...iconProps} className="h-5 w-5 flex-shrink-0 text-teal-500" />;
    default:                            return <Bell {...iconProps} className="h-5 w-5 flex-shrink-0 text-slate-400" />;
  }
}

function getNotificationAccent(type: NotificationType): string {
  switch (type) {
    case 'connection_request_received': return 'border-l-blue-400 bg-blue-50/60';
    case 'connection_request_accepted': return 'border-l-green-400 bg-green-50/60';
    case 'quotation_received':          return 'border-l-violet-400 bg-violet-50/60';
    case 'quotation_responded':         return 'border-l-indigo-400 bg-indigo-50/60';
    case 'quotation_rejected':          return 'border-l-red-400 bg-red-50/60';
    case 'sla_overdue':                 return 'border-l-orange-400 bg-orange-50/60';
    case 'price_anomaly':               return 'border-l-yellow-400 bg-yellow-50/60';
    case 'sourcing_suggestion':         return 'border-l-teal-400 bg-teal-50/60';
    default:                            return 'border-l-slate-300 bg-slate-50/60';
  }
}

// ─── NotificationCard ─────────────────────────────────────────────────────────

function NotificationCard({ notification, onAction }: { notification: Notification; onAction: () => void }) {
  const { markAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleClick = async () => {
    await markAsRead(notification.id);
    if (notification.action_url) {
      navigate(notification.action_url);
    }
    onAction();
  };

  return (
    <div
      className={`
        relative flex gap-3 p-4 rounded-lg border border-l-4 cursor-pointer
        transition-all duration-150 hover:shadow-sm
        ${notification.is_read
          ? 'border-slate-200 bg-white/60'
          : `${getNotificationAccent(notification.type)} border-t border-r border-b border-t-slate-200 border-r-slate-200 border-b-slate-200`
        }
      `}
      onClick={handleClick}
    >
      {/* Ícone */}
      <div className="mt-0.5">
        {getNotificationIcon(notification.type)}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold leading-tight ${notification.is_read ? 'text-slate-500' : 'text-slate-900'}`}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0" />
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">
          {notification.message}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-[10px] text-slate-400 font-medium">
            {formatRelativeTime(notification.created_at)}
          </span>
          {notification.action_url && (
            <span className="text-[10px] font-semibold text-indigo-600 flex items-center gap-1 hover:text-indigo-800">
              Ver detalhes <ArrowRight className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── NotificationBell (componente principal) ──────────────────────────────────

export function NotificationBell() {
  const { notifications, unreadCount, markAllAsRead, isLoading } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const unread = notifications.filter((n) => !n.is_read);
  const read   = notifications.filter((n) =>  n.is_read);

  return (
    <div className="relative">
      {/* Botão Sino */}
      <button
        ref={buttonRef}
        id="notification-bell-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 h-4 w-4 min-w-[1rem] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Painel flutuante */}
      {isOpen && (
        <div
          ref={panelRef}
          id="notification-center-panel"
          className="absolute right-0 top-12 w-[400px] max-h-[560px] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl z-[9999] overflow-hidden"
          style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.14)' }}
        >
          {/* Header do painel */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Bell className="h-4 w-4 text-indigo-600" />
                Central de Notificações
              </h3>
              {unreadCount > 0 && (
                <p className="text-xs text-slate-500 mt-0.5">{unreadCount} não lida{unreadCount > 1 ? 's' : ''}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors px-2 py-1 rounded hover:bg-indigo-50"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Marcar todas
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Lista de notificações */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <div className="h-6 w-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Bell className="h-12 w-12 mb-3 text-slate-200" />
                <p className="text-sm font-medium">Tudo em dia!</p>
                <p className="text-xs mt-1">Nenhuma notificação no momento.</p>
              </div>
            ) : (
              <>
                {/* Não lidas */}
                {unread.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-1">Novas</p>
                    {unread.map((n) => (
                      <NotificationCard key={n.id} notification={n} onAction={() => setIsOpen(false)} />
                    ))}
                  </div>
                )}

                {/* Lidas */}
                {read.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-1">Anteriores</p>
                    {read.map((n) => (
                      <NotificationCard key={n.id} notification={n} onAction={() => setIsOpen(false)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-4 py-3 shrink-0 bg-slate-50/80">
            <p className="text-[10px] text-slate-400 text-center">
              IA Hub.IA · Notificações inteligentes em tempo real
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Search, MessageSquare, CheckCheck, Check,
  ShieldAlert, Paperclip, FileText, X, AlertTriangle,
  Clock
} from 'lucide-react';
import { checkCompliance } from '../../domain/compliance/ComplianceFilter';
import { Input } from '@/shared/components/ui/Input';
import { Button } from '@/shared/components/ui/Button';
import { cn } from '@/shared/utils/cn';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type MessageStatus = 'sent' | 'delivered' | 'read';

interface Message {
  id: string;
  conversationId: string;
  senderId: 'me' | string;
  text: string;
  timestamp: Date;
  status: MessageStatus;
  attachedQuotation?: { id: string; title: string };
  blockedByCompliance?: boolean;
  complianceReason?: string;
}

interface Conversation {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerSegment: string;
  partnerInitials: string;
  partnerGradient: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isOnline: boolean;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

// Mocks removidos para transição de dados reais.

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min`;
  if (diffH < 24) return `${diffH}h`;
  if (diffD === 1) return 'ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function StatusIcon({ status }: { status: MessageStatus }) {
  if (status === 'read') return <CheckCheck className="h-3.5 w-3.5 text-blue-400" />;
  if (status === 'delivered') return <CheckCheck className="h-3.5 w-3.5 text-slate-400" />;
  return <Check className="h-3.5 w-3.5 text-slate-400" />;
}

// ─── MessagesPage ─────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const navigate = useNavigate();

  // Carrega os parceiros do localStorage dinamicamente
  const initialConversations: Conversation[] = (() => {
    const savedPartners = localStorage.getItem('supplyhub_partners');
    const list = savedPartners ? JSON.parse(savedPartners) : [];
    return list.map((p: any) => ({
      id: `conv-${p.id}`,
      partnerId: p.id,
      partnerName: p.name,
      partnerSegment: p.segment,
      partnerInitials: p.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase(),
      partnerGradient: 'from-indigo-500 to-violet-600',
      lastMessage: 'Nenhuma mensagem trocada ainda.',
      lastMessageTime: new Date(p.since ? p.since.split('/').reverse().join('-') : Date.now()),
      unreadCount: 0,
      isOnline: true,
    }));
  })();

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const savedMsg = localStorage.getItem('supplyhub_chat_messages');
    const messagesMap = savedMsg ? JSON.parse(savedMsg) : {};
    
    return initialConversations.map(c => {
      const msgs = messagesMap[c.partnerId] || [];
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        return {
          ...c,
          lastMessage: lastMsg.text,
          lastMessageTime: new Date(lastMsg.timestamp)
        };
      }
      return c;
    });
  });

  const [messages, setMessages] = useState<Record<string, Message[]>>(() => {
    const saved = localStorage.getItem('supplyhub_chat_messages');
    const messagesMap = saved ? JSON.parse(saved) : {};
    
    const result: Record<string, Message[]> = {};
    initialConversations.forEach(c => {
      const msgs = messagesMap[c.partnerId] || [];
      result[c.id] = msgs.map((m: any) => ({
        id: m.id,
        conversationId: c.id,
        senderId: m.senderId,
        text: m.text,
        timestamp: new Date(m.timestamp),
        status: m.status
      }));
    });
    return result;
  });

  const [selectedConvId, setSelectedConvId] = useState<string>(() => {
    return initialConversations[0]?.id || '';
  });

  const [inputText, setInputText] = useState('');
  const [complianceError, setComplianceError] = useState<string | null>(null);
  const [searchConv, setSearchConv] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConv = conversations.find(c => c.id === selectedConvId);
  const currentMessages = selectedConv ? (messages[selectedConvId] ?? []) : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, selectedConvId]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !selectedConv) return;

    // ── Verificação de Compliance ──
    const compliance = checkCompliance(text);
    if (compliance.blocked) {
      setComplianceError(compliance.reason ?? 'Mensagem bloqueada por política de compliance.');
      return;
    }

    setComplianceError(null);

    const newMsg = {
      id: `m-${Date.now()}`,
      senderId: 'me',
      text,
      timestamp: new Date().toISOString(),
      status: 'sent' as const
    };

    // Salva no localStorage unificado
    const savedMsg = localStorage.getItem('supplyhub_chat_messages');
    const messagesMap = savedMsg ? JSON.parse(savedMsg) : {};
    const partnerId = selectedConv.partnerId;
    messagesMap[partnerId] = [...(messagesMap[partnerId] ?? []), newMsg];
    localStorage.setItem('supplyhub_chat_messages', JSON.stringify(messagesMap));

    // Atualiza estado de mensagens locales
    setMessages(prev => ({
      ...prev,
      [selectedConvId]: [...(prev[selectedConvId] ?? []), {
        id: newMsg.id,
        conversationId: selectedConvId,
        senderId: newMsg.senderId,
        text: newMsg.text,
        timestamp: new Date(newMsg.timestamp),
        status: newMsg.status
      }]
    }));

    // Atualiza última mensagem na conversa
    setConversations(prev => prev.map(c => c.id === selectedConvId ? {
      ...c,
      lastMessage: text,
      lastMessageTime: new Date()
    } : c));

    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredConvs = conversations.filter(c =>
    c.partnerName.toLowerCase().includes(searchConv.toLowerCase())
  );

  const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  return (
    <div className="flex h-[calc(100vh-112px)] bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">

      {/* ══════════════════════════════════════════════
          SIDEBAR — Lista de conversas
      ══════════════════════════════════════════════ */}
      <aside className="w-80 flex-shrink-0 border-r border-slate-200 flex flex-col">

        {/* Header da sidebar */}
        <div className="px-4 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              Mensagens
              {totalUnread > 0 && (
                <span className="h-5 min-w-5 px-1.5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">
                  {totalUnread}
                </span>
              )}
            </h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Buscar conversa..."
              className="pl-8 h-8 text-sm"
              value={searchConv}
              onChange={e => setSearchConv(e.target.value)}
            />
          </div>
        </div>

        {/* Lista de conversas */}
        <div className="flex-1 overflow-y-auto">
          {filteredConvs.map(conv => (
            <button
              key={conv.id}
              onClick={() => setSelectedConvId(conv.id)}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-50',
                selectedConvId === conv.id && 'bg-indigo-50 border-l-2 border-l-indigo-600'
              )}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${conv.partnerGradient} flex items-center justify-center text-white font-bold text-xs`}>
                  {conv.partnerInitials}
                </div>
                {conv.isOnline && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-white" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900 truncate">{conv.partnerName}</p>
                  <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">
                    {formatTime(conv.lastMessageTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-[12px] text-slate-500 truncate">{conv.lastMessage}</p>
                  {conv.unreadCount > 0 && (
                    <span className="ml-2 h-4 min-w-4 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════
          ÁREA DE CHAT
      ══════════════════════════════════════════════ */}
      {selectedConv ? (
        <main className="flex-1 flex flex-col min-w-0">

          {/* Header do chat */}
          <div className="h-16 border-b border-slate-200 px-5 flex items-center justify-between flex-shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${selectedConv.partnerGradient} flex items-center justify-center text-white font-bold text-xs`}>
                {selectedConv.partnerInitials}
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">{selectedConv.partnerName}</p>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  {selectedConv.isOnline
                    ? <><span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />Online agora</>
                    : <><Clock className="h-3 w-3" />Offline</>
                  }
                  · {selectedConv.partnerSegment}
                </p>
              </div>
            </div>

            {/* Botão de ação rápida */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/quotations/new')}
              className="text-indigo-600 border-indigo-300 hover:bg-indigo-50 text-xs"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Nova Cotação
            </Button>
          </div>

          {/* Aviso de compliance */}
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-amber-700">
              <strong>Política de Compliance:</strong> As mensagens são monitoradas. Não é permitido compartilhar dados bancários, contatos externos ou tentar desviar negociações para fora da plataforma.
            </p>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50/50">
            {currentMessages.map((msg, idx) => {
              const isMe = msg.senderId === 'me';
              const showDate = idx === 0 ||
                new Date(msg.timestamp).toDateString() !== new Date(currentMessages[idx - 1].timestamp).toDateString();

              return (
                <div key={msg.id} className="space-y-2">
                  {showDate && (
                    <div className="flex justify-center my-2">
                      <span className="text-[10px] bg-slate-200/60 text-slate-500 font-semibold px-2 py-0.5 rounded-full">
                        {new Date(msg.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  )}

                  <div className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-xs relative group flex flex-col gap-1",
                      isMe
                        ? "bg-indigo-600 text-white rounded-tr-none"
                        : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                    )}>
                      {msg.attachedQuotation && (
                        <div className={cn(
                          "flex items-center gap-2 mb-1.5 p-2 rounded-xl text-[10px] font-bold border",
                          isMe
                            ? "bg-indigo-700/50 border-indigo-500 text-white"
                            : "bg-indigo-50 border-indigo-200 text-indigo-700"
                        )}>
                          <FileText className="h-4 w-4" />
                          <div>
                            <p className="leading-none">{msg.attachedQuotation.title}</p>
                            <p className="text-[8px] opacity-70 mt-0.5">Clique para ver detalhes</p>
                          </div>
                        </div>
                      )}

                      <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      
                      <div className="flex items-center justify-end gap-1 mt-1 self-end opacity-70">
                        <span className="text-[9px]">
                          {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && <StatusIcon status={msg.status} />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Alerta de compliance */}
          {complianceError && (
            <div className="mx-4 mb-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-bold text-red-700">Mensagem bloqueada por política de compliance</p>
                <p className="text-xs text-red-600 mt-0.5">{complianceError}</p>
              </div>
              <button onClick={() => setComplianceError(null)} className="text-red-400 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Campo de envio */}
          <div className="px-4 pb-4 pt-2 border-t border-slate-200 bg-white flex-shrink-0">
            <div className="flex items-end gap-2">
              <button
                title="Anexar cotação"
                onClick={() => navigate('/quotations/new')}
                className="p-2 text-slate-400 hover:text-indigo-650 hover:bg-indigo-50 rounded-xl transition-colors flex-shrink-0"
              >
                <Paperclip className="h-5 w-5" />
              </button>

              <div className="flex-1 relative">
                <textarea
                  rows={1}
                  className="w-full resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50 max-h-32"
                  placeholder="Digite uma mensagem... (Enter para enviar)"
                  value={inputText}
                  onChange={e => {
                    setInputText(e.target.value);
                    if (complianceError) setComplianceError(null);
                  }}
                  onKeyDown={handleKeyDown}
                />
              </div>

              <button
                onClick={handleSend}
                disabled={!inputText.trim()}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl transition-colors flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

            {/* Lembrete de compliance no rodapé */}
            <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" />
              Mensagens monitoradas por compliance · Dados sensíveis são bloqueados automaticamente
            </p>
          </div>
        </main>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50">
          <MessageSquare className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-bold text-slate-700 text-sm">Selecione ou inicie uma conversa</p>
          <p className="text-xs text-slate-400 mt-1">Conecte-se com fornecedores na Rede de Empresas para poder trocar mensagens.</p>
          <Button 
            onClick={() => navigate('/suppliers/network')} 
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
          >
            Explorar Rede de Empresas
          </Button>
        </div>
      )}
    </div>
  );
}

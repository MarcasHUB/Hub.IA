import { useState, useRef, useEffect } from 'react';
import {
  Send, X, Paperclip, FileText, ShieldAlert,
  AlertTriangle, Maximize2, Check, CheckCheck,
  Bell, BellOff, MessageSquare
} from 'lucide-react';
import { useChatDrawer } from '../context/ChatDrawerContext';
import { useNotifications } from '@/modules/notifications/presentation/context/NotificationContext';
import { checkCompliance } from '../../domain/compliance/ComplianceFilter';
import { QuotationTypeModal } from '@/modules/quotations/presentation/components/QuotationTypeModal';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface Message {
  id: string;
  senderId: 'me' | string;
  text: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
  attachedQuotation?: { id: string; title: string };
}

interface Partner {
  id: string;
  name: string;
  segment: string;
  initials: string;
  gradient: string;
  isOnline: boolean;
  isConnected: boolean;
}

import { chatRepository, ChatConversation, ChatMessage } from '../../infrastructure/repositories/SupabaseChatRepository';
import { supabase } from '@/infrastructure/supabase/client';

// Carrega parceiros e mensagens do localStorage dinamicamente
const getPartnersMap = (): Record<string, Partner> => {
  const saved = localStorage.getItem('supplyhub_partners');
  const list = saved ? JSON.parse(saved) : [];
  const map: Record<string, Partner> = {};
  list.forEach((p: any) => {
    map[p.id] = {
      id: p.id,
      name: p.name,
      segment: p.segment,
      initials: p.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase(),
      gradient: 'from-indigo-500 to-violet-600',
      isOnline: true,
      isConnected: true
    };
  });
  return map;
};

export function ChatDrawer() {
  const { isChatOpen, activePartnerId, activePartnerData, activeConversationId, closeChat, openChat } = useChatDrawer();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [complianceError, setComplianceError] = useState<string | null>(null);
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [showPartnerSelector, setShowPartnerSelector] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const activeOrgId = localStorage.getItem('supplyhub_organization_id');
  const { addMockNotification } = useNotifications();

  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('hubia_chat_sound_enabled') !== 'false');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const notifiedMessageIdsRef = useRef<Set<string>>(new Set());
  const isChatOpenRef = useRef(isChatOpen);
  const soundEnabledRef = useRef(soundEnabled);
  
  useEffect(() => { isChatOpenRef.current = isChatOpen; }, [isChatOpen]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    notificationAudioRef.current = new Audio('/sounds/new-message.mp3');
    notificationAudioRef.current.preload = 'auto';
    notificationAudioRef.current.volume = 0.35;

    return () => {
      notificationAudioRef.current = null;
    };
  }, []);

  const toggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem('hubia_chat_sound_enabled', String(newValue));
  };

  const partnersMap = getPartnersMap();
  const partnersList = Object.values(partnersMap);
  let partner = activePartnerId ? partnersMap[activePartnerId] : null;
  
  if (!partner && activePartnerData) {
    partner = {
      id: activePartnerData.id,
      name: activePartnerData.name || activePartnerData.razao_social || 'Empresa',
      segment: activePartnerData.segment || 'Não definido',
      initials: (activePartnerData.name || activePartnerData.razao_social || 'Empresa').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase(),
      gradient: 'from-indigo-500 to-violet-600',
      isOnline: true,
      isConnected: activePartnerData.isConnected !== undefined ? activePartnerData.isConnected : true
    };
  }
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: any) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (activeConversationId) {
      chatRepository.getMessages(activeConversationId).then((data: ChatMessage[]) => {
        setMessages(data);
      }).catch(console.error);

      // Subscribe to real-time new messages for this conversation
      const channel = supabase
        .channel(`chat_${activeConversationId}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `conversation_id=eq.${activeConversationId}` 
          }, 
          (payload: any) => {
             const message = payload.new as ChatMessage;
             
             if (notifiedMessageIdsRef.current.has(message.id)) return;
             notifiedMessageIdsRef.current.add(message.id);

             setMessages((prev) => {
               if (prev.some(item => item.id === message.id)) return prev;
               return [...prev, message];
             });

             const isIncoming = message.sender_organization_id !== activeOrgId;
             if (!isIncoming) return;

             if (soundEnabledRef.current) {
               notificationAudioRef.current?.play().catch(() => {
                 // Ignore play errors
               });
             }

             if (!isChatOpenRef.current) {
               const pName = partner?.name || 'Parceiro';
               addMockNotification({ 
                 type: 'connection_request_accepted', 
                 title: 'Nova mensagem', 
                 message: `Nova mensagem de ${pName}`,
                 is_read: false
               });
               setToastMessage(`Nova mensagem de ${pName}`);
               setTimeout(() => setToastMessage(null), 4000);
             }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
       setMessages([]);
    }
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatOpen]);



  const handleSend = async (textToSend = inputText) => {
    if (!partner || !activeConversationId || !activeOrgId) return; 
    const text = textToSend.trim();
    if (!text) return;

    // Check if it's the platform org
    if (activeOrgId === '00000000-0000-0000-0000-000000000000' || (localStorage.getItem('supplyhub_company_name') || '').toLowerCase().includes('hub.ia')) {
      setComplianceError('Selecione uma empresa para atuar comercialmente.');
      return;
    }

    // Compliance Check
    const compliance = checkCompliance(text);
    if (compliance.blocked) {
      setComplianceError(compliance.reason || 'Bloqueado por compliance.');
      return;
    }

    // We update local state optimistically, but real-time covers it
    try {
      const inserted = await chatRepository.sendMessage(activeConversationId, activeOrgId, text, userId);
      // Not inserting into local state manually because real-time subscription will trigger
      // But we could insert if we wanted to avoid delay. The real-time will catch it.
    } catch (e: any) {
      console.error('Failed to send message', e);
      setComplianceError(`Não foi possível enviar a mensagem. Verifique sua organização ativa e tente novamente. Detalhe: ${e?.message || 'Erro interno'}`);
      return; // Do not clear the input if it fails
    }
    
    setComplianceError(null);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Aciona o explorador de arquivos nativo do Windows/SO
  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && partner && activeConversationId && activeOrgId) {
      // Cria uma mensagem mockando o envio do arquivo temporário seria legal, mas vamos enviar direto
      try {
        await chatRepository.uploadAttachment(activeConversationId, activeOrgId, file, userId);
      } catch (err: any) {
        console.error('Failed to upload file', err);
        setComplianceError(`Erro ao enviar anexo: ${err?.message || 'Erro interno'}`);
      }
    }
  };

  // Abre a cotação a mercado ou direta
  const handleCreateQuotation = (data: { type: 'BID' | 'DIRECT'; code: string; productName: string }) => {
    setIsQuotationModalOpen(false);
    handleSend(`Solicitei uma cotação: ${data.productName} (${data.code})`);
  };

  return (
    <>
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-3 rounded-xl shadow-lg z-50 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
           <MessageSquare className="h-4 w-4 text-indigo-400" />
           <p className="text-sm font-semibold">{toastMessage}</p>
        </div>
      )}
      {isChatOpen && (
      <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-300">
        
        {partner ? (
          <>
            {/* Header do Chat */}
            <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0 relative">
              <button
                onClick={() => setShowPartnerSelector(prev => !prev)}
                className="flex items-center gap-3 hover:bg-slate-100 px-2 py-1 rounded-xl transition-colors group flex-1 min-w-0 text-left"
                title="Trocar conversa"
              >
                <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${partner.gradient} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                  {partner.initials}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-xs leading-none flex items-center gap-1">
                    {partner.name}
                    <span className={`text-slate-400 text-[10px] transition-transform ${showPartnerSelector ? 'rotate-180' : ''}`}>▼</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                    {partner.isOnline
                      ? <><span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />Online</>
                      : 'Offline'
                    }
                    · {partner.segment}
                  </p>
                </div>
              </button>

              {/* Dropdown Seletor de Parceiros */}
              {showPartnerSelector && (
                <div className="absolute top-16 left-0 right-0 bg-white border-b border-slate-200 shadow-md z-50">
                  <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Conversas</p>
                  {partnersList.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        openChat(p.id);
                        setShowPartnerSelector(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left ${p.id === activePartnerId ? 'bg-indigo-50' : ''}`}
                    >
                      <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${p.gradient} flex items-center justify-center text-white font-bold text-[10px] shrink-0`}>
                        {p.initials}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${p.id === activePartnerId ? 'text-indigo-700' : 'text-slate-900'}`}>{p.name}</p>
                        <p className="text-[10px] text-slate-400">{p.segment}</p>
                      </div>
                      {p.isOnline && <span className="ml-auto h-2 w-2 rounded-full bg-green-500 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={toggleSound}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                  title={soundEnabled ? 'Som ativado' : 'Som desativado'}
                >
                  {soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => { window.open('/messages', '_blank'); }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                  title="Abrir Central em Nova Aba"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
                <button
                  onClick={closeChat}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                  title="Fechar chat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Banner Compliance */}
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-start gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[10px] text-amber-700 leading-snug">
                <strong>Compliance:</strong> Não envie dados bancários, PIX, e-mails ou contatos externos.
              </p>
            </div>

            {/* Área de Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              
              {!partner.isConnected && (
                <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                   <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                     <AlertTriangle className="h-8 w-8 text-slate-400" />
                   </div>
                   <h3 className="font-bold text-slate-800">Empresa não conectada</h3>
                   <p className="text-sm text-slate-500 mt-2 max-w-[250px]">
                     Para trocar mensagens comerciais livremente com esta empresa, envie um convite de parceria.
                   </p>
                   <button className="mt-6 px-4 py-2 bg-indigo-600 text-white font-semibold text-sm rounded-lg hover:bg-indigo-700 transition-colors">
                     Conectar Agora
                   </button>
                </div>
              )}
              
              {partner.isConnected && messages.map((msg, idx) => {
                const isMe = msg.sender_organization_id === activeOrgId;
                const isSystem = false;
                
                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center my-4">
                      <div className="bg-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full">
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm relative group ${
                      isMe 
                        ? 'bg-indigo-600 text-white rounded-tr-sm' 
                        : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                    }`}>
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                      <div className={`flex items-center gap-1.5 mt-1 text-[10px] ${isMe ? 'text-indigo-200 justify-end' : 'text-slate-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isMe && (msg.read_at ? <CheckCheck className="h-3 w-3 text-indigo-300" /> : <Check className="h-3 w-3 text-indigo-300" />)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Alerta de Compliance */}
            {complianceError && (
              <div className="mx-4 mb-2 flex items-start gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-red-700">Bloqueado por compliance</p>
                  <p className="text-[10px] text-red-600 leading-snug mt-0.5">{complianceError}</p>
                </div>
                <button onClick={() => setComplianceError(null)} className="text-red-400 hover:text-red-600">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Rodapé e Input */}
            <div className="p-3 border-t border-slate-200 bg-white shrink-0">
              <div className="flex items-center gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                <button onClick={handleAttachmentClick} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors shrink-0" title="Anexar arquivo">
                  <Paperclip className="h-4.5 w-4.5" />
                </button>
                <button onClick={() => setIsQuotationModalOpen(true)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors shrink-0" title="Nova Cotação">
                  <FileText className="h-4.5 w-4.5" />
                </button>
                <textarea
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 max-h-20"
                  placeholder="Mensagem..."
                  value={inputText}
                  onChange={e => {
                    setInputText(e.target.value);
                    if (complianceError) setComplianceError(null);
                  }}
                  onKeyDown={handleKeyDown}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!inputText.trim()}
                  className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl transition-colors shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0 relative">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                Conversas
              </h3>
              <button onClick={closeChat} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50">
              <div className="h-16 w-16 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-slate-400" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 mb-2">Deseja iniciar novo chat?</h4>
              <p className="text-xs text-slate-500 mb-6">
                Você ainda não selecionou nenhuma empresa para conversar.
              </p>
              <a href="/suppliers/network" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-6 rounded-xl flex items-center shadow-md">
                Iniciar nova conversa
              </a>
            </div>
          </div>
        )}

      </div>
      )}

      <QuotationTypeModal 
        isOpen={isQuotationModalOpen} 
        onClose={() => setIsQuotationModalOpen(false)} 
        onSubmit={handleCreateQuotation}
        defaultPartnerId={partner?.id}
      />
    </>
  );
}

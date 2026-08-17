import { useState, useRef, useEffect } from 'react';
import {
  Send, X, Paperclip, FileText, ShieldAlert,
  AlertTriangle, Maximize2, Check, CheckCheck,
  Bell, BellOff, MessageSquare, ArrowLeft, Search,
  Download, Image as ImageIcon
} from 'lucide-react';
import { useChatDrawer } from '../context/ChatDrawerContext';
import { useNotifications } from '@/modules/notifications/presentation/context/NotificationContext';
import { checkCompliance } from '../../domain/compliance/ComplianceFilter';
import { classifyAttachmentRisk } from '../../application/utils/classifyAttachmentRisk';
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
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';

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
  const { data: identity } = useAuthenticatedIdentity();
  const { isChatOpen, activePartnerId, activePartnerData, activeConversationId, viewMode, openChat, backToInbox, closeChat, conversations, unlockAudio } = useChatDrawer();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchInbox, setSearchInbox] = useState('');
  const [complianceError, setComplianceError] = useState<string | null>(null);
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [showPartnerSelector, setShowPartnerSelector] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const activeOrgId = identity?.organizationId || null;

  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('hubia_chat_sound_enabled') !== 'false');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [compliancePendingFile, setCompliancePendingFile] = useState<File | null>(null);
  const [compliancePendingAssessment, setCompliancePendingAssessment] = useState<any>(null);
  const notifiedMessageIdsRef = useRef<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
             // The sound and toast for incoming messages are now handled globally
             // by ChatDrawerContext's global subscription.
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
       setMessages([]);
    }
  }, [activeConversationId, activeOrgId]);

  useEffect(() => {
    if (activeConversationId && activeOrgId) {
      chatRepository.markAsRead(activeConversationId, activeOrgId).catch(console.error);
    }
  }, [activeConversationId, activeOrgId, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatOpen]);



  const handleSend = async (textToSend = inputText) => {
    if (!partner || !activeConversationId || !activeOrgId) return;
    const text = textToSend.trim();
    if (!text) return;

    // Check if it's the platform org
    if (identity?.isPlatformAdmin) {
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
    if (!file || !partner || !activeConversationId || !activeOrgId) return;

    const assessment = classifyAttachmentRisk(file);

    if (assessment.flagged) {
      setCompliancePendingFile(file);
      setCompliancePendingAssessment(assessment);
      return; // Wait for user confirmation
    }

    try {
      await chatRepository.uploadAttachment(activeConversationId, activeOrgId, file, userId, {
         flagged: false,
         riskScore: assessment.riskScore,
         riskLevel: assessment.riskLevel,
         userConfirmed: false,
         reasons: assessment.reasons
      });
    } catch (err: any) {
      console.error('Failed to upload file', err);
      setComplianceError(`Erro ao enviar anexo: ${err?.message || 'Erro interno'}`);
    }
  };

  const confirmComplianceUpload = async () => {
    if (!compliancePendingFile || !compliancePendingAssessment || !activeConversationId || !activeOrgId) return;
    
    try {
      await chatRepository.uploadAttachment(activeConversationId, activeOrgId, compliancePendingFile, userId, {
         flagged: compliancePendingAssessment.flagged,
         riskScore: compliancePendingAssessment.riskScore,
         riskLevel: compliancePendingAssessment.riskLevel,
         userConfirmed: true,
         reasons: compliancePendingAssessment.reasons
      });
    } catch (err: any) {
      console.error('Failed to upload file', err);
      setComplianceError(`Erro ao enviar anexo: ${err?.message || 'Erro interno'}`);
    } finally {
      setCompliancePendingFile(null);
      setCompliancePendingAssessment(null);
    }
  };

  const cancelComplianceUpload = async () => {
    if (compliancePendingFile && compliancePendingAssessment && activeConversationId) {
      await chatRepository.registerUploadCancellation(activeConversationId, compliancePendingFile, compliancePendingAssessment);
    }
    setCompliancePendingFile(null);
    setCompliancePendingAssessment(null);
  };

  // Abre a cotação a mercado ou direta
  const handleCreateQuotation = (data: { type: 'BID' | 'DIRECT'; code: string; productName: string }) => {
    setIsQuotationModalOpen(false);
    handleSend(`Solicitei uma cotação: ${data.productName} (${data.code})`);
  };

  const filteredConversations = (conversations || []).filter(c =>
    c.partnerName.toLowerCase().includes(searchInbox.toLowerCase()) ||
    (c.lastMessage && c.lastMessage.toLowerCase().includes(searchInbox.toLowerCase()))
  );

  return (
    <>
      {isChatOpen && (
      <div
        className="fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-300"
        onPointerDown={unlockAudio}
        onClick={unlockAudio}
      >

        {viewMode === 'inbox' ? (
          <div className="flex-1 flex flex-col h-full bg-white">
            <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                Conversas
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSound}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                  title={soundEnabled ? 'Som ativado' : 'Som desativado'}
                >
                  {soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                </button>
                <button onClick={closeChat} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4 border-b border-slate-100 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchInbox}
                  onChange={e => setSearchInbox(e.target.value)}
                  className="w-full pl-9 h-10 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 mt-10">
                  <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 border border-slate-200">
                    <MessageSquare className="h-8 w-8 text-slate-400" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-2">Nenhum resultado</h4>
                  <p className="text-xs text-slate-500 mb-6">
                    {searchInbox ? 'Sua busca não retornou resultados.' : 'Você ainda não possui conversas comerciais.'}
                  </p>
                  {!searchInbox && (
                    <a href="/suppliers/network" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-6 rounded-xl flex items-center justify-center shadow-md">
                      Iniciar nova conversa
                    </a>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredConversations.map(conv => {
                    const displayLastMessage = conv.lastMessageSenderOrganizationId === activeOrgId
                      ? `Você: ${conv.lastMessage}`
                      : conv.lastMessage;
                    return (
                    <button
                      key={conv.conversationId}
                      onClick={() => openChat(conv.partnerOrganizationId, { name: conv.partnerName })}
                      className="w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-start gap-4"
                    >
                      <div className="relative flex-shrink-0 mt-0.5">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs">
                          {conv.partnerInitials}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <p className="font-bold text-sm text-slate-900 truncate pr-2">{conv.partnerName}</p>
                          <span className="text-[10px] font-medium text-slate-400 shrink-0">
                            {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-slate-500 truncate pr-4">{displayLastMessage || 'Conversa iniciada'}</p>
                          {conv.unreadCount > 0 && (
                            <span className="h-4 min-w-[1rem] px-1.5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )})}
                </div>
              )}
            </div>
          </div>
        ) : partner ? (
          <>
            {/* Header do Chat */}
            <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0 relative">
              <div className="flex items-center flex-1 min-w-0">
                <button onClick={backToInbox} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500 mr-1 shrink-0" title="Voltar para Inbox">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-3 px-2 py-1 flex-1 min-w-0 text-left">
                  <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${partner.gradient} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                    {partner.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-xs leading-none truncate">
                      {partner.name}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                      {partner.isOnline
                        ? <><span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />Online</>
                        : 'Offline'
                      }
                      · {partner.segment}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dropdown Seletor de Parceiros Removido - Inbox substitui isso */}

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

                let attachmentRender = null;
                let parsedContent = msg.content;
                let attachmentUrl = '';

                if (msg.metadata?.type === 'attachment') {
                  const attachment = msg.metadata.attachment;
                  const { data: publicUrlData } = supabase.storage.from('messages').getPublicUrl(attachment.path);
                  attachmentUrl = publicUrlData.publicUrl;
                  const isImage = attachment.mimeType?.startsWith('image/');

                  if (isImage) {
                    attachmentRender = (
                      <div className="mt-2 flex flex-col gap-1">
                        <img
                          src={attachmentUrl}
                          alt={attachment.name}
                          className="w-48 h-48 object-cover rounded-lg cursor-pointer border border-slate-200"
                          onClick={() => setPreviewImage(attachmentUrl)}
                        />
                        <div className="flex justify-between items-center px-1">
                          <span className="text-xs truncate max-w-[140px] opacity-90" title={attachment.name}>{attachment.name}</span>
                          <a href={attachmentUrl} download={attachment.name} target="_blank" rel="noreferrer" className="opacity-75 hover:opacity-100">
                            <Download className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    );
                  } else {
                    attachmentRender = (
                      <div className="mt-2 bg-white/10 p-3 rounded-lg border border-slate-200/20 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-6 w-6 opacity-80" />
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold truncate max-w-[150px]" title={attachment.name}>{attachment.name}</span>
                            <span className="text-[10px] opacity-75">{Math.round(attachment.size / 1024)} KB • {attachment.mimeType?.split('/')[1]?.toUpperCase() || 'Arquivo'}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 text-xs font-semibold mt-1">
                          <a href={attachmentUrl} target="_blank" rel="noreferrer" className="flex-1 text-center py-1.5 bg-black/10 hover:bg-black/20 rounded">
                            Abrir
                          </a>
                          <button onClick={async (e) => {
                            e.preventDefault();
                            try {
                              const res = await fetch(attachmentUrl);
                              const blob = await res.blob();
                              const blobUrl = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = blobUrl;
                              a.download = attachment.name;
                              document.body.appendChild(a);
                              a.click();
                              window.URL.revokeObjectURL(blobUrl);
                              document.body.removeChild(a);
                            } catch (error) {
                              console.error('Falha ao baixar anexo:', error);
                              alert('Erro ao tentar baixar o arquivo. Verifique sua conexão ou tente novamente mais tarde.');
                            }
                          }} className="flex-1 text-center py-1.5 bg-black/10 hover:bg-black/20 rounded">
                            Baixar
                          </button>
                        </div>
                      </div>
                    );
                  }
                } else if (msg.content?.startsWith('📁 Anexo: [')) {
                  // Legacy parser
                  const regex = /📁 Anexo: \[(.*?)\]\((.*?)\)/;
                  const match = msg.content.match(regex);
                  if (match) {
                    parsedContent = '';
                    const fileName = match[1];
                    attachmentUrl = match[2];
                    const ext = fileName.split('.').pop()?.toLowerCase();
                    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '');

                    if (isImage) {
                      attachmentRender = (
                        <div className="mt-2 flex flex-col gap-1">
                          <img
                            src={attachmentUrl}
                            alt={fileName}
                            className="w-48 h-48 object-cover rounded-lg cursor-pointer border border-slate-200"
                            onClick={() => setPreviewImage(attachmentUrl)}
                          />
                          <div className="flex justify-between items-center px-1">
                            <span className="text-xs truncate max-w-[140px] opacity-90" title={fileName}>{fileName}</span>
                            <a href={attachmentUrl} download={fileName} target="_blank" rel="noreferrer" className="opacity-75 hover:opacity-100">
                              <Download className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      );
                    } else {
                      attachmentRender = (
                        <div className="mt-2 bg-white/10 p-3 rounded-lg border border-slate-200/20 flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-6 w-6 opacity-80" />
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold truncate max-w-[150px]" title={fileName}>{fileName}</span>
                              <span className="text-[10px] opacity-75">{ext?.toUpperCase() || 'Arquivo'}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 text-xs font-semibold mt-1">
                            <a href={attachmentUrl} target="_blank" rel="noreferrer" className="flex-1 text-center py-1.5 bg-black/10 hover:bg-black/20 rounded">
                              Abrir
                            </a>
                            <button onClick={async (e) => {
                              e.preventDefault();
                              try {
                                const res = await fetch(attachmentUrl);
                                const blob = await res.blob();
                                const blobUrl = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = blobUrl;
                                a.download = fileName;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(blobUrl);
                                document.body.removeChild(a);
                              } catch (error) {
                                console.error('Falha ao baixar anexo:', error);
                                alert('Erro ao tentar baixar o arquivo. Verifique sua conexão ou tente novamente mais tarde.');
                              }
                            }} className="flex-1 text-center py-1.5 bg-black/10 hover:bg-black/20 rounded">
                              Baixar
                            </button>
                          </div>
                        </div>
                      );
                    }
                  }
                }

                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm relative group ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                        : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                    }`}>
                      {parsedContent && <p className="leading-relaxed whitespace-pre-wrap">{parsedContent}</p>}
                      {attachmentRender}

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

            {/* Modal de Preview de Imagem */}
            {previewImage && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <button onClick={() => setPreviewImage(null)} className="absolute top-6 right-6 text-white hover:text-slate-300">
                  <X className="h-8 w-8" />
                </button>
                <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" />
              </div>
            )}

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

            {/* Modal de Pre-flight Compliance */}
            {compliancePendingFile && compliancePendingAssessment && (
              <div className="mx-4 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-xl shadow-sm animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-start gap-3">
                  <div className="bg-amber-100 p-2 rounded-full shrink-0">
                    <ShieldAlert className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-amber-900 text-sm">Atenção: Arquivo potencialmente sensível</p>
                    <p className="text-xs text-amber-700 mt-1 mb-2">
                      O arquivo <strong>{compliancePendingFile.name}</strong> pode conter informações confidenciais (Risco: {compliancePendingAssessment.riskLevel.toUpperCase()}).
                      O envio deste documento será auditado e registrado no compliance da sua organização.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button onClick={cancelComplianceUpload} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-lg shadow-sm transition-colors">
                        Cancelar Envio
                      </button>
                      <button onClick={confirmComplianceUpload} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors">
                        Enviar mesmo assim
                      </button>
                    </div>
                  </div>
                </div>
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
          <div className="flex-1 flex flex-col justify-center items-center bg-slate-50 text-center p-8">
            <h3 className="font-bold text-slate-800">Carregando conversa...</h3>
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

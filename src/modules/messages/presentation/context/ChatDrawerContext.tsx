import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/infrastructure/supabase/client';
import { chatRepository, ChatMessage } from '../../infrastructure/repositories/SupabaseChatRepository';
import { useNotifications } from '@/modules/notifications/presentation/context/NotificationContext';
import { MessageSquare } from 'lucide-react';

interface ChatDrawerContextType {
  isChatOpen: boolean;
  activePartnerId: string | null;
  activePartnerData: any | null;
  activeConversationId: string | null;
  viewMode: 'inbox' | 'chat';
  openChat: (partnerId: string, partnerData?: any) => void;
  openInbox: () => void;
  backToInbox: () => void;
  closeChat: () => void;
  conversations: any[];
  unreadChatCount: number;
  unlockAudio: () => void;
}

const ChatDrawerContext = createContext<ChatDrawerContextType | undefined>(undefined);

export function ChatDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [activePartnerData, setActivePartnerData] = useState<any | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'inbox' | 'chat'>('inbox');
  const [conversations, setConversations] = useState<any[]>([]);
  const { addMockNotification } = useNotifications();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const unreadChatCount = conversations.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0);

  const notifiedMessageIdsRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const activeOrgId = localStorage.getItem('supplyhub_organization_id');
  const activeConversationIdRef = useRef(activeConversationId);
  const isChatOpenRef = useRef(isChatOpen);
  
  useEffect(() => { activeConversationIdRef.current = activeConversationId; }, [activeConversationId]);
  useEffect(() => { isChatOpenRef.current = isChatOpen; }, [isChatOpen]);

  useEffect(() => {
    audioRef.current = new Audio('/sounds/new-message.mp3');
    audioRef.current.preload = 'auto';
    audioRef.current.volume = 0.35;
    return () => { audioRef.current = null; };
  }, []);

  const audioUnlockedRef = useRef(false);

  const unlockAudio = useCallback(async () => {
    if (audioUnlockedRef.current || !audioRef.current) return;
    const originalVolume = audioRef.current.volume;
    try {
      audioRef.current.volume = 0;
      console.log('CHAT_AUDIO_PLAY_ATTEMPT');
      await audioRef.current.play();
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioUnlockedRef.current = true;
      const soundEnabled = localStorage.getItem('hubia_chat_sound_enabled') !== 'false';
      console.log('CHAT_AUDIO_UNLOCK', {
        unlocked: true,
        enabled: soundEnabled,
      });
    } catch (error: any) {
      console.warn('CHAT_AUDIO_PLAY_BLOCKED', {
        name: error?.name,
        message: error?.message,
      });
    } finally {
      audioRef.current.volume = originalVolume;
    }
  }, []);

  const loadConversations = useCallback(async () => {
    if (!activeOrgId) return;
    try {
      const list = await chatRepository.listConversationsForCurrentOrganization(activeOrgId);
      setConversations(list);
    } catch (e) {
      console.error('Failed to load conversations inbox', e);
    }
  }, [activeOrgId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeOrgId) return;
    
    const channel = supabase
      .channel(`global-chat-notifications:${activeOrgId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload: any) => {
          const message = payload.new as ChatMessage;
          
          if (message.sender_organization_id === activeOrgId) return;
          
          if (notifiedMessageIdsRef.current.has(message.id)) return;
          notifiedMessageIdsRef.current.add(message.id);
          
          const isDrawerOpenHere = isChatOpenRef.current && activeConversationIdRef.current === message.conversation_id;
          
          const soundEnabled = localStorage.getItem('hubia_chat_sound_enabled') !== 'false';
          if (soundEnabled) {
            audioRef.current?.play().catch(() => {});
          }
          
          if (!isDrawerOpenHere) {
             const partnerName = message.sender_organization_id; // Will update after reload
             addMockNotification({
               type: 'chat_message' as any,
               title: 'Nova mensagem',
               message: 'Nova mensagem recebida',
               is_read: false,
               metadata: {
                 conversationId: message.conversation_id,
                 messageId: message.id,
                 partnerOrganizationId: message.sender_organization_id
               }
             });
             
             setToastMessage(`Nova mensagem recebida`);
             setTimeout(() => setToastMessage(null), 4000);
          }
          
          // Reload conversations to update inbox order and unread counts
          loadConversations();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeOrgId, addMockNotification]);

  const openChat = useCallback(async (partnerId: string, partnerData?: any) => {
    setActivePartnerId(partnerId);
    if (partnerData) setActivePartnerData(partnerData);
    setIsChatOpen(true);
    setViewMode('chat');
    
    // Attempt to get or create conversation in the background
    try {
      const activeOrgId = localStorage.getItem('supplyhub_organization_id');
      
      console.group('--- DEBUG C1.3 CHAT ---');
      console.log('currentOrganizationId:', activeOrgId);
      console.log('partnerOrganizationId:', partnerId);
      console.log('authenticatedUserId:', 'not_available_in_context_directly');
      console.log('partner:', partnerData);
      console.groupEnd();

      if (activeOrgId && partnerId) {
        const convId = await chatRepository.getOrCreateConversation(activeOrgId, partnerId);
        setActiveConversationId(convId);
      }
    } catch (e) {
      console.error('Failed to init conversation:', e);
    }
  }, []);

  useEffect(() => {
    const handleOpenChatEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.partnerOrganizationId) {
        openChat(customEvent.detail.partnerOrganizationId, { name: customEvent.detail.partnerName });
      }
    };
    window.addEventListener('supplyhub:open-chat', handleOpenChatEvent);
    return () => window.removeEventListener('supplyhub:open-chat', handleOpenChatEvent);
  }, [openChat]);



  const openInbox = useCallback(() => {
    setIsChatOpen(true);
    setViewMode('inbox');
    loadConversations();
  }, [loadConversations]);

  const backToInbox = useCallback(() => {
    setViewMode('inbox');
    setActiveConversationId(null);
    loadConversations();
  }, [loadConversations]);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    setActivePartnerId(null);
    setActivePartnerData(null);
    setActiveConversationId(null);
    setViewMode('inbox');
  }, []);

  return (
    <ChatDrawerContext.Provider value={{ 
      isChatOpen, activePartnerId, activePartnerData, activeConversationId, viewMode, 
      openChat, openInbox, backToInbox, closeChat, 
      conversations, unreadChatCount, unlockAudio 
    }}>
      {children}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-3 rounded-xl shadow-lg z-50 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
           <MessageSquare className="h-4 w-4 text-indigo-400" />
           <p className="text-sm font-semibold">{toastMessage}</p>
        </div>
      )}
    </ChatDrawerContext.Provider>
  );
}

export function useChatDrawer() {
  const context = useContext(ChatDrawerContext);
  if (!context) {
    throw new Error('useChatDrawer deve ser usado dentro de um ChatDrawerProvider');
  }
  return context;
}

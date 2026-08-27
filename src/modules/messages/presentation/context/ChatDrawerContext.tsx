import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/infrastructure/supabase/client';
import { chatRepository, ChatMessage } from '../../infrastructure/repositories/SupabaseChatRepository';
import { useNotifications } from '@/modules/notifications/presentation/context/NotificationContext';
import { MessageSquare } from 'lucide-react';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';

interface ChatDrawerContextType {
  isChatOpen: boolean;
  activePartnerId: string | null;
  activePartnerData: any | null;
  activeConversationId: string | null;
  viewMode: 'inbox' | 'chat';
  openChat: (partnerId: string, partnerData?: any) => void;
  openConversation: (conversationId: string) => Promise<boolean>;
  openInbox: () => void;
  backToInbox: () => void;
  closeChat: () => void;
  conversations: any[];
  unreadChatCount: number;
  unlockAudio: () => void;
}

const ChatDrawerContext = createContext<ChatDrawerContextType | undefined>(undefined);

export function ChatDrawerProvider({ children }: { children: React.ReactNode }) {
  const { data: identity } = useAuthenticatedIdentity();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [activePartnerData, setActivePartnerData] = useState<any | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'inbox' | 'chat'>('inbox');
  const [conversations, setConversations] = useState<any[]>([]);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const unreadChatCount = conversations.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0);

  const notifiedMessageIdsRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const activeOrgId = identity?.organizationId || null;
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
  }, [activeOrgId, ]);

  const openChat = useCallback(async (partnerId: string, partnerData?: any) => {
    setActivePartnerId(partnerId);
    if (partnerData) setActivePartnerData(partnerData);
    setIsChatOpen(true);
    setViewMode('chat');
    
    // Attempt to get or create conversation in the background
    try {
      if (activeOrgId && partnerId) {
        const convId = await chatRepository.getOrCreateConversation(activeOrgId, partnerId);
        setActiveConversationId(convId);
      }
    } catch (e) {
      console.error('Failed to init conversation:', e);
    }
  }, [activeOrgId]);

  const openConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    if (!activeOrgId || !conversationId) return false;

    try {
      const conversation = await chatRepository.getConversationForCurrentOrganization(
        conversationId,
        activeOrgId,
      );
      if (!conversation) {
        console.warn('Conversation deep link is not available for the active organization', { conversationId });
        return false;
      }

      setActivePartnerId(conversation.partnerOrganizationId);
      setActivePartnerData({
        id: conversation.partnerOrganizationId,
        name: conversation.partnerName,
        isConnected: true,
      });
      setActiveConversationId(conversation.conversationId);
      setViewMode('chat');
      setIsChatOpen(true);
      void loadConversations();
      return true;
    } catch (error) {
      console.error('Failed to open conversation deep link', error);
      return false;
    }
  }, [activeOrgId, loadConversations]);

  useEffect(() => {
    const handleOpenChatEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.conversationId) {
        void openConversation(customEvent.detail.conversationId);
      } else if (customEvent.detail?.partnerOrganizationId) {
        openChat(customEvent.detail.partnerOrganizationId, { name: customEvent.detail.partnerName });
      }
    };
    window.addEventListener('supplyhub:open-chat', handleOpenChatEvent);
    return () => window.removeEventListener('supplyhub:open-chat', handleOpenChatEvent);
  }, [openChat, openConversation]);



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
      openChat, openConversation, openInbox, backToInbox, closeChat,
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

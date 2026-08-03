import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/infrastructure/supabase/client';
import { chatRepository } from '../../infrastructure/repositories/SupabaseChatRepository';

interface ChatDrawerContextType {
  isChatOpen: boolean;
  activePartnerId: string | null;
  activePartnerData: any | null;
  activeConversationId: string | null;
  openChat: (partnerId: string, partnerData?: any) => void;
  closeChat: () => void;
}

const ChatDrawerContext = createContext<ChatDrawerContextType | undefined>(undefined);

export function ChatDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [activePartnerData, setActivePartnerData] = useState<any | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const openChat = useCallback(async (partnerId: string, partnerData?: any) => {
    setActivePartnerId(partnerId);
    if (partnerData) setActivePartnerData(partnerData);
    setIsChatOpen(true);
    
    // Attempt to get or create conversation in the background
    try {
      const activeOrgId = localStorage.getItem('supplyhub_organization_id');
      if (activeOrgId && partnerId) {
        const convId = await chatRepository.getOrCreateConversation(activeOrgId, partnerId);
        setActiveConversationId(convId);
      }
    } catch (e) {
      console.error('Failed to init conversation:', e);
    }
  }, []);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    setActivePartnerId(null);
    setActivePartnerData(null);
    setActiveConversationId(null);
  }, []);

  return (
    <ChatDrawerContext.Provider value={{ isChatOpen, activePartnerId, activePartnerData, activeConversationId, openChat, closeChat }}>
      {children}
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

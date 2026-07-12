import React, { createContext, useContext, useState, useCallback } from 'react';

interface ChatDrawerContextType {
  isChatOpen: boolean;
  activePartnerId: string | null;
  openChat: (partnerId: string) => void;
  closeChat: () => void;
}

const ChatDrawerContext = createContext<ChatDrawerContextType | undefined>(undefined);

export function ChatDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);

  const openChat = useCallback((partnerId: string) => {
    setActivePartnerId(partnerId);
    setIsChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    setActivePartnerId(null);
  }, []);

  return (
    <ChatDrawerContext.Provider value={{ isChatOpen, activePartnerId, openChat, closeChat }}>
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

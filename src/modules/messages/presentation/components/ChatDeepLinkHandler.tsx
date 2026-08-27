import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';
import {
  getChatConversationFromSearch,
  removeChatDeepLinkParams,
} from '../../application/services/chatDeepLink';
import { useChatDrawer } from '../context/ChatDrawerContext';

export function ChatDeepLinkHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: identity, isLoading } = useAuthenticatedIdentity();
  const { openConversation } = useChatDrawer();
  const processingRef = useRef<string | null>(null);

  useEffect(() => {
    const conversationId = getChatConversationFromSearch(location.search);
    if (!conversationId || isLoading || !identity?.organizationId) return;

    const processingKey = `${location.pathname}:${conversationId}`;
    if (processingRef.current === processingKey) return;
    processingRef.current = processingKey;

    let cancelled = false;
    void openConversation(conversationId).finally(() => {
      if (cancelled) return;
      navigate(
        {
          pathname: location.pathname,
          search: removeChatDeepLinkParams(location.search),
        },
        { replace: true },
      );
      processingRef.current = null;
    });

    return () => {
      cancelled = true;
      if (processingRef.current === processingKey) processingRef.current = null;
    };
  }, [identity?.organizationId, isLoading, location.pathname, location.search, navigate, openConversation]);

  return null;
}

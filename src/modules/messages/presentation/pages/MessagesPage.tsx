import { Navigate, useLocation } from 'react-router-dom';
import {
  buildCanonicalChatDeepLink,
  getChatConversationFromSearch,
} from '../../application/services/chatDeepLink';

/**
 * Compatibility bridge for legacy links.
 *
 * ChatDrawer is the only conversation UI. Keeping this route as a redirect
 * allows old notifications and saved URLs to continue working without
 * maintaining a second inbox implementation.
 */
export default function MessagesPage() {
  const location = useLocation();
  const conversationId = getChatConversationFromSearch(location.search);
  const destination = conversationId
    ? buildCanonicalChatDeepLink(conversationId)
    : '/dashboard';

  return <Navigate to={destination} replace />;
}

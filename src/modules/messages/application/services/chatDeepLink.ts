export const CHAT_DEEP_LINK_PARAM = 'chatConversation';
export const LEGACY_CHAT_DEEP_LINK_PARAM = 'conversation';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidConversationId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

export function isChatNotificationType(type: string): boolean {
  return type.toUpperCase() === 'CHAT_MESSAGE_RECEIVED' || type.toLowerCase() === 'chat_message';
}

export function getNotificationConversationId(metadata?: Record<string, unknown>): string | null {
  const candidate = metadata?.conversation_id ?? metadata?.conversationId;
  return isValidConversationId(candidate) ? candidate.trim() : null;
}

export function getChatConversationFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const candidate = params.get(CHAT_DEEP_LINK_PARAM) ?? params.get(LEGACY_CHAT_DEEP_LINK_PARAM);
  return isValidConversationId(candidate) ? candidate.trim() : null;
}

export function buildCanonicalChatDeepLink(conversationId: string, pathname = '/dashboard'): string {
  if (!isValidConversationId(conversationId)) return pathname;
  const params = new URLSearchParams({ [CHAT_DEEP_LINK_PARAM]: conversationId.trim() });
  return `${pathname}?${params.toString()}`;
}

export function removeChatDeepLinkParams(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(CHAT_DEEP_LINK_PARAM);
  params.delete(LEGACY_CHAT_DEEP_LINK_PARAM);
  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : '';
}

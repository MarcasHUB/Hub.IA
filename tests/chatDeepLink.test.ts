import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCanonicalChatDeepLink,
  getChatConversationFromSearch,
  getNotificationConversationId,
  isChatNotificationType,
  removeChatDeepLinkParams,
} from '../src/modules/messages/application/services/chatDeepLink.ts';

const conversationId = '12345678-1234-4234-8234-1234567890ab';

test('reconhece o evento de produção e o alias legado de chat', () => {
  assert.equal(isChatNotificationType('CHAT_MESSAGE_RECEIVED'), true);
  assert.equal(isChatNotificationType('chat_message'), true);
  assert.equal(isChatNotificationType('QUOTATION_RECEIVED'), false);
});

test('prioriza conversation_id snake_case emitido pelo trigger', () => {
  assert.equal(getNotificationConversationId({ conversation_id: conversationId }), conversationId);
  assert.equal(getNotificationConversationId({ conversationId }), conversationId);
  assert.equal(getNotificationConversationId({ conversation_id: 'invalid' }), null);
});

test('constrói o deep link canônico no dashboard', () => {
  assert.equal(
    buildCanonicalChatDeepLink(conversationId),
    `/dashboard?chatConversation=${conversationId}`,
  );
});

test('aceita links canônicos e legados e rejeita UUID inválido', () => {
  assert.equal(getChatConversationFromSearch(`?chatConversation=${conversationId}`), conversationId);
  assert.equal(getChatConversationFromSearch(`?conversation=${conversationId}`), conversationId);
  assert.equal(getChatConversationFromSearch('?chatConversation=invalid'), null);
});

test('limpa somente parâmetros transitórios do chat', () => {
  assert.equal(
    removeChatDeepLinkParams(`?tab=materials&chatConversation=${conversationId}`),
    '?tab=materials',
  );
});

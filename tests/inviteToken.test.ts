import assert from 'node:assert/strict';
import test from 'node:test';
import { extractInviteToken } from '../src/shared/utils/inviteToken.ts';

const hexToken = 'a'.repeat(64);
const uuidToken = '550e8400-e29b-41d4-a716-446655440000';

test('aceita o token hexadecimal usado pelos convites novos', () => {
  assert.equal(extractInviteToken(hexToken.toUpperCase()), hexToken);
});

test('extrai token hexadecimal de URL e Safe Link codificado', () => {
  const url = encodeURIComponent(`https://hub.local/aceitar-convite?token=${hexToken}`);
  assert.equal(extractInviteToken(url), hexToken);
});

test('mantém compatibilidade com tokens UUID legados', () => {
  assert.equal(extractInviteToken(uuidToken), uuidToken);
});

test('rejeita entradas sem token válido', () => {
  assert.equal(extractInviteToken('token-curto'), null);
});

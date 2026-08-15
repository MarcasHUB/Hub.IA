import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CompanyConnectionFlowBlockedError,
  executeCompanyConnectionFlow,
  getUserFacingConnectionError,
  resolveCompanyConnectionDecision,
} from '../src/modules/suppliers/application/services/companyConnectionFlow.ts';

test('organização existente usa request_connection e nunca cria invitation', async () => {
  const calls = { connection: 0, invitation: 0, target: '', message: '' };

  const result = await executeCompanyConnectionFlow(
    {
      lookupState: 'found',
      existingOrganizationId: '20000000-0000-0000-0000-000000000002',
      message: '  Parceria estratégica  ',
    },
    {
      requestConnection: async (target, message) => {
        calls.connection += 1;
        calls.target = target;
        calls.message = message || '';
      },
      createExternalInvitation: async () => {
        calls.invitation += 1;
      },
    },
  );

  assert.equal(result, 'connection_request');
  assert.equal(calls.connection, 1);
  assert.equal(calls.invitation, 0);
  assert.equal(calls.target, '20000000-0000-0000-0000-000000000002');
  assert.equal(calls.message, 'Parceria estratégica');
});

test('organização existente não depende de e-mail para solicitar conexão', async () => {
  let requested = false;

  await executeCompanyConnectionFlow(
    {
      lookupState: 'found',
      existingOrganizationId: '20000000-0000-0000-0000-000000000002',
    },
    {
      requestConnection: async () => {
        requested = true;
      },
      createExternalInvitation: async () => {
        assert.fail('o fluxo interno não pode criar convite externo');
      },
    },
  );

  assert.equal(requested, true);
});

test('empresa comprovadamente não encontrada mantém o onboarding externo', async () => {
  let invitations = 0;

  const result = await executeCompanyConnectionFlow(
    { lookupState: 'not_found', existingOrganizationId: null },
    {
      requestConnection: async () => assert.fail('empresa externa não pode gerar connection_request antes do onboarding'),
      createExternalInvitation: async () => {
        invitations += 1;
      },
    },
  );

  assert.equal(result, 'external_invitation');
  assert.equal(invitations, 1);
});

for (const lookupState of ['idle', 'loading', 'ambiguous', 'failed'] as const) {
  test(`lookup ${lookupState} falha fechado e não inicia nenhum fluxo`, async () => {
    let actions = 0;

    await assert.rejects(
      executeCompanyConnectionFlow(
        { lookupState, existingOrganizationId: null },
        {
          requestConnection: async () => { actions += 1; },
          createExternalInvitation: async () => { actions += 1; },
        },
      ),
      CompanyConnectionFlowBlockedError,
    );

    assert.equal(actions, 0);
  });
}

test('estados inseguros bloqueiam mesmo se houver organization_id residual', () => {
  const target = '20000000-0000-0000-0000-000000000002';
  const expectations = [
    ['idle', 'lookup_required'],
    ['loading', 'lookup_in_progress'],
    ['ambiguous', 'lookup_ambiguous'],
    ['failed', 'lookup_failed'],
    ['not_found', 'lookup_failed'],
  ] as const;

  for (const [lookupState, reason] of expectations) {
    assert.deepEqual(
      resolveCompanyConnectionDecision(lookupState, target),
      { kind: 'blocked', reason },
    );
  }
});

test('resultado found sem organization_id falha fechado', () => {
  assert.deepEqual(
    resolveCompanyConnectionDecision('found', null),
    { kind: 'blocked', reason: 'lookup_failed' },
  );
});

test('códigos internos conhecidos são convertidos em mensagens amigáveis', () => {
  const messages = [
    getUserFacingConnectionError(new Error('ORGANIZATION_ALREADY_EXISTS')),
    getUserFacingConnectionError(new Error('CONNECTION_ALREADY_EXISTS')),
    getUserFacingConnectionError(new Error('CONNECTION_RESPONSE_FORBIDDEN')),
  ];

  for (const message of messages) {
    assert.equal(message.includes('ORGANIZATION_'), false);
    assert.equal(message.includes('CONNECTION_'), false);
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { hasCapability } from '../src/core/config/permissions.ts';
import { privateQueryKeys } from '../src/modules/auth/application/query/privateQueryKeys.ts';
import {
  clearPrivateSessionState,
  isCurrentCompanyProfileEvent,
} from '../src/modules/auth/application/services/privateSessionState.ts';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const RAIZEN_USER = 'raizen-admin';
const RAIZEN_ORG = 'raizen-org';
const CHAPARIA_USER = 'chaparia-buyer';
const CHAPARIA_ORG = 'chaparia-org';

function seedPrivateState(
  client: QueryClient,
  authUserId: string,
  organizationId: string,
  companyName: string,
  role: 'administrador' | 'comprador',
) {
  client.setQueryData(privateQueryKeys.identity(authUserId), {
    userId: authUserId,
    organizationId,
    organizationName: companyName,
    operatorProfile: role,
  });
  client.setQueryData(privateQueryKeys.organizationProfile(authUserId, organizationId), {
    id: organizationId,
    name: companyName,
  });
  client.setQueryData(privateQueryKeys.operators(authUserId, organizationId), [
    { id: `${authUserId}-operator` },
  ]);
}

async function assertSessionSwap(
  from: { user: string; org: string; company: string; role: 'administrador' | 'comprador' },
  to: { user: string; org: string; company: string; role: 'administrador' | 'comprador' },
) {
  const client = new QueryClient();
  const storage = new MemoryStorage();
  seedPrivateState(client, from.user, from.org, from.company, from.role);
  client.setQueryData(['public', 'catalog'], ['preservado']);
  storage.setItem('supplyhub_company_name', from.company);
  storage.setItem('supplyhub_company_logo', `${from.org}.png`);
  storage.setItem('supplyhub_organization_id', from.org);
  storage.setItem('theme', 'dark');

  await clearPrivateSessionState(client, storage);

  assert.equal(client.getQueryData(privateQueryKeys.identity(from.user)), undefined);
  assert.equal(client.getQueryData(privateQueryKeys.organizationProfile(from.user, from.org)), undefined);
  assert.equal(client.getQueryData(privateQueryKeys.operators(from.user, from.org)), undefined);
  assert.deepEqual(client.getQueryData(['public', 'catalog']), ['preservado']);
  assert.equal(storage.getItem('supplyhub_company_name'), null);
  assert.equal(storage.getItem('supplyhub_company_logo'), null);
  assert.equal(storage.getItem('supplyhub_organization_id'), null);
  assert.equal(storage.getItem('theme'), 'dark');

  seedPrivateState(client, to.user, to.org, to.company, to.role);
  assert.equal(
    (client.getQueryData(privateQueryKeys.identity(to.user)) as { organizationId: string }).organizationId,
    to.org,
  );
  assert.equal(client.getQueryData(privateQueryKeys.identity(from.user)), undefined);
}

test('Raizen -> logout -> Chaparia nao reutiliza dados privados no mesmo QueryClient', async () => {
  await assertSessionSwap(
    { user: RAIZEN_USER, org: RAIZEN_ORG, company: 'Raizen', role: 'administrador' },
    { user: CHAPARIA_USER, org: CHAPARIA_ORG, company: 'Chaparia', role: 'comprador' },
  );
});

test('Chaparia -> logout -> Raizen nao reutiliza dados privados no mesmo QueryClient', async () => {
  await assertSessionSwap(
    { user: CHAPARIA_USER, org: CHAPARIA_ORG, company: 'Chaparia', role: 'comprador' },
    { user: RAIZEN_USER, org: RAIZEN_ORG, company: 'Raizen', role: 'administrador' },
  );
});

test('Admin -> logout -> Comprador nao herda capabilities administrativas', async () => {
  const client = new QueryClient();
  const storage = new MemoryStorage();
  seedPrivateState(client, RAIZEN_USER, RAIZEN_ORG, 'Raizen', 'administrador');

  assert.equal(hasCapability('administrador', 'operators:manage'), true);
  await clearPrivateSessionState(client, storage);
  seedPrivateState(client, CHAPARIA_USER, CHAPARIA_ORG, 'Chaparia', 'comprador');

  assert.equal(client.getQueryData(privateQueryKeys.identity(RAIZEN_USER)), undefined);
  assert.equal(hasCapability('comprador', 'operators:view'), false);
  assert.equal(hasCapability('comprador', 'operators:manage'), false);
});

test('localStorage adulterado nao altera identidade canonica em cache', () => {
  const client = new QueryClient();
  const storage = new MemoryStorage();
  seedPrivateState(client, CHAPARIA_USER, CHAPARIA_ORG, 'Chaparia', 'comprador');
  storage.setItem('supplyhub_organization_id', RAIZEN_ORG);
  storage.setItem('supplyhub_company_name', 'Raizen adulterada');
  storage.setItem('supplyhub_company_logo', 'raizen.png');

  const identity = client.getQueryData(privateQueryKeys.identity(CHAPARIA_USER)) as {
    organizationId: string;
    organizationName: string;
  };
  assert.equal(identity.organizationId, CHAPARIA_ORG);
  assert.equal(identity.organizationName, 'Chaparia');
});

test('company_profile_updated de outra organizacao e rejeitado', () => {
  assert.equal(
    isCurrentCompanyProfileEvent(
      { authUserId: RAIZEN_USER, organizationId: RAIZEN_ORG },
      CHAPARIA_USER,
      CHAPARIA_ORG,
    ),
    false,
  );
  assert.equal(
    isCurrentCompanyProfileEvent(
      { authUserId: CHAPARIA_USER, organizationId: CHAPARIA_ORG },
      CHAPARIA_USER,
      CHAPARIA_ORG,
    ),
    true,
  );
});

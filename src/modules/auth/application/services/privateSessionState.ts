import type { QueryClient } from '@tanstack/react-query';
import { isPrivateQueryKey } from '../query/privateQueryKeys.ts';

export interface SessionStorageLike {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

export interface CompanyProfileUpdatedDetail {
  authUserId?: string;
  organizationId?: string;
}

export async function clearPrivateSessionState(
  queryClient: QueryClient,
  storage?: SessionStorageLike,
): Promise<void> {
  const predicate = ({ queryKey }: { queryKey: readonly unknown[] }) =>
    isPrivateQueryKey(queryKey);

  await queryClient.cancelQueries({ predicate });
  queryClient.removeQueries({ predicate });

  if (!storage) return;

  const privateKeys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith('supplyhub_')) privateKeys.push(key);
  }
  privateKeys.forEach((key) => storage.removeItem(key));
}

export function isCurrentCompanyProfileEvent(
  detail: CompanyProfileUpdatedDetail | null | undefined,
  authUserId: string,
  organizationId: string,
): boolean {
  return detail?.authUserId === authUserId
    && detail.organizationId === organizationId;
}

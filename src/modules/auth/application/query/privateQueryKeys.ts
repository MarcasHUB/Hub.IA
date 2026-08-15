export const privateQueryKeys = {
  all: ['private'] as const,
  identity: (authUserId: string) => ['private', 'authenticated-identity', authUserId] as const,
  organizationProfile: (authUserId: string, organizationId: string) =>
    ['private', 'organization-profile', authUserId, organizationId] as const,
  operators: (authUserId: string, organizationId: string) =>
    ['private', 'operators', authUserId, organizationId] as const,
  categories: (authUserId: string, organizationId: string) =>
    ['private', 'categories', authUserId, organizationId] as const,
  delegations: (authUserId: string, organizationId: string) =>
    ['private', 'delegations', authUserId, organizationId] as const,
  logs: (authUserId: string, organizationId: string) =>
    ['private', 'logs', authUserId, organizationId] as const,
  segments: (authUserId: string, organizationId: string) =>
    ['private', 'segments', authUserId, organizationId] as const,
  operatorProfile: (authUserId: string, organizationId: string, operatorId: string) =>
    ['private', 'operator-profile', authUserId, organizationId, operatorId] as const,
};

export function isPrivateQueryKey(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === privateQueryKeys.all[0];
}

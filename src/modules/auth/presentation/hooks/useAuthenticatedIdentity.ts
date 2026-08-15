import { useQuery } from '@tanstack/react-query';
import { getAuthenticatedIdentity } from '../../application/services/getAuthenticatedIdentity';

export const authenticatedIdentityKey = ['authenticated-identity'] as const;

export function useAuthenticatedIdentity() {
  return useQuery({
    queryKey: authenticatedIdentityKey,
    queryFn: getAuthenticatedIdentity,
    staleTime: 60_000,
    retry: false,
  });
}

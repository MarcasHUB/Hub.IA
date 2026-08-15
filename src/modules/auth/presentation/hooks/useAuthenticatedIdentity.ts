import { useQuery } from '@tanstack/react-query';
import { getAuthenticatedIdentity } from '../../application/services/getAuthenticatedIdentity';
import { privateQueryKeys } from '../../application/query/privateQueryKeys';
import { usePrivateSession } from '../context/PrivateSessionBoundary';

export function useAuthenticatedIdentity() {
  const { authUserId, isTransitioning } = usePrivateSession();
  const query = useQuery({
    queryKey: privateQueryKeys.identity(authUserId || 'signed-out'),
    queryFn: () => getAuthenticatedIdentity(authUserId || undefined),
    enabled: Boolean(authUserId) && !isTransitioning,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const message = error instanceof Error ? error.message : '';
      return failureCount < 2
        && (message.includes('Failed to fetch') || message.includes('NetworkError'));
    },
  });

  return {
    ...query,
    isLoading: isTransitioning || query.isLoading,
  };
}

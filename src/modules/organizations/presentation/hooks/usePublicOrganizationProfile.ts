import { useQuery } from '@tanstack/react-query';
import { OrganizationPublicProfileRepository } from '../../infrastructure/repositories/OrganizationPublicProfileRepository';
import { PublicOrganizationProfile } from '../../domain/entities/PublicOrganizationProfile';

export const publicOrganizationProfileKeys = {
  all: ['public-organization-profile'] as const,
  detail: (id: string) => [...publicOrganizationProfileKeys.all, id] as const,
};

export function usePublicOrganizationProfile(organizationId: string | null | undefined) {
  return useQuery<PublicOrganizationProfile | null, Error>({
    queryKey: publicOrganizationProfileKeys.detail(organizationId || ''),
    queryFn: async () => {
      if (!organizationId) return null;
      const repo = new OrganizationPublicProfileRepository();
      return repo.getPublicProfile(organizationId);
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

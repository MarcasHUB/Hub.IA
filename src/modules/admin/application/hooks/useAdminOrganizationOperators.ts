import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/infrastructure/supabase/client';

export function useAdminOrganizationOperators(organizationId: string | null) {
  return useQuery({
    queryKey: ['admin_organization_operators', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase.rpc('admin_get_organization_operators', {
        p_target_organization_id: organizationId
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });
}

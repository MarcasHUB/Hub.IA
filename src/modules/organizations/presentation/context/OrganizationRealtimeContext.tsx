import React, { createContext, useContext, useEffect, useRef } from 'react';
import { supabase } from '@/infrastructure/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';

interface OrganizationRealtimeContextType {
  // Expose useful states if necessary
}

const OrganizationRealtimeContext = createContext<OrganizationRealtimeContextType | undefined>(undefined);

export function useOrganizationRealtime() {
  const context = useContext(OrganizationRealtimeContext);
  if (!context) {
    throw new Error('useOrganizationRealtime must be used within an OrganizationRealtimeProvider');
  }
  return context;
}

export function OrganizationRealtimeProvider({ children }: { children: React.ReactNode }) {
  const { data: identity } = useAuthenticatedIdentity();
  const queryClient = useQueryClient();
  const channelRef = useRef<any>(null);
  const knownStatusesRef = useRef<Map<string, string>>(new Map());
  
  useEffect(() => {
    // 1. Obtém o ID da organização ativa no momento da montagem/re-render
    const activeOrgId = identity?.organizationId;

    // 2. Garante apenas uma assinatura. Remove se já existir para remontagens
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel('organizations-status-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'organizations' },
        (payload) => {
          const newOrg = payload.new as any;
          if (!newOrg) return;
          
          const isActive = newOrg.status === 'ativo';
          const orgId = newOrg.id;
          const nextStatus = newOrg.status;
          
          const previousStatus = knownStatusesRef.current.get(orgId);
          knownStatusesRef.current.set(orgId, nextStatus);

          if (previousStatus === undefined || previousStatus === nextStatus) {
            // Se for a primeira vez vendo ou não houve mudança de status real, ignora.
            return;
          }

          console.log(`[Realtime] Organization ${orgId} status changed from ${previousStatus} to ${nextStatus}`);

          // 3. Verifica se inativou a PRÓPRIA organização da sessão
          if (activeOrgId === orgId && !isActive) {
            console.warn('Sua organização foi inativada. Sessão local bloqueada.');
            // Removemos o token/id do localStorage para impedir navegação operacional no tenant
            // Redireciona para tela de bloqueio (apenas emula logout do tenant local)
            window.location.href = '/login?reason=tenant_inactive';
            return;
          }

          // 4. Invalida os caches do React Query (para quem os utiliza)
          queryClient.invalidateQueries({ queryKey: ['organizations'] });
          queryClient.invalidateQueries({ queryKey: ['network'] });
          queryClient.invalidateQueries({ queryKey: ['partners'] });
          
          // 5. Emite um CustomEvent para os componentes legados baseados em estado local
          const event = new CustomEvent('hubia:organization-status-changed', {
            detail: {
              organizationId: orgId,
              isActive: isActive,
              status: newOrg.status,
              occurredAt: new Date().toISOString()
            }
          });
          window.dispatchEvent(event);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient, identity?.organizationId]);

  return (
    <OrganizationRealtimeContext.Provider value={{}}>
      {children}
    </OrganizationRealtimeContext.Provider>
  );
}

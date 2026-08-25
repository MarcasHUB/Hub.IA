import type { CanonicalRole } from './roles.ts';

export type Capability =
  | 'company:view'
  | 'company:update'
  | 'operators:view'
  | 'operators:manage'
  | 'network:view'
  | 'connections:request'
  | 'connections:respond'
  | 'connections:cancel-own'
  | 'delegations:view'
  | 'delegations:manage'
  | 'logs:view'
  | 'platform:admin';

const CAPABILITIES: Record<CanonicalRole, ReadonlySet<Capability>> = {
  administrador: new Set([
    'company:view', 'company:update', 'operators:view', 'operators:manage',
    'network:view', 'connections:request', 'connections:respond',
    'connections:cancel-own', 'delegations:view', 'delegations:manage', 'logs:view',
  ]),
  gestor: new Set([
    'company:view', 'operators:view', 'network:view', 'connections:respond',
    'delegations:view', 'delegations:manage',
  ]),
  comprador: new Set([
    'company:view', 'network:view', 'connections:request', 'connections:cancel-own',
  ]),
  solicitante: new Set(['company:view']),
  auditor: new Set(['company:view', 'operators:view', 'logs:view']),
  consulta: new Set(['company:view']),
  platform_admin: new Set(['platform:admin', 'network:view']),
};

export function hasCapability(role: CanonicalRole | null, capability: Capability): boolean {
  return role ? CAPABILITIES[role].has(capability) : false;
}

export function canIdentity(identity: { isPlatformAdmin: boolean; operatorProfile: CanonicalRole | null } | null, capability: Capability): boolean {
  if (!identity) return false;
  if (capability === 'platform:admin') {
    return identity.isPlatformAdmin;
  }
  return hasCapability(identity.operatorProfile, capability);
}

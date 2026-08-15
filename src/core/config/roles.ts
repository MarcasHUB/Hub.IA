export type TenantOperatorProfile =
  | 'administrador'
  | 'gestor'
  | 'comprador'
  | 'solicitante'
  | 'auditor'
  | 'consulta';

export type CanonicalRole = TenantOperatorProfile | 'platform_admin';

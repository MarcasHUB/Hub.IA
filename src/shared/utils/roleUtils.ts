export const getRoleLabel = (role: string | null | undefined): string => {
  if (!role) return 'OPERADOR';
  const r = role.toLowerCase().trim();
  switch (r) {
    case 'auditor':
    case 'auditor/consulta':
    case 'auditor_consulta':
    case 'viewer':
    case 'consulta':
      return 'AUDITOR / CONSULTA';
    case 'buyer':
    case 'comprador':
      return 'COMPRADOR';
    case 'manager':
    case 'gestor':
      return 'GESTOR';
    case 'requester':
    case 'solicitante':
      return 'SOLICITANTE';
    case 'organization_admin':
    case 'administrador':
      return 'ADMINISTRADOR DA EMPRESA';
    case 'platform_admin':
    case 'administrador global':
    case 'super_admin':
      return 'ADMINISTRADOR GLOBAL';
    case 'operator':
    case 'operador':
      return 'OPERADOR';
    default:
      return r.toUpperCase();
  }
};

export const getCompactRoleLabel = (role: string | null | undefined): string => {
  if (!role) return 'OPERADOR';
  const r = role.toLowerCase().trim();
  switch (r) {
    case 'organization_admin':
    case 'admin':
    case 'administrador':
    case 'company_admin':
      return 'ADMINISTRADOR';
    case 'platform_admin':
    case 'global_admin':
    case 'super_admin':
      return 'ADMINISTRADOR GLOBAL';
    default:
      return getRoleLabel(role);
  }
};

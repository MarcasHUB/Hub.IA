import { useParams } from 'react-router-dom';
import CompanyProfileView from '../components/CompanyProfileView';

export default function MinhaEmpresaPage() {
  const { id } = useParams();
  const orgId = id || localStorage.getItem('supplyhub_organization_id') || '';

  if (!orgId) {
    return <div className="p-8">Nenhuma empresa vinculada ao usuário atual.</div>;
  }

  return <CompanyProfileView organizationId={orgId} />;
}

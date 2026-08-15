import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../shared/components/ui/Dialog';
import { Loader2 } from 'lucide-react';
import { usePublicOrganizationProfile } from '../hooks/usePublicOrganizationProfile';

export interface CompanyProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
  mode?: 'view' | 'edit';
  onSaved?: () => void;
}

export function CompanyProfileModal({ open, onOpenChange, organizationId }: CompanyProfileModalProps) {
  const { data: organization, isLoading, isError } = usePublicOrganizationProfile(organizationId || '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{organization?.tradeName || organization?.legalName || 'Perfil da Empresa'}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p>Carregando perfil público...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-red-500">Não foi possível carregar o perfil público.</div>
        ) : organization ? (
          <div className="mt-4 space-y-5 text-sm">
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-2">
              <div><span className="font-semibold text-slate-500">Empresa</span><p className="text-slate-900">{organization.legalName}</p></div>
              <div><span className="font-semibold text-slate-500">Localidade</span><p className="text-slate-900">{[organization.city, organization.state].filter(Boolean).join(' - ') || 'Não informada'}</p></div>
              <div><span className="font-semibold text-slate-500">Perfil comercial</span><p className="text-slate-900">{organization.commercialProfile || 'Não informado'}</p></div>
              <div><span className="font-semibold text-slate-500">Site</span><p className="text-slate-900">{organization.website || 'Não informado'}</p></div>
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Segmentos</h3>
              <p className="mt-1 text-slate-600">{organization.segments.map(item => item.name).join(', ') || 'Nenhum segmento publicado.'}</p>
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Certificações</h3>
              <p className="mt-1 text-slate-600">{organization.certifications.map(item => item.name).join(', ') || 'Nenhuma certificação publicada.'}</p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

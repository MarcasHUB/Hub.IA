import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../shared/components/ui/Dialog';
import { useOrganizationProfile } from '../hooks/useOrganizationProfile';
import { useSaveOrganizationProfile } from '../hooks/useSaveOrganizationProfile';
import { CompanyProfileForm } from './CompanyProfileForm';
import { Loader2 } from 'lucide-react';

export interface CompanyProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
  mode?: 'view' | 'edit';
  onSaved?: () => void;
}

export function CompanyProfileModal({ 
  open, 
  onOpenChange, 
  organizationId, 
  mode = 'view',
  onSaved 
}: CompanyProfileModalProps) {
  const { 
    organization, 
    cnaes, 
    secondaryCnaes, 
    segments, 
    certifications, 
    coverageStates, 
    isLoading,
    isError
  } = useOrganizationProfile(organizationId);

  const { saveProfile } = useSaveOrganizationProfile();
  
  const [key, setKey] = useState(0);

  // Força re-mount do form ao mudar a organização para resetar estados locais e descartar edições.
  useEffect(() => {
    if (organizationId && open) {
      setKey(prev => prev + 1);
    }
  }, [organizationId, open]);

  const handleSave = async (formData: any) => {
    if (!organizationId) return;
    try {
      await saveProfile(organizationId, formData);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      // Aqui idealmente seria adicionado um toast de erro.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {organization?.trade_name || organization?.name || 'Perfil da Empresa'}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p>Carregando dados da empresa...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-red-500">
            <p className="font-bold">Erro ao carregar os dados.</p>
            <p className="text-sm">Tente novamente mais tarde.</p>
          </div>
        ) : organizationId && organization ? (
          <div className="mt-4">
            <CompanyProfileForm
              key={key}
              organizationId={organizationId}
              initialData={organization}
              initialCnaes={cnaes}
              initialSecondaryCnaes={secondaryCnaes}
              initialSegments={segments}
              initialCertifications={certifications}
              initialCoverageStates={coverageStates}
              onSave={handleSave}
              readOnly={mode === 'view'}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

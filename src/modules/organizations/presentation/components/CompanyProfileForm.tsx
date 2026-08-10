import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../../../shared/components/ui/Card';
import { Button } from '../../../../shared/components/ui/Button';
import { Save, CheckCircle2 } from 'lucide-react';
import { CompanyGeneralDataSection } from './sections/CompanyGeneralDataSection';
import { CompanyCommercialDataSection } from './sections/CompanyCommercialDataSection';
import { CompanyAddressSection } from './sections/CompanyAddressSection';
import { supabase } from '../../../../infrastructure/supabase/client';
import { OrganizationProfileData } from '../hooks/useOrganizationProfile';
import { GeographicCoverageType } from '../../domain/types/GeographicCoverageType';
import { ORGANIZATION_LOGO_BUCKET } from '../../application/utils/logoUtils';
import { resolveOrganizationLogoUrl } from '@/shared/utils/logoUtils';
import { calculateOrganizationProfileCompletion } from '../../application/utils/profileCompletion';
import { useQueryClient } from '@tanstack/react-query';
import { organizationProfileKeys } from '../hooks/useOrganizationProfile';
import { uploadPublicImage } from '../../../../shared/utils/uploadImage';
export interface CompanyProfileFormProps {
  organizationId: string;
  initialData: OrganizationProfileData | null;
  initialCnaes: string[];
  initialSecondaryCnaes: string[];
  initialSegments: string[];
  initialCertifications: string[];
  initialCoverageStates: string[];
  onSave: (formData: any) => Promise<void>;
  readOnly?: boolean;
  isSuperAdmin?: boolean;
}

const applyMask = (field: string, value: string) => {
  let v = value.replace(/\D/g, '');
  if (field === 'cnpj') {
    v = v.slice(0, 14);
    return v
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  if (field === 'telefone' || field === 'whatsapp') {
    v = v.slice(0, 11);
    if (v.length === 0) return '';
    if (v.length <= 2) return `(${v}`;
    if (v.length <= 6) return `(${v.slice(0,2)}) ${v.slice(2)}`;
    if (v.length <= 10) return `(${v.slice(0,2)}) ${v.slice(2,6)}-${v.slice(6)}`;
    return `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
  }
  if (field === 'cep') {
    v = v.slice(0, 8);
    if (v.length <= 5) return v;
    return `${v.slice(0,5)}-${v.slice(5)}`;
  }
  return value;
};

export function CompanyProfileForm({
  organizationId,
  initialData,
  initialCnaes,
  initialSecondaryCnaes,
  initialSegments,
  initialCertifications,
  initialCoverageStates,
  onSave,
  readOnly = false,
  isSuperAdmin = false
}: CompanyProfileFormProps) {
  const [activeSubTab, setActiveSubTab] = useState<'gerais'|'comerciais'>('gerais');

  const [form, setForm] = useState({
    commercialProfile: '',
    latitude: '',
    longitude: '',
    tipo_empresa: '',
    coverageRadius: '',
    area_cobertura_estados: '',
    geographicCoverageType: null as GeographicCoverageType | null,
    cnae_principal: '',
    cnaes_secundarios: [] as string[],
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    email_corporativo: '',
    telefone: '',
    whatsapp: '',
    site: '',
    logo_url: '',
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
  });

  const [initialized, setInitialized] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [availableSegments, setAvailableSegments] = useState<{id: string, nome: string}[]>([]);
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>([]);
  const [availableCertifications, setAvailableCertifications] = useState<{id: string, name: string}[]>([]);
  const [sugestoesHubIA, setSugestoesHubIA] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [cepError, setCepError] = useState('');
  const [saved, setSaved] = useState(false);
  const [internalIsSuperAdmin, setInternalIsSuperAdmin] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const effectiveIsSuperAdmin = isSuperAdmin || internalIsSuperAdmin;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (initialData && !initialized) {
      console.log('COMPANY PROFILE ORG', organizationId);
      console.log('COMPANY PROFILE RAW LOGO', initialData.logo_url);
      console.log('COMPANY PROFILE RESOLVED LOGO', resolveOrganizationLogoUrl(initialData.logo_url));

      setForm({
        razao_social: initialData.name || '',
        nome_fantasia: initialData.trade_name || '',
        cnpj: applyMask('cnpj', initialData.document || ''),
        email_corporativo: initialData.commercial_email || '',
        telefone: applyMask('telefone', initialData.phone || ''),
        whatsapp: applyMask('whatsapp', initialData.whatsapp || ''),
        site: initialData.website || '',
        logo_url: initialData.logo_url || '',
        cep: applyMask('cep', initialData.address_zip_code || ''),
        endereco: initialData.address_street || '',
        numero: initialData.address_number || '',
        complemento: initialData.address_complement || '',
        bairro: initialData.address_neighborhood || '',
        cidade: initialData.address_city || '',
        uf: initialData.address_state || '',
        latitude: initialData.latitude?.toString() || '',
        longitude: initialData.longitude?.toString() || '',
        tipo_empresa: initialData.tipo_empresa || '',
        geographicCoverageType: initialData.geographic_coverage_type || null,
        coverageRadius: initialData.raio_atendimento_km?.toString() || '',
        area_cobertura_estados: initialCoverageStates.join(', '),
        cnae_principal: initialData.cnae_principal || '',
        cnaes_secundarios: initialSecondaryCnaes,
        commercialProfile: initialData.commercialProfile || '',
      });
      setSelectedSegments(initialSegments);
      setSelectedCertifications(initialCertifications);
      setInitialized(true);
    }
  }, [initialData, initialized, initialCoverageStates, initialCertifications, initialSecondaryCnaes, initialSegments]);

  useEffect(() => {
    import('../../../employees/infrastructure/repositories/SupabaseSegmentRepository').then(({ SupabaseSegmentRepository }) => {
      const repo = new SupabaseSegmentRepository();
      repo.listSegments(organizationId || 'GLOBAL')
        .then((data) => {
          if (data) setAvailableSegments(data.filter(d => d.status === 'ativo'));
        })
        .catch(err => {
          console.error('[CompanyProfileForm] RLS Error on segments:', err);
        });
    });

    supabase.from('certifications').select('id, name')
      .then(({ data }) => {
        if (data) setAvailableCertifications(data);
      });

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('is_super_admin').eq('user_id', user.id).single().then(({ data }) => {
          if (data?.is_super_admin) {
            setInternalIsSuperAdmin(true);
          }
        });
      }
    });
  }, [organizationId]);

  const handleChange = (field: string, value: any) => {
    const maskedValue = (typeof value === 'string' && ['cnpj', 'telefone', 'whatsapp', 'cep'].includes(field))
      ? applyMask(field, value)
      : value;

    setForm(f => ({ ...f, [field]: maskedValue }));

    if (field === 'cnpj' && typeof maskedValue === 'string') {
      fetchCNPJ(maskedValue);
    }
    if (field === 'cep' && typeof maskedValue === 'string') {
      setCepError('');
      fetchCEP(maskedValue);
    }
    if (field === 'nome_fantasia' && typeof maskedValue === 'string') {
      localStorage.setItem('supplyhub_company_name', maskedValue);
      window.dispatchEvent(new Event('storage'));
    }
  };

  const fetchCEP = async (cepVal: string) => {
    const cleanCEP = cepVal.replace(/\D/g, '');
    if (cleanCEP.length !== 8) return;

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCEP}`);
      if (!response.ok) {
         if (response.status === 404) {
           console.warn(`CEP não encontrado: ${cleanCEP}`);
           setCepError('CEP não encontrado. Verifique o número informado.');
         } else {
           setSaveError('Não foi possível consultar este CEP. Revise o endereço manualmente.');
         }
         return;
      }

      const data = await response.json();

      setForm(f => ({
         ...f,
         endereco: data.street || f.endereco,
         bairro: data.neighborhood || f.bairro,
         cidade: data.city || f.cidade,
         uf: data.state || f.uf,
      }));

      setSaveError('');
      setCepError('');
    } catch (error) {
      console.error("Erro ao buscar CEP na BrasilAPI:", error);
      setSaveError('Não foi possível consultar este CEP. Revise o endereço manualmente.');
    }
  };

  const fetchCNPJ = async (cnpjVal: string) => {
    const cleanCNPJ = cnpjVal.replace(/\D/g, '');
    if (cleanCNPJ.length !== 14) return;

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
      if (!response.ok) {
         setSaveError('Não foi possível consultar os dados do CNPJ. Os demais campos podem ser preenchidos manualmente.');
         return;
      }

      const data = await response.json();
      const cnaePrincipal = data.cnae_fiscal ? `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao}` : '';
      const cnaesSecundarios = data.cnaes_secundarios ? data.cnaes_secundarios.map((c: any) => `${c.codigo} - ${c.descricao}`) : [];

      setForm(f => ({
        ...f,
        razao_social: f.razao_social || data.razao_social || '',
        nome_fantasia: f.nome_fantasia || data.nome_fantasia || data.razao_social || '',
        telefone: f.telefone || data.ddd_telefone_1 || '',
        email_corporativo: f.email_corporativo || data.email || '',
        cep: f.cep || data.cep || '',
        endereco: f.endereco || data.logradouro || '',
        numero: f.numero || data.numero || '',
        complemento: f.complemento || data.complemento || '',
        bairro: f.bairro || data.bairro || '',
        cidade: f.cidade || data.municipio || '',
        uf: f.uf || data.uf || '',
        cnae_principal: f.cnae_principal || cnaePrincipal,
        cnaes_secundarios: f.cnaes_secundarios && f.cnaes_secundarios.length > 0 ? f.cnaes_secundarios : cnaesSecundarios
      }));

      // Apenas sugere IA se o CNAE estiver vazio no form original
      if (!form.cnae_principal && cnaePrincipal.toLowerCase().includes('elétrica')) {
        setSugestoesHubIA(['Indústria Elétrica', 'Materiais Elétricos', 'Automação Industrial']);
      } else if (!form.cnae_principal && (cnaePrincipal.toLowerCase().includes('tecnologia') || cnaePrincipal.toLowerCase().includes('software'))) {
        setSugestoesHubIA(['Tecnologia da Informação', 'Software B2B', 'Serviços em Nuvem']);
      } else if (!form.cnae_principal) {
        setSugestoesHubIA(['Indústria Geral', 'Serviços Corporativos']);
      }

      if (data.cep && data.logradouro) {
         const addressStr = `${data.logradouro}, ${data.numero || ''}, ${data.municipio} - ${data.uf}, ${data.cep}`;
         const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
         if (apiKey) {
            try {
              const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressStr)}&key=${apiKey}`);
              if (geoRes.ok) {
                const geoData = await geoRes.json();
                if (geoData.results && geoData.results[0]) {
                   const loc = geoData.results[0].geometry.location;
                   setForm(f => ({ ...f, latitude: loc.lat.toString(), longitude: loc.lng.toString() }));
                }
              }
            } catch(e) { console.error('Erro na geocodificação', e); }
         }
      }
    } catch (error) {
      console.error("Erro ao buscar CNPJ na BrasilAPI:", error);
      setSaveError('Erro de rede ao consultar o CNPJ.');
    }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setSaveError('O logotipo deve ser PNG, JPG ou WEBP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setSaveError('O logotipo deve possuir no máximo 2 MB.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setSaveError('');

    try {
      setIsUploading(true);
      const oldLogoUrl = form.logo_url;

      const { publicUrl, objectPath } = await uploadPublicImage({
        bucket: ORGANIZATION_LOGO_BUCKET,
        folderPath: `organizations/${organizationId}`,
        file
      });

      const completionInput = {
        razaoSocial: initialData?.name,
        nomeFantasia: initialData?.trade_name,
        cnpj: initialData?.document,
        emailCorporativo: initialData?.commercial_email,
        telefone: initialData?.phone,
        whatsapp: initialData?.whatsapp,
        addressZipCode: initialData?.address_zip_code,
        addressStreet: initialData?.address_street,
        addressNumber: initialData?.address_number,
        addressNeighborhood: initialData?.address_neighborhood,
        city: initialData?.address_city,
        state: initialData?.address_state,
        logoUrl: objectPath,
        website: initialData?.website,
        tipoEmpresa: initialData?.tipo_empresa,
        perfilComercial: initialData?.commercialProfile,
        cnaePrincipal: initialData?.cnae_principal,
        geographicCoverageType: initialData?.geographic_coverage_type,
        raioAtendimentoKm: initialData?.raio_atendimento_km,
        estadosAtendidos: initialCoverageStates,
        segmentIds: initialSegments
      };
      const completionScore = calculateOrganizationProfileCompletion(completionInput);

      const { error: organizationError } = await supabase
        .from('organizations')
        .update({
          logo_url: objectPath,
          profile_completion: completionScore
        })
        .eq('id', organizationId);

      if (organizationError) throw organizationError;

      // Clean up old file if it was successful and exists
      if (oldLogoUrl && oldLogoUrl !== objectPath && oldLogoUrl.startsWith('organizations/')) {
         supabase.storage.from(ORGANIZATION_LOGO_BUCKET).remove([oldLogoUrl]).catch(e => console.error('Failed to cleanup old logo:', e));
      }

      const displayUrl = publicUrl;

      setForm(f => ({ ...f, logo_url: objectPath }));
      if (displayUrl) {
        setPreviewUrl(displayUrl);
      }

      window.dispatchEvent(new CustomEvent('hubia:company-logo-updated', { detail: { logo_url: objectPath } }));

      queryClient.invalidateQueries({ queryKey: organizationProfileKeys.detail(organizationId) });

    } catch (error: any) {
      console.error('Erro ao enviar logo:', error);
      setSaveError(error.message || 'Falha ao salvar logotipo.');
      URL.revokeObjectURL(objectUrl);
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveClick = async () => {
    setIsSaving(true);
    setSaveError('');
    try {
      await onSave({ ...form, selectedSegments, selectedCertifications });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error: any) {
      setSaveError(error.message || 'Erro ao salvar os dados.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl">
        <button
          onClick={() => setActiveSubTab('gerais')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeSubTab === 'gerais' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
        >
          Dados Gerais
        </button>
        <button
          onClick={() => setActiveSubTab('comerciais')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeSubTab === 'comerciais' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
        >
          Informações Comerciais
        </button>
      </div>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="p-6 space-y-6">
          {activeSubTab === 'gerais' && (
            <>
              <CompanyGeneralDataSection
                form={{
                  ...form,
                  logo_url: previewUrl || resolveOrganizationLogoUrl(form.logo_url) || ''
                }}
                onChange={handleChange}
                isUploading={isUploading}
                onUploadLogo={handleUploadLogo}
              />
              <hr className="border-slate-100" />
              {cepError && (
                <div className="bg-red-50 text-red-600 text-xs font-medium px-3 py-2 rounded-lg border border-red-100 animate-in fade-in">
                  {cepError}
                </div>
              )}
              <CompanyAddressSection
                form={form}
                onChange={handleChange}
                readOnly={readOnly}
              />
            </>
          )}

          {activeSubTab === 'comerciais' && (
            <CompanyCommercialDataSection
              form={form}
              onChange={handleChange}
              selectedSegments={selectedSegments}
              availableSegments={availableSegments}
              sugestoesHubIA={sugestoesHubIA}
              selectedCertifications={selectedCertifications}
              availableCertifications={availableCertifications}
              readOnly={readOnly}
              isSuperAdmin={effectiveIsSuperAdmin}
              onAddSegment={seg => setSelectedSegments(prev => prev.includes(seg) ? prev : [...prev, seg])}
              onRemoveSegment={seg => setSelectedSegments(prev => prev.filter(s => s !== seg))}
              onAddCertification={cert => setSelectedCertifications(prev => prev.includes(cert) ? prev : [...prev, cert])}
              onRemoveCertification={cert => setSelectedCertifications(prev => prev.filter(c => c !== cert))}
              onAcceptSuggestions={() => setSelectedSegments(prev => Array.from(new Set([...prev, ...sugestoesHubIA])))}
              onOpenNewSegmentModal={() => {}}
            />
          )}

          {!readOnly && (
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
              {saved && (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg mr-2 animate-in fade-in duration-300">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-xs font-medium">Dados salvos com sucesso</span>
                </div>
              )}
              <Button
                onClick={handleSaveClick}
                disabled={isSaving}
                className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              >
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    Salvando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save className="h-4 w-4" /> Salvar Dados da Empresa
                  </span>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

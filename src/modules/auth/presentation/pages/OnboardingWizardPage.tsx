import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Building2, UserCircle, Briefcase, CheckCircle2, ChevronRight, ChevronLeft, PackageSearch } from 'lucide-react';
import { formatCNPJ } from '@/shared/utils/formatters';

import { supabase } from '@/infrastructure/supabase/client';

export const resolveLogoUrl = (url: string | null | undefined) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return supabase.storage.from('organization-logos').getPublicUrl(url).data.publicUrl;
};

type ResolvedInviteSegment = {
  id: string;
  name: string;
};

type NormalizedCompanyInvite = {
  inviteId: string;
  invitedEmail: string;

  invitedCompany: {
    cnpj: string;
    legalName: string;
    tradeName?: string | null;
    city?: string | null;
    state?: string | null;
    website?: string | null;
    segments?: string[];
  };

  inviterOrganization: {
    id: string;
    legalName: string;
    tradeName?: string | null;
    cnpj: string;
    logoUrl?: string | null;
  };

  inviterUser?: {
    name?: string | null;
  };

  message?: string | null;
  expiresAt?: string | null;
};

type OnboardingInviteState =
  | { status: 'loading' }
  | {
      status: 'ready';
      invite: NormalizedCompanyInvite;
    }
  | {
      status: 'invalid';
      reason:
        | 'not_found'
        | 'expired'
        | 'already_used'
        | 'revoked'
        | 'incomplete'
        | 'organization_exists';
    }
  | {
      status: 'error';
      reason: 'network' | 'rpc' | 'unknown';
      diagnosticCode?: string;
    };

export default function OnboardingWizardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [inviteState, setInviteState] = useState<OnboardingInviteState>({ status: 'loading' });
  const hydratedTokenRef = useRef<string | null>(null);

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Formulário: Empresa
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Formulário: Dados Gerais
  const [site, setSite] = useState('');
  const [emailCorporativo, setEmailCorporativo] = useState('');
  const [telefone, setTelefone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');

  // Formulário: Perfil
  const [perfilRede, setPerfilRede] = useState('');
  const [tipoEmpresa, setTipoEmpresa] = useState('');
  const [perfilComercial, setPerfilComercial] = useState('');
  const [tipoCobertura, setTipoCobertura] = useState('');
  const [cnaePrincipal, setCnaePrincipal] = useState('');
  const [raio, setRaio] = useState('');
  const [resolvedSegments, setResolvedSegments] = useState<ResolvedInviteSegment[]>([]);
  const [globalSegments, setGlobalSegments] = useState<any[]>([]);

  // Formulário: Usuário
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPass, setUserPass] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userPassConfirm, setUserPassConfirm] = useState('');

  // Formulário: BrasilAPI
  const [isConsultingCNPJ, setIsConsultingCNPJ] = useState(false);
  const [cnpjError, setCnpjError] = useState('');
  const [cnpjSuccess, setCnpjSuccess] = useState(false);

  useEffect(() => {
    const fetchSegments = async () => {
      const { supabase } = await import('@/infrastructure/supabase/client');
      const { data, error } = await supabase.from('segments').select('*').is('organization_id', null).order('nome');
      if (data && !error) {
        setGlobalSegments(data);
      }
    };
    fetchSegments();
  }, []);

  const lastQueriedCepRef = useRef('');

  useEffect(() => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length === 8 && cleanCep !== lastQueriedCepRef.current) {
      const needsAddress = !logradouro || !bairro || !cidade || !estado;
      if (needsAddress) {
        lastQueriedCepRef.current = cleanCep;
        fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`)
          .then(res => res.ok ? res.json() : Promise.reject())
          .then(data => {
            setLogradouro(prev => prev || data.street || '');
            setBairro(prev => prev || data.neighborhood || '');
            setCidade(prev => prev || data.city || '');
            setEstado(prev => prev || data.state || '');
          })
          .catch(e => {
            console.error('Erro na consulta de CEP via useEffect', e);
          });
      }
    }
  }, [cep, logradouro, bairro, cidade, estado]);

  const fetchInvite = async (currentToken: string) => {
    try {
      setInviteState({ status: 'loading' });
      hydratedTokenRef.current = currentToken;
      const { supabase } = await import('@/infrastructure/supabase/client');
      const { data, error } = await supabase.rpc('validate_company_invite', { p_token: currentToken });

      if (error) {
        setInviteState({ status: 'error', reason: 'rpc', diagnosticCode: error.code || 'rpc_failed' });
        hydratedTokenRef.current = null;
        return;
      }

      const raw = Array.isArray(data) ? data[0] : data;

      if (!raw || !raw.validation_status) {
        setInviteState({ status: 'error', reason: 'rpc', diagnosticCode: 'missing_status' });
        hydratedTokenRef.current = null;
        return;
      }

      const vStatus = raw.validation_status as string;

      if (['not_found', 'expired', 'already_used', 'revoked', 'incomplete', 'organization_exists'].includes(vStatus)) {
        setInviteState({ status: 'invalid', reason: vStatus as any });
        return;
      }

      if (vStatus !== 'valid') {
        setInviteState({ status: 'error', reason: 'unknown', diagnosticCode: vStatus });
        hydratedTokenRef.current = null;
        return;
      }

      const normalized: NormalizedCompanyInvite = {
        inviteId: raw.id,
        invitedEmail: raw.email ?? '',
        invitedCompany: {
          cnpj: raw.document ?? '',
          legalName: raw.company ?? raw.name ?? '',
          tradeName: raw.name ?? raw.company ?? '',
          city: raw.city ?? '',
          state: raw.state ?? '',
          website: raw.website ?? '',
          segments: Array.isArray(raw.segments) ? raw.segments : [],
        },
        inviterOrganization: {
          id: raw.inviter_id,
          legalName: raw.inviter_company ?? '',
          tradeName: raw.inviter_name ?? '',
          cnpj: raw.inviter_document ?? '',
          logoUrl: raw.inviter_logo_url ?? '',
        },
        inviterUser: {
          name: raw.contact_name ?? '',
        },
        message: raw.message ?? '',
        expiresAt: raw.expires_at ?? '',
      };

      setCnpj(normalized.invitedCompany.cnpj);
      setRazaoSocial(normalized.invitedCompany.legalName);
      setNomeFantasia(normalized.invitedCompany.tradeName ?? '');
      setCidade(normalized.invitedCompany.city ?? '');
      setEstado(normalized.invitedCompany.state ?? '');
      setSite(normalized.invitedCompany.website ?? '');
      setUserEmail(normalized.invitedEmail);
      if (normalized.inviterUser?.name) setUserName(normalized.inviterUser.name);

      // Resolve segments against global catalogue
      if (normalized.invitedCompany.segments && normalized.invitedCompany.segments.length > 0) {
        const { data: catData } = await supabase.from('segments').select('*').is('organization_id', null).eq('status', 'ativo').is('deleted_at', null);
        const resolved: ResolvedInviteSegment[] = [];
        if (catData) {
          normalized.invitedCompany.segments.forEach((segName) => {
            const match = catData.find((c: any) => c.nome.trim().toLowerCase() === segName.trim().toLowerCase());
            if (match) {
              resolved.push({ id: match.id, name: match.nome });
            } else {
              // Even if not found locally, we keep the name for the backend to handle the ONBOARDING_SEGMENT_NOT_FOUND error
              resolved.push({ id: 'unknown', name: segName });
            }
          });
        }
        setResolvedSegments(resolved);
      }

      setInviteState({ status: 'ready', invite: normalized });

      // Auto-preenchimento opcional via BrasilAPI caso não exita na base
      const cleanCNPJ = normalized.invitedCompany.cnpj.replace(/\D/g, '');
      if (cleanCNPJ.length === 14) {
        setIsConsultingCNPJ(true);
        setCnpjError('');
        setCnpjSuccess(false);
        try {
          const { data: orgData, error: rpcError } = await supabase.rpc('find_organization_by_cnpj', { p_cnpj: cleanCNPJ });
          const existingOrg = (Array.isArray(orgData) && orgData.length > 0) ? orgData[0] : (orgData || null);

          if (existingOrg && !rpcError) {
             setRazaoSocial(prev => prev || existingOrg.razao_social || '');
             setNomeFantasia(prev => prev || existingOrg.nome_fantasia || existingOrg.razao_social || '');
             setCidade(prev => prev || existingOrg.city || '');
             setEstado(prev => prev || existingOrg.state || '');
             setSite(prev => prev || existingOrg.website || '');
             setTelefone(prev => prev || existingOrg.telefone || '');
             setEmailCorporativo(prev => prev || existingOrg.email_corporativo || '');
             setCep(prev => prev || existingOrg.address_zip_code || '');
             setLogradouro(prev => prev || existingOrg.address_street || '');
             setNumero(prev => prev || existingOrg.address_number || '');
             setComplemento(prev => prev || existingOrg.address_complement || '');
             setBairro(prev => prev || existingOrg.address_neighborhood || '');
             setCnaePrincipal(prev => prev || existingOrg.cnae_principal || '');
             setCnpjSuccess(true);
          } else {
             const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
             if (res.ok) {
                const data = await res.json();
                const cnae = data.cnae_fiscal ? `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao}` : '';
                setRazaoSocial(prev => prev || data.razao_social || '');
                setNomeFantasia(prev => prev || data.nome_fantasia || data.razao_social || '');
                setTelefone(prev => prev || data.ddd_telefone_1 || '');
                setEmailCorporativo(prev => prev || data.email || '');
                setCep(prev => prev || data.cep || '');
                setLogradouro(prev => prev || data.logradouro || '');
                setNumero(prev => prev || data.numero || '');
                setComplemento(prev => prev || data.complemento || '');
                setBairro(prev => prev || data.bairro || '');
                setCidade(prev => prev || data.municipio || '');
                setEstado(prev => prev || data.uf || '');
                setCnaePrincipal(prev => prev || cnae);
                setCnpjSuccess(true);
             } else {
                setCnpjError('Não foi possível consultar automaticamente. Você pode continuar preenchendo manualmente.');
             }
          }
        } catch (e) {
           console.error('Erro na consulta CNPJ', e);
           setCnpjError('Não foi possível consultar automaticamente. Você pode continuar preenchendo manualmente.');
        } finally {
           setIsConsultingCNPJ(false);
        }
      }
    } catch (err: any) {
      console.error('Error fetching invite:', err);
      setInviteState({ status: 'error', reason: 'network' });
      hydratedTokenRef.current = null;
    }
  };

  useEffect(() => {
    if (!token || hydratedTokenRef.current === token) return;
    void fetchInvite(token);
  }, [token]);


  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      if (inviteState.status !== 'ready') throw new Error('Convite não validado.');

      const { data, error: functionError } = await supabase.functions.invoke('complete-onboarding', {
        body: {
          token: token || '',
          password: userPass,
          fullName: userName,
          role: userRole,
          orgTradeName: nomeFantasia || razaoSocial,
          razaoSocial: razaoSocial,
          cnpj: cnpj,
          website: site || null,
          emailCorporativo,
          telefone,
          whatsapp,
          cep,
          logradouro,
          numero,
          complemento,
          bairro,
          city: cidade,
          state: estado,
          profileType: perfilRede === 'Comprador e Fornecedor' ? 'both' : (perfilRede === 'Comprador' ? 'buyer' : (perfilRede === 'Fornecedor' ? 'supplier' : undefined)),
          tipoEmpresa,
          perfilComercial,
          tipoCobertura,
          raioAtendimentoKm: raio,
          cnaePrincipal,
          segments: resolvedSegments.map(segment => segment.name) // Envia nomes por compatibilidade
        }
      });

      // supabase-js functions.invoke returns HttpError for 400/500 statuses
      if (functionError) {
        // Tenta extrair o código de erro ou a mensagem do corpo da resposta
        let errMsg = functionError.message;
        if (functionError.context && typeof functionError.context.json === 'function') {
          try {
            const errData = await functionError.context.json();
            errMsg = errData.code || errData.message || errData.error || errMsg;
          } catch (e) {}
        }
        throw new Error(errMsg);
      }

      if (data?.code && data.code !== 'SUCCESS') {
        throw new Error(data.code);
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      const orgId = data?.data?.organizationId;
      if (orgId && logoFile) {
        try {
          const { uploadPublicImage } = await import('@/shared/utils/uploadImage');
          const { objectPath } = await uploadPublicImage({
            bucket: 'organization-logos',
            folderPath: `organizations/${orgId}`,
            file: logoFile
          });
          await supabase.from('organizations').update({ logo_url: objectPath }).eq('id', orgId);
          window.dispatchEvent(new CustomEvent('hubia:company-logo-updated', { detail: { logo_url: objectPath } }));
        } catch(e) {
          console.error('Erro upload logo:', e);
          alert('Conta criada, mas não foi possível salvar a logo. Você pode adicioná-la mais tarde em Minha Empresa.');
        }
      }

      setStep(5);
    } catch (e: any) {
      console.error('[Onboarding] Erro Técnico:', e);
      let userMsg = 'Não foi possível concluir seu cadastro. Tente novamente.';
      const msg = e?.message || '';

      if (msg.includes('ONBOARDING_SEGMENT_NOT_FOUND')) {
        userMsg = 'Não foi possível validar um dos segmentos associados ao convite. O segmento não foi encontrado no catálogo global.';
      } else if (msg.includes('ONBOARDING_SEGMENT_AMBIGUOUS')) {
        userMsg = 'O segmento associado ao convite possui duplicidade no catálogo global. Entre em contato com a empresa remetente.';
      } else if (msg.includes('ONBOARDING_INVITE_INVALID') || msg.includes('ALREADY_USED')) {
        userMsg = 'O convite é inválido, incompleto ou já foi utilizado.';
      } else if (msg.includes('ONBOARDING_INVITE_EXPIRED')) {
        userMsg = 'O convite encontra-se expirado.';
      } else if (msg.includes('ONBOARDING_AUTH_USER_EXISTS') || msg.includes('already registered')) {
        userMsg = 'Erro ao criar sua conta de acesso. O e-mail associado ao convite já está em uso na plataforma.';
      } else if (msg.includes('ONBOARDING_PASSWORD_INVALID')) {
        userMsg = 'A senha informada não atende aos requisitos mínimos (mínimo 6 caracteres).';
      } else if (msg.includes('AuthApiError') || msg.includes('sign up')) {
        userMsg = 'Erro ao criar sua conta de acesso.';
      }

      alert(userMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const renderHeader = () => {
    if (inviteState.status === 'loading') {
      return (
        <div className="flex justify-center mb-8 flex-col items-center animate-pulse">
          <div className="h-16 w-32 bg-slate-200 rounded-lg mb-4"></div>
          <div className="h-4 w-48 bg-slate-200 rounded"></div>
        </div>
      );
    }

    if (inviteState.status === 'ready') {
      const invOrg = inviteState.invite.inviterOrganization;
      const nomeEmpresa = invOrg.tradeName || invOrg.legalName;
      const iniciais = nomeEmpresa.substring(0, 2).toUpperCase();
      const resolvedLogo = resolveLogoUrl(invOrg.logoUrl);

      return (
        <div className="flex justify-center mb-8 flex-col items-center text-center px-4">
          <div className="mb-4 relative">
            {resolvedLogo ? (
              <img
                src={resolvedLogo}
                alt={nomeEmpresa}
                className="h-16 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.classList.add('fallback-active');
                }}
              />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-2xl shadow-sm border border-indigo-200">
                {iniciais}
              </div>
            )}
            <div className="fallback-avatar hidden h-16 w-16 rounded-xl bg-indigo-100 flex-col items-center justify-center text-indigo-700 font-bold text-2xl shadow-sm border border-indigo-200">
              {iniciais}
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">Você foi convidado(a) por</p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">{nomeEmpresa}</h1>
          <p className="text-xs text-slate-400 mt-1">CNPJ: {formatCNPJ(invOrg.cnpj)}</p>
          <p className="text-xs text-slate-400 mt-3 flex items-center gap-1 justify-center">
            para se conectar pela <span className="font-bold text-indigo-600">Hub.IA</span>
          </p>
        </div>
      );
    }

    return (
      <div className="flex justify-center mb-8 flex-col items-center">
        <h1 className="text-2xl font-black text-indigo-600 tracking-tight">Hub.IA</h1>
      </div>
    );
  };

  const getInvalidMessage = (reason: string) => {
    switch (reason) {
      case 'not_found':
        return { title: 'Convite não encontrado', desc: 'Este link não corresponde a um convite válido. Verifique se ele foi copiado por completo ou solicite um novo convite.' };
      case 'expired':
        return { title: 'Este convite expirou', desc: 'Solicite à empresa remetente o envio de um novo convite.' };
      case 'already_used':
        return { title: 'Este convite já foi utilizado', desc: 'Caso sua conta já tenha sido criada, acesse a tela de login.' };
      case 'revoked':
        return { title: 'Este convite não está mais disponível', desc: 'Entre em contato com a empresa que enviou o convite.' };
      case 'incomplete':
        return { title: 'Não foi possível utilizar este convite', desc: 'Os dados necessários estão incompletos. Solicite um novo convite.' };
      case 'organization_exists':
        return { title: 'CNPJ já cadastrado', desc: 'Este CNPJ já possui uma empresa cadastrada na Hub.IA. Utilize a empresa existente para solicitar ou aceitar uma conexão.' };
      default:
        return { title: 'Convite inválido', desc: 'Ocorreu um erro ao validar os dados.' };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-3xl">
        {renderHeader()}

        <div className="bg-white shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden border border-slate-100">

          {inviteState.status === 'ready' && (
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center relative overflow-x-hidden">
              <div className="absolute bottom-0 left-0 h-1 bg-indigo-500 transition-all duration-500" style={{ width: `${((step - 1) / 4) * 100}%` }} />

              <div className={`flex flex-col items-center ${step >= 1 ? 'text-indigo-400' : 'text-slate-500'}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold mb-1 ${step >= 1 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>1</div>
                <span className="text-[10px] uppercase font-bold tracking-wider hidden sm:block">Empresa</span>
              </div>
              <div className={`h-0.5 flex-1 mx-1 sm:mx-2 ${step >= 2 ? 'bg-indigo-500/50' : 'bg-slate-800'}`} />

              <div className={`flex flex-col items-center ${step >= 2 ? 'text-indigo-400' : 'text-slate-500'}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold mb-1 ${step >= 2 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>2</div>
                <span className="text-[10px] uppercase font-bold tracking-wider hidden sm:block">Dados Gerais</span>
              </div>
              <div className={`h-0.5 flex-1 mx-1 sm:mx-2 ${step >= 3 ? 'bg-indigo-500/50' : 'bg-slate-800'}`} />

              <div className={`flex flex-col items-center ${step >= 3 ? 'text-indigo-400' : 'text-slate-500'}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold mb-1 ${step >= 3 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>3</div>
                <span className="text-[10px] uppercase font-bold tracking-wider hidden sm:block">Atuação</span>
              </div>
              <div className={`h-0.5 flex-1 mx-1 sm:mx-2 ${step >= 4 ? 'bg-indigo-500/50' : 'bg-slate-800'}`} />

              <div className={`flex flex-col items-center ${step >= 4 ? 'text-indigo-400' : 'text-slate-500'}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold mb-1 ${step >= 4 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>4</div>
                <span className="text-[10px] uppercase font-bold tracking-wider hidden sm:block">Conta</span>
              </div>
              <div className={`h-0.5 flex-1 mx-1 sm:mx-2 ${step >= 5 ? 'bg-indigo-500/50' : 'bg-slate-800'}`} />

              <div className={`flex flex-col items-center ${step >= 5 ? 'text-emerald-400' : 'text-slate-500'}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold mb-1 ${step >= 5 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>5</div>
                <span className="text-[10px] uppercase font-bold tracking-wider hidden sm:block">Sucesso</span>
              </div>
            </div>
          )}

          <div className="p-6 sm:p-8">
            {inviteState.status === 'loading' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="h-8 w-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                <p className="text-slate-500 font-medium text-center">Validando seu convite...</p>
              </div>
            )}

            {inviteState.status === 'invalid' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800">{getInvalidMessage(inviteState.reason).title}</h3>
                <p className="text-slate-500 max-w-sm">{getInvalidMessage(inviteState.reason).desc}</p>
                {inviteState.reason === 'already_used' && (
                  <Button onClick={() => navigate('/login')} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto">Acessar Login</Button>
                )}
              </div>
            )}

            {inviteState.status === 'error' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                  <span className="text-2xl">🚨</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800">Não foi possível validar o convite</h3>
                <p className="text-slate-500 max-w-sm">Encontramos uma falha temporária. Tente novamente.</p>
                <div className="flex gap-3 mt-4 w-full sm:w-auto flex-col sm:flex-row">
                  <Button onClick={() => navigate('/login')} variant="outline" className="w-full sm:w-auto">Voltar ao Login</Button>
                  <Button onClick={() => token && fetchInvite(token)} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto">Tentar Novamente</Button>
                </div>
              </div>
            )}

            {inviteState.status === 'ready' && (
              <>
            {/* ETAPA 1 */}
            {step === 1 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 sm:p-5 mb-6">
                  <h4 className="text-sm font-bold text-indigo-900 mb-2">Convite enviado por</h4>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {resolveLogoUrl(inviteState.invite.inviterOrganization.logoUrl) ? (
                      <img src={resolveLogoUrl(inviteState.invite.inviterOrganization.logoUrl) as string} alt="Logo Remetente" className="h-10 w-10 object-contain rounded-md bg-white border border-slate-100" />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-white border border-slate-200 flex items-center justify-center font-bold text-indigo-700">
                        {(inviteState.invite.inviterOrganization.tradeName || inviteState.invite.inviterOrganization.legalName).substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{inviteState.invite.inviterOrganization.tradeName || inviteState.invite.inviterOrganization.legalName}</p>
                      <p className="text-xs text-slate-500">CNPJ: {formatCNPJ(inviteState.invite.inviterOrganization.cnpj)}</p>
                    </div>
                  </div>
                  {inviteState.invite.inviterUser?.name && (
                    <p className="text-xs text-slate-600 mt-3 pt-3 border-t border-indigo-100/50">
                      <span className="font-semibold">Remetente:</span> {inviteState.invite.inviterUser.name}
                    </p>
                  )}
                  {inviteState.invite.message && (
                    <p className="text-xs text-slate-600 mt-1 italic">
                      "{inviteState.invite.message}"
                    </p>
                  )}
                  <p className="text-xs text-indigo-700 mt-3 font-medium">Complete os dados da sua empresa para criar sua conta e conectar-se à rede de negócios da empresa acima.</p>
                </div>

                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900">Sua Empresa</h2>
                    <p className="text-xs sm:text-sm text-slate-500">Confirme os dados da sua organização.</p>
                  </div>
                </div>

                {isConsultingCNPJ && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-4 flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
                    <p className="text-sm text-indigo-800 font-medium">Consultando dados do CNPJ...</p>
                  </div>
                )}

                {!isConsultingCNPJ && cnpjSuccess && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 mb-4 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <p className="text-sm text-emerald-800">Já encontramos informações do seu convite e do CNPJ. Revise os dados antes de continuar.</p>
                  </div>
                )}

                {!isConsultingCNPJ && cnpjError && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4 flex items-center gap-3">
                    <span className="text-amber-600 text-lg shrink-0">⚠️</span>
                    <p className="text-sm text-amber-800">{cnpjError}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">CNPJ</label>
                    <Input value={formatCNPJ(cnpj)} disabled className="bg-slate-50 text-slate-500 border-slate-200" placeholder="00.000.000/0001-00" />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-700">Razão Social</label>
                    <Input value={razaoSocial} disabled className="bg-slate-50 text-slate-500 border-slate-200" />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-700">Nome Fantasia *</label>
                    <Input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Cidade</label>
                    <Input value={cidade} onChange={e => setCidade(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Estado (UF)</label>
                    <Input value={estado} onChange={e => setEstado(e.target.value)} maxLength={2} />
                  </div>
                </div>

                {resolvedSegments.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <h3 className="text-xs font-bold text-slate-700 mb-3">Segmentos da empresa</h3>
                    <div className="flex flex-wrap gap-2">
                      {resolvedSegments.map((seg) => (
                        <div key={seg.id} className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-sm font-semibold shadow-sm">
                          {seg.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <Button onClick={() => setStep(2)} disabled={!nomeFantasia} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 shadow-md w-full sm:w-auto">
                    Próximo <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

                        {/* ETAPA 2 - DADOS GERAIS */}
            {step === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900">Dados Gerais</h2>
                    <p className="text-xs sm:text-sm text-slate-500">Informações complementares de contato e endereço.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-700">Site (Opcional)</label>
                    <Input value={site} onChange={e => setSite(e.target.value)} placeholder="www.suaempresa.com.br" />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-700">E-mail Corporativo</label>
                    <Input value={emailCorporativo} onChange={e => setEmailCorporativo(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Telefone</label>
                    <Input value={telefone} onChange={e => setTelefone(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">WhatsApp</label>
                    <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">CEP</label>
                    <Input value={cep} onChange={e => setCep(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Bairro</label>
                    <Input value={bairro} onChange={e => setBairro(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-700">Logradouro</label>
                    <Input value={logradouro} onChange={e => setLogradouro(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Número</label>
                    <Input value={numero} onChange={e => setNumero(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Complemento (Opcional)</label>
                    <Input value={complemento} onChange={e => setComplemento(e.target.value)} />
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4">
                  <Button variant="outline" onClick={() => setStep(1)} className="font-bold w-full sm:w-auto">
                    <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                  </Button>
                  <Button onClick={() => setStep(3)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 shadow-md w-full sm:w-auto">
                    Próximo <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ETAPA 3 - ATUAÇÃO */}
            {step === 3 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Briefcase className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900">Atuação</h2>
                    <p className="text-xs sm:text-sm text-slate-500">Defina os papéis que você exercerá na rede.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-bold text-slate-700">Papel na Rede</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {['Comprador', 'Fornecedor', 'Comprador e Fornecedor'].map(p => (
                      <button
                        key={p}
                        onClick={() => setPerfilRede(p)}
                        className={`p-3 text-sm font-semibold rounded-xl border text-left transition-all ${perfilRede === p ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 mt-6">
                  <label className="text-xs font-bold text-slate-700">Tipo de Empresa</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {['Matriz', 'Filial'].map(p => (
                      <button
                        key={p}
                        onClick={() => setTipoEmpresa(p)}
                        className={`p-2.5 text-xs font-semibold rounded-xl border text-center transition-all ${tipoEmpresa === p ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 mt-6">
                  <label className="text-xs font-bold text-slate-700">Perfil Comercial</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {['Indústria / Fabricante', 'Distribuidor / Revenda', 'Consumidor Final', 'Prestador de Serviços', 'Fabricante e Revenda'].map(p => (
                      <button
                        key={p}
                        onClick={() => setPerfilComercial(p)}
                        className={`p-2.5 text-xs font-semibold rounded-xl border text-center transition-all ${perfilComercial === p ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 mt-6 border-t border-slate-100 pt-6">
                  <label className="text-xs font-bold text-slate-700">Tipo de Cobertura</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {['Nacional', 'Regional'].map(r => (
                      <button
                        key={r}
                        onClick={() => setTipoCobertura(r)}
                        className={`p-2.5 text-xs font-semibold rounded-xl border text-center transition-all ${tipoCobertura === r ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 mt-6 border-t border-slate-100 pt-6">
                  <label className="text-xs font-bold text-slate-700">Raio de Atendimento (km) (Opcional)</label>
                  <Input value={raio} onChange={e => setRaio(e.target.value)} type="number" />
                </div>

                <div className="space-y-4 mt-6 border-t border-slate-100 pt-6">
                  <label className="text-xs font-bold text-slate-700">CNAE Principal (Opcional)</label>
                  <Input value={cnaePrincipal} onChange={e => setCnaePrincipal(e.target.value)} />
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4">
                  <Button variant="outline" onClick={() => setStep(2)} className="font-bold w-full sm:w-auto">
                    <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                  </Button>
                  <Button onClick={() => setStep(4)} disabled={!perfilRede} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 shadow-md w-full sm:w-auto">
                    Próximo <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ETAPA 4 - CONTA */}
            {step === 4 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <UserCircle className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900">Conta e Acesso</h2>
                    <p className="text-xs sm:text-sm text-slate-500">Crie seu usuário administrador.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-700">Nome Completo *</label>
                    <Input value={userName} onChange={e => setUserName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-700">E-mail de Acesso (Convite)</label>
                    <Input type="email" value={userEmail} disabled className="bg-slate-50 text-slate-500 border-slate-200" />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-700">Cargo / Função *</label>
                    <Input value={userRole} onChange={e => setUserRole(e.target.value)} placeholder="Ex.: Comprador, Gerente Comercial, Engenheiro, Diretor" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Criar senha *</label>
                    <Input type="password" value={userPass} onChange={e => setUserPass(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Confirmar senha *</label>
                    <Input type="password" value={userPassConfirm} onChange={e => setUserPassConfirm(e.target.value)} />
                    {userPass && userPassConfirm && userPass !== userPassConfirm && (
                      <p className="text-[10px] text-red-500 font-bold mt-1">As senhas não coincidem.</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4">
                  <Button variant="outline" onClick={() => setStep(3)} className="font-bold w-full sm:w-auto">
                    <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                  </Button>
                  <Button onClick={handleFinish} disabled={!userName || !userEmail || !userPass || !userRole || userPass !== userPassConfirm || isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 shadow-md w-full sm:w-auto">
                    {isLoading ? 'Finalizando...' : 'Concluir Cadastro'} {!isLoading && <CheckCircle2 className="h-4 w-4 ml-1" />}
                  </Button>
                </div>
              </div>
            )}

            {/* ETAPA 5 - SUCESSO */}
            {step === 5 && (
              <div className="flex flex-col items-center justify-center text-center py-12 animate-in zoom-in-95 duration-500">
                <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6 ring-8 ring-emerald-50 shrink-0">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">Conta criada com sucesso</h1>
                <p className="text-sm text-slate-500 max-w-sm mb-8">
                  Sua empresa e conta de usuário já fazem parte da maior rede B2B da <span className="font-bold text-slate-700">Hub.IA</span>.
                  <br className="mb-2"/>
                  Você já pode interagir com <span className="font-bold text-slate-700">{inviteState.invite.inviterOrganization.tradeName || inviteState.invite.inviterOrganization.legalName}</span>.
                </p>

                <div className="bg-indigo-50 p-6 rounded-2xl w-full max-w-sm mb-8">
                  <h3 className="text-sm font-bold text-indigo-900 mb-1">Explore a Plataforma</h3>
                  <p className="text-xs text-indigo-700/80 mb-4">Acesse agora e mantenha seu catálogo atualizado.</p>

                  <Button onClick={() => navigate('/login')} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 shadow-lg shadow-indigo-900/20">
                    Acessar a Hub.IA <PackageSearch className="h-5 w-5 ml-2" />
                  </Button>
                </div>
              </div>
            )}
            </>
            )}

          </div>
        </div>
      </div>

      <style>{`
        .fallback-active + .fallback-avatar {
          display: flex !important;
        }
      `}</style>
    </div>
  );
}

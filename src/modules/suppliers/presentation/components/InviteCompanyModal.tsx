import React, { useState, useEffect } from 'react';
import { Building2, X, Loader2, CheckCircle2 } from 'lucide-react';
import { Input } from '@/shared/components/ui/Input';
import { Button } from '@/shared/components/ui/Button';
import { supabase } from '@/infrastructure/supabase/client';
import { maskCNPJ } from '@/shared/utils/formatters';
import { generateRawToken, hashToken } from '@/shared/utils/tokenUtils';

interface InviteCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (companyData: any) => void;
}

export function InviteCompanyModal({ isOpen, onClose, onSuccess }: InviteCompanyModalProps) {
  const [tenantId, setTenantId] = useState<string>('');

  React.useEffect(() => {
    try {
      const orgId = localStorage.getItem('supplyhub_organization_id') || '00000000-0000-0000-0000-000000000000';
      setTenantId(orgId);
    } catch (e) {}
  }, []);
  
  const [newCompName, setNewCompName] = useState('');
  const [newCompDoc, setNewCompDoc] = useState('');
  const [newCompEmail, setNewCompEmail] = useState('');
  const [newCompSeg, setNewCompSeg] = useState('');
  const [newCompCity, setNewCompCity] = useState('');
  const [newCompState, setNewCompState] = useState('');
  const [newCompDesc, setNewCompDesc] = useState('');
  const [newCompContact, setNewCompContact] = useState('');
  const [newCompMessage, setNewCompMessage] = useState('');
  const [isFetchingCnpj, setIsFetchingCnpj] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExistingOrg, setIsExistingOrg] = useState(false);
  const [existingOrgId, setExistingOrgId] = useState<string | null>(null);
  const [isInactive, setIsInactive] = useState(false);
  const [successData, setSuccessData] = useState<{name: string, email: string, emailFailed?: boolean} | null>(null);
  const [globalSegments, setGlobalSegments] = useState<{id: string, nome: string}[]>([]);
  const [existingConnectionStatus, setExistingConnectionStatus] = useState<'none' | 'partner' | 'pending_connection' | 'pending_invite' | 'available' | 'self' | 'ambiguous'>('none');

  useEffect(() => {
    const fetchSegs = async () => {
      const { data } = await supabase.from('segments').select('id, nome').is('organization_id', null).eq('status', 'ativo').is('deleted_at', null).order('nome');
      if (data) setGlobalSegments(data);
    };
    fetchSegs();
  }, []);

  useEffect(() => {
    const handleStatusChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (existingOrgId && customEvent.detail.organizationId === existingOrgId) {
        setIsInactive(!customEvent.detail.isActive);
      }
    };
    window.addEventListener('hubia:organization-status-changed', handleStatusChanged);
    return () => window.removeEventListener('hubia:organization-status-changed', handleStatusChanged);
  }, [existingOrgId]);

  if (!isOpen) return null;

  const matchSegments = (cnaeDesc: string) => {
    const cnae = cnaeDesc.toLowerCase();
    const suggestions = new Set<string>();
    
    if (cnae.includes('pain') && cnae.includes('elétric')) {
      suggestions.add('Material Elétrico');
      suggestions.add('Automação Industrial');
    }
    if (cnae.includes('epi') || cnae.includes('segurança')) {
      suggestions.add('EPIs');
    }
    if (cnae.includes('transporte') || cnae.includes('logística')) {
      suggestions.add('Logística');
    }
    if (cnae.includes('software') || cnae.includes('sistemas')) {
      suggestions.add('TI & Software');
    }
    if (cnae.includes('hardware') || cnae.includes('infraestrutura') || cnae.includes('rede')) {
      suggestions.add('TI & Hardware');
    }
    if (cnae.includes('metalúrgica') || cnae.includes('aço') || cnae.includes('ferro')) {
      suggestions.add('Metalurgia');
    }
    if (cnae.includes('químic') || cnae.includes('plástic')) {
      suggestions.add('Química');
    }
    if (cnae.includes('embalagem') || cnae.includes('papelão')) {
      suggestions.add('Embalagens');
    }
    
    return Array.from(suggestions);
  };

  const handleCnpjBlur = async (e?: React.FocusEvent<HTMLInputElement>) => {
    const docValue = e ? e.target.value : newCompDoc;
    const cleanCnpj = docValue.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return;
    setIsFetchingCnpj(true);
    try {
      const { data: existingOrgs, error } = await supabase
        .rpc('find_organization_by_cnpj', { p_cnpj: cleanCnpj });

      if (error && error.message.includes('ORGANIZATION_CNPJ_AMBIGUOUS')) {
        setIsExistingOrg(true);
        setExistingConnectionStatus('ambiguous');
        setIsFetchingCnpj(false);
        return;
      }

      const existingOrg = existingOrgs && existingOrgs.length > 0 ? existingOrgs[0] : null;

      if (existingOrg) {
        setIsExistingOrg(true);
        setExistingOrgId(existingOrg.id);
        setIsInactive(existingOrg.status === 'inativo');
        setNewCompName(existingOrg.razao_social || existingOrg.nome_fantasia || existingOrg.name || '');
        setNewCompCity(existingOrg.city || '');
        setNewCompState(existingOrg.state || '');
        // Segmentos (no BD o campo é segment)
        setNewCompSeg(existingOrg.segment || '');
        
        // E-mail corporativo (só preenche se não houver um digitado)
        if (existingOrg.email_corporativo || existingOrg.business_email) {
            setNewCompEmail(existingOrg.email_corporativo || existingOrg.business_email || '');
        }

        if (existingOrg.id === tenantId) {
          setExistingConnectionStatus('self');
        } else {
          // Check relationship
          const { data: existingConnection } = await supabase
            .from('connection_requests')
            .select('status')
            .or(`and(requester_company_id.eq.${tenantId},target_company_id.eq.${existingOrg.id}),and(requester_company_id.eq.${existingOrg.id},target_company_id.eq.${tenantId})`)
            .in('status', ['accepted', 'pending'])
            .maybeSingle();

          if (existingConnection) {
            if (existingConnection.status === 'accepted') {
              setExistingConnectionStatus('partner');
            } else {
              setExistingConnectionStatus('pending_connection');
            }
          } else {
             setExistingConnectionStatus('available');
          }
        }

      } else {
        setIsExistingOrg(false);
        setExistingOrgId(null);
        setIsInactive(false);
        
        // Check if there is a pending invite for this CNPJ (case E)
        const { data: pendingInvite } = await supabase
          .from('invitations')
          .select('status')
          .eq('organization_id', tenantId)
          .eq('document', cleanCnpj)
          .eq('status', 'pendente')
          .maybeSingle();
          
        if (pendingInvite) {
           setExistingConnectionStatus('pending_invite');
        } else {
           setExistingConnectionStatus('none');
           const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
           if (response.ok) {
             const data = await response.json();
             setNewCompName(data.razao_social || data.nome_fantasia || '');
             setNewCompCity(data.municipio || '');
             setNewCompState(data.uf || '');
             if (data.cnae_fiscal_descricao) {
               const suggested = matchSegments(data.cnae_fiscal_descricao);
               if (suggested.length > 0) {
                 setNewCompSeg(suggested[0]);
               } else {
                 setNewCompSeg('');
               }
             }
           }
        }
      }
    } catch (e) {
      console.error("Falha ao buscar CNPJ", e);
    } finally {
      setIsFetchingCnpj(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim() || !newCompDoc.trim() || !newCompEmail.trim() || !newCompContact.trim()) return;
    
    setIsSubmitting(true);

    if (isInactive) {
      alert('Esta empresa encontra-se inativa na plataforma. Não é possível enviar convite.');
      setIsSubmitting(false);
      return;
    }

    try {
      // Validação de Duplicidade (Documento ou E-mail)
      const { data: existing } = await supabase
        .from('invitations')
        .select('id, status, document, email')
        .eq('organization_id', tenantId)
        .or(`document.eq.${newCompDoc},email.eq.${newCompEmail}`)
        .in('status', ['pendente', 'aceito'])
        .maybeSingle();

      if (existing) {
        if (existing.status === 'pendente') {
          alert('Esta empresa já possui um convite pendente.');
        } else {
          alert('Esta empresa já faz parte da sua rede de negócios.');
        }
        setIsSubmitting(false);
        return;
      }

      // Validação em connection_requests se a organização já existir no BD
      if (existingOrgId) {
        if (existingConnectionStatus === 'available') {
          // Fluxo direto de Conexão (não é onboarding)
          const { error: connError } = await supabase.from('connection_requests').insert({
            requester_company_id: tenantId,
            target_company_id: existingOrgId,
            status: 'pending'
          });
          if (connError) {
            alert('Erro ao solicitar conexão.');
            setIsSubmitting(false);
            return;
          }
          
          onSuccess({
            id: existingOrgId,
            name: newCompName,
            document: newCompDoc,
            segment: newCompSeg || 'Geral',
            city: newCompCity || 'São Paulo',
            state: newCompState || 'SP',
            status: 'pending_sent',
            email: newCompEmail,
          });
          resetAndClose();
          return;
        }

        const { data: existingConnection } = await supabase
          .from('connection_requests')
          .select('id, status')
          .or(`and(requester_company_id.eq.${tenantId},target_company_id.eq.${existingOrgId}),and(requester_company_id.eq.${existingOrgId},target_company_id.eq.${tenantId})`)
          .in('status', ['accepted', 'pending'])
          .maybeSingle();

        if (existingConnection) {
          if (existingConnection.status === 'pending') {
            alert('Já existe uma solicitação de conexão pendente com esta empresa.');
          } else {
            alert('Esta empresa já está conectada na sua rede de negócios.');
          }
          setIsSubmitting(false);
          return;
        }
      }

      // 1. Gera token rastreável para o fornecedor
      const rawToken = generateRawToken();
      const tokenHash = await hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 dias

      // 2. Insere na tabela 'invitations'
      const { error: inviteError } = await supabase.from('invitations').insert({
        organization_id: tenantId,
        name: newCompName,
        company: newCompName,
        email: newCompEmail,
        document: newCompDoc,
        status: 'pendente',
        token_hash: tokenHash,
        expires_at: expiresAt,
        city: newCompCity,
        state: newCompState,
        contact_name: newCompContact,
        message: newCompMessage,
        segments: newCompSeg ? [newCompSeg] : []
      });

      if (inviteError) {
        alert(`Erro ao criar convite no banco: ${inviteError.message}`);
        setIsSubmitting(false);
        return;
      }

      // 3. Dispara envio de E-mail pela Edge Function reaproveitando a arquitetura
      let emailFailed = false;
      try {
        const { EmailService } = await import('@/shared/utils/EmailService');
        // Envia o RAW token para o email, não o hash!
        const emailRes = await EmailService.sendTransactionalEmail('supplier_invite', rawToken);
        
        if (!emailRes.success) {
          console.warn('Convite salvo, mas falha no envio do e-mail:', emailRes.message);
          emailFailed = true;
        }
      } catch (err) {
        console.error('Erro ao chamar EmailService:', err);
        emailFailed = true;
      }

      setSuccessData({
        name: newCompName,
        email: newCompEmail,
        emailFailed
      });

      onSuccess({
        id: `net-${Date.now()}`,
        name: newCompName,
        document: newCompDoc,
        segment: newCompSeg || 'Geral',
        city: newCompCity || 'São Paulo',
        state: newCompState || 'SP',
        status: 'pending_sent',
        employeesRange: '10–50',
        rating: 0,
        responseTime: '-',
        quotationsCount: 0,
        products: [],
        email: newCompEmail,
        connectionId: '',
        contact_name: newCompContact,
        message: newCompMessage
      });
      
    } catch (e) {
      console.error(e);
      alert('Erro ao enviar o convite. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setNewCompName('');
    setNewCompDoc('');
    setNewCompEmail('');
    setNewCompSeg('');
    setNewCompCity('');
    setNewCompState('');
    setNewCompDesc('');
    setNewCompContact('');
    setNewCompMessage('');
    setSuccessData(null);
    setIsExistingOrg(false);
    setExistingOrgId(null);
    setIsInactive(false);
    setExistingConnectionStatus('none');
    onClose();
  };

  if (successData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
        <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-8 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
          <div className={`h-16 w-16 rounded-full flex items-center justify-center mb-6 ${successData.emailFailed ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2 text-center">
            {successData.emailFailed ? 'Convite criado, mas o e-mail não pôde ser enviado' : 'Convite enviado com sucesso'}
          </h2>
          {successData.emailFailed && (
            <p className="text-sm text-slate-500 text-center mb-4">Você pode tentar reenviar este convite posteriormente através da tela de Rede.</p>
          )}
          
          <div className="w-full bg-slate-50 p-4 rounded-xl space-y-3 mb-6 text-sm text-left">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Empresa</p>
              <p className="font-semibold text-slate-800">{successData.name}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">E-mail</p>
              <p className="font-medium text-slate-600">{successData.email}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase">Status</p>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                  Convite enviado
                </span>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase">Validade</p>
                <p className="font-medium text-slate-600">7 dias</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center mb-6">
            Um e-mail contendo o link de acesso exclusivo foi enviado para o responsável pela empresa.
          </p>

          <Button onClick={resetAndClose} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-11">
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" /> Cadastrar Empresa na Rede B2B
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Adicione empresas para convidar e conectar no ecossistema real.</p>
          </div>
          <button onClick={resetAndClose} className="p-1.5 hover:bg-slate-100 rounded-full">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <form id="inviteForm" onSubmit={handleSubmit} className="p-6 space-y-5">
            
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5 relative">
                <label className="text-xs font-bold text-slate-700">CNPJ *</label>
                <div className="relative">
                  <Input placeholder="Ex: 00.000.000/0001-00" value={newCompDoc} onChange={e => setNewCompDoc(maskCNPJ(e.target.value))} onBlur={handleCnpjBlur} required />
                  {isFetchingCnpj && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" />}
                </div>
                {isExistingOrg && !isInactive && existingConnectionStatus === 'available' && <p className="text-[10px] text-indigo-600 font-medium">Empresa já cadastrada na Hub.IA.</p>}
                {isExistingOrg && !isInactive && existingConnectionStatus === 'partner' && <p className="text-[10px] text-emerald-600 font-medium">Esta empresa já faz parte da sua rede de parceiros.</p>}
                {isExistingOrg && !isInactive && existingConnectionStatus === 'pending_connection' && <p className="text-[10px] text-amber-600 font-medium">Já existe uma solicitação de conexão pendente.</p>}
                {isExistingOrg && !isInactive && existingConnectionStatus === 'self' && <p className="text-[10px] text-red-600 font-medium">Este CNPJ pertence à sua própria empresa.</p>}
                {isExistingOrg && !isInactive && existingConnectionStatus === 'ambiguous' && <p className="text-[10px] text-red-600 font-medium">Encontramos mais de um cadastro para este CNPJ na plataforma. Entre em contato com o suporte da Hub.IA.</p>}
                {!isExistingOrg && existingConnectionStatus === 'pending_invite' && <p className="text-[10px] text-amber-600 font-medium">Já existe um convite pendente para esta empresa.</p>}
                {isInactive && <p className="text-[10px] text-red-600 font-medium">Empresa inativada pelo administrador.</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Razão Social / Nome Fantasia *</label>
                <Input placeholder="Ex: Metalúrgica Norte" value={newCompName} onChange={e => setNewCompName(e.target.value)} required readOnly={isExistingOrg} className={isExistingOrg ? "bg-slate-50 text-slate-500 cursor-not-allowed" : ""} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Nome do Contato Responsável *</label>
                <Input placeholder="Ex: Carlos Silva" value={newCompContact} onChange={e => setNewCompContact(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">E-mail Corporativo *</label>
                <Input type="email" placeholder="contato@fornecedor.com.br" value={newCompEmail} onChange={e => setNewCompEmail(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Segmento de Atuação (Selecione um)</label>
                <select
                  value={newCompSeg}
                  onChange={e => setNewCompSeg(e.target.value)}
                  disabled={isExistingOrg}
                  className={`w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${isExistingOrg ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                >
                  <option value="">Selecione o Segmento Principal</option>
                  {globalSegments.map(seg => (
                    <option key={seg.id} value={seg.nome}>{seg.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Cidade</label>
                <Input placeholder="Ex: São Paulo" value={newCompCity} onChange={e => setNewCompCity(e.target.value)} readOnly={isExistingOrg} className={isExistingOrg ? "bg-slate-50 text-slate-500 cursor-not-allowed" : ""} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Estado (UF)</label>
                <Input placeholder="Ex: SP" value={newCompState} onChange={e => setNewCompState(e.target.value)} maxLength={2} readOnly={isExistingOrg} className={isExistingOrg ? "bg-slate-50 text-slate-500 cursor-not-allowed" : ""} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Mensagem Personalizada (Opcional)</label>
              <textarea 
                placeholder="Ex: Gostaríamos de incluir sua empresa na Rede Hub.IA para futuras oportunidades comerciais."
                value={newCompMessage}
                onChange={e => setNewCompMessage(e.target.value)}
                className="w-full flex min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </form>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <Button type="button" variant="outline" onClick={resetAndClose} className="h-10 text-sm font-semibold">Cancelar</Button>
          <button 
            type="submit" 
            form="inviteForm"
            disabled={isSubmitting || isInactive || existingConnectionStatus === 'self' || existingConnectionStatus === 'ambiguous' || existingConnectionStatus === 'partner' || existingConnectionStatus === 'pending_connection' || existingConnectionStatus === 'pending_invite'}
            className={`flex-1 h-11 rounded-xl text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
              (isInactive || existingConnectionStatus === 'self' || existingConnectionStatus === 'ambiguous' || existingConnectionStatus === 'partner' || existingConnectionStatus === 'pending_connection' || existingConnectionStatus === 'pending_invite')
                ? 'bg-slate-300 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60'
            }`}
          >
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</> : 
              existingConnectionStatus === 'ambiguous' ? 'Suporte Necessário' :
              existingConnectionStatus === 'self' ? 'Operação Inválida' :
              existingConnectionStatus === 'partner' ? 'Empresa já conectada' :
              existingConnectionStatus === 'pending_connection' ? 'Conexão Pendente' :
              existingConnectionStatus === 'pending_invite' ? 'Convite Pendente' :
              existingConnectionStatus === 'available' ? 'Conectar' :
              'Enviar Convite'
            }
          </button>
        </div>
      </div>
    </div>
  );
}

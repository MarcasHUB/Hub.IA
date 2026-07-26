import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/infrastructure/supabase/client';
import { Search, Network, Building2, Mail, MapPin, Globe, CheckCircle2, Clock, ExternalLink, X, Loader2, PackageOpen, LayoutGrid, Package } from 'lucide-react';
import { ClearableInput } from '@/shared/components/ui/ClearableInput';
import { InviteCompanyModal } from '../components/InviteCompanyModal';
import { useNotifications } from '@/modules/notifications/presentation/context/NotificationContext';
import NetworkCompanyModal, { NetworkOrg } from '../components/NetworkCompanyModal';
import { EmailService } from '@/shared/utils/EmailService';

// UUID raiz da organização Hub.IA (SupplyHub Ltda)
const HUB_IA_ORG_ID = 'a0000000-0000-0000-0000-000000000001';

// ─── ConnectConfirmModal ───────────────────────────────────────────────────────

interface ConnectConfirmProps {
  org: NetworkOrg;
  onClose: () => void;
  onConfirm: (email: string, message: string) => Promise<void>;
}

function ConnectConfirmModal({ org, onClose, onConfirm }: ConnectConfirmProps) {
  const displayName = org.razao_social || org.nome_fantasia || org.name;
  const defaultEmail = org.business_email || org.email_corporativo || '';
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Por favor, informe um e-mail corporativo válido.');
      return;
    }
    setIsSending(true);
    setError('');
    try {
      await onConfirm(email.trim(), message.trim());
    } catch (e: any) {
      setError(e.message || 'Erro ao enviar convite.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Conectar com {displayName}</h3>
            <p className="text-sm text-slate-500 mt-1">Enviaremos um convite de parceria por e-mail.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">E-mail corporativo *</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="contato@empresa.com.br"
            className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          {!defaultEmail && (
            <p className="text-xs text-amber-600">Esta empresa não possui e-mail cadastrado. Informe o e-mail de contato.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">Mensagem (opcional)</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Olá! Gostaríamos de estabelecer uma parceria comercial..."
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={isSending}
            className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSending ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><Mail className="h-4 w-4" /> Enviar Convite</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CompanyCard ───────────────────────────────────────────────────────────────

function CompanyCard({
  org,
  onConnect,
  onClick,
}: {
  org: NetworkOrg;
  onConnect: (org: NetworkOrg) => void;
  onClick: (org: NetworkOrg) => void;
}) {
  const displayName = org.razao_social || org.nome_fantasia || org.name;
  const tradeName = org.nome_fantasia || displayName;
  const corporateName = org.razao_social || org.name;
  
  const initials = tradeName.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const roleLabel = (() => {
    const r = (org.profile_type || org.business_model || '').toLowerCase();
    if (r === 'buyer') return 'Comprador';
    if (r === 'seller') return 'Fornecedor';
    if (r === 'both') return 'Comprador & Fornecedor';
    return 'Não informado';
  })();

  const cityState = [org.city, org.state].filter(Boolean).join(' - ');

  return (
    <div 
      className="group relative bg-white border border-slate-200 rounded-2xl flex flex-col transition-all duration-150 ease-out hover:-translate-y-[2px] hover:shadow-lg hover:border-slate-300 h-full"
    >
      <div className="p-5 flex flex-col flex-1">
        {/* Header do Card (Logo + Nomes) */}
        <div className="flex items-start gap-3 mb-4 h-[48px]">
          {org.logo_url ? (
            <img src={org.logo_url} alt="Logo" className="h-12 w-12 rounded-xl object-contain bg-slate-50 border border-slate-100 shrink-0" />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-lg shrink-0">
              {initials}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <button 
              onClick={() => onClick(org)}
              className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 hover:text-indigo-600 cursor-pointer text-left block" 
              title={tradeName}
            >
              {tradeName}
            </button>
            <p className="text-[10px] font-mono text-slate-500 mt-0.5 truncate" title={corporateName}>{corporateName || 'Sem CNPJ'}</p>
          </div>
        </div>
        
        {/* Informações detalhadas */}
        <div className="space-y-2 mb-4 text-xs font-semibold text-slate-600">
          <div className="flex flex-col gap-1.5">
            {cityState && (
              <span className="flex items-center gap-1.5 text-slate-500">
                <MapPin className="h-3.5 w-3.5" /> {cityState}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-slate-500">
              <Building2 className="h-3.5 w-3.5" /> {roleLabel}
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <LayoutGrid className="h-3.5 w-3.5" /> {org.segments_count || 0} Segmentos
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <Package className="h-3.5 w-3.5" /> {org.materials_count || 0} Materiais
            </span>
          </div>
        </div>

        {/* Botões */}
        <div className="mt-auto pt-4 flex gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); onClick(org); }}
            className="w-full bg-slate-50 text-slate-600 hover:bg-slate-100 font-bold text-[11px] px-2 h-9 flex items-center justify-center transition-all rounded-lg border border-slate-200 hover:border-slate-300"
          >
            Ver Perfil
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onConnect(org); }}
            className="w-full bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white font-bold text-[11px] px-2 h-9 flex items-center justify-center transition-all rounded-lg border-none"
          >
            <Network className="h-3.5 w-3.5 mr-1.5" />
            Conectar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── NetworkPage ───────────────────────────────────────────────────────────────

export default function NetworkPage() {
  const [orgs, setOrgs] = useState<NetworkOrg[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<NetworkOrg | null>(null);
  const [connectTarget, setConnectTarget] = useState<NetworkOrg | null>(null);
  const { addMockNotification } = useNotifications();

  const tenantId = localStorage.getItem('supplyhub_organization_id') || '';
  const isHubIA = tenantId === HUB_IA_ORG_ID;

  const loadOrgs = useCallback(async () => {
    setIsLoading(true);
    try {
      // Busca todas as orgs ativas (aceita 'ativo' e 'active' para compatibilidade)
      const { data: orgsData, error } = await supabase
        .from('organizations')
        .select(`
          id, name, razao_social, nome_fantasia, cnpj, city, state, country,
          logo_url, website, description, segment, business_email, email_corporativo,
          phone, telefone, whatsapp, business_model, profile_type, service_radius,
          profile_completion, created_at, status
        `)
        .in('status', ['ativo', 'active'])
        .neq('id', HUB_IA_ORG_ID)
        .order('razao_social', { ascending: true });

      if (error) throw error;

      // Exclui a própria empresa do diretório
      const allOrgs = (orgsData || []).filter(o =>
        !tenantId || tenantId === '00000000-0000-0000-0000-000000000000' || o.id !== tenantId
      );

      // Busca convites existentes (pendentes + aceitos) para marcar status de relacionamento
      let partnerIds = new Set<string>();
      let pendingIds = new Set<string>();

      if (tenantId && tenantId !== '00000000-0000-0000-0000-000000000000') {
        const { data: sentInvites } = await supabase
          .from('invitations')
          .select('company, status')
          .eq('organization_id', tenantId)
          .in('status', ['pendente', 'aceito']);

        (sentInvites || []).forEach(inv => {
          // Tenta encontrar a org pelo nome da empresa no convite
          const matched = allOrgs.find(o =>
            (o.razao_social || o.name || '').toLowerCase() === (inv.company || '').toLowerCase()
          );
          if (matched) {
            if (inv.status === 'aceito') partnerIds.add(matched.id);
            if (inv.status === 'pendente') pendingIds.add(matched.id);
          }
        });
      }

      // Busca a quantidade de materiais de todas as empresas de uma vez
      const { data: mats } = await supabase.from('organization_materials').select('organization_id');
      const matCounts: Record<string, number> = {};
      if (mats) {
        mats.forEach(m => {
          matCounts[m.organization_id] = (matCounts[m.organization_id] || 0) + 1;
        });
      }

      const mapped: NetworkOrg[] = allOrgs.map(o => {
        let segCount = 0;
        if (Array.isArray(o.segment)) segCount = o.segment.length;
        else if (typeof o.segment === 'string') segCount = 1;
        else if (typeof o.segment === 'object' && o.segment) segCount = Object.values(o.segment).length;

        return {
          ...o,
          isPartner: partnerIds.has(o.id),
          hasPendingInvite: pendingIds.has(o.id),
          materials_count: matCounts[o.id] || 0,
          segments_count: segCount,
        };
      });

      setOrgs(mapped);
    } catch (e) {
      console.error('[NetworkPage] Erro ao carregar rede:', e);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  // Filtra: remove parceiros e convites pendentes (eles ficam em "Meus Parceiros")
  const networkOrgs = useMemo(() =>
    orgs.filter(o => !o.isPartner && !o.hasPendingInvite),
    [orgs]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return networkOrgs;
    return networkOrgs.filter(o => {
      const name = (o.razao_social || o.nome_fantasia || o.name || '').toLowerCase();
      const seg  = String(o.segment || '').toLowerCase();
      const city = (o.city || '').toLowerCase();
      const cnpj = (o.cnpj || '').toLowerCase();
      return name.includes(q) || seg.includes(q) || city.includes(q) || cnpj.includes(q);
    });
  }, [networkOrgs, search]);

  // Enviar convite de conexão
  const handleConnect = useCallback(async (org: NetworkOrg) => {
    const email = org.business_email || org.email_corporativo;

    if (!email) {
      // Sem e-mail cadastrado → abre modal pedindo e-mail
      setConnectTarget(org);
      setSelectedOrg(null);
      return;
    }

    // Tem e-mail → confirma via modal (pré-preenchido)
    setConnectTarget(org);
    setSelectedOrg(null);
  }, []);

  const sendInvite = useCallback(async (targetOrg: NetworkOrg, email: string, message: string) => {
    const displayName = targetOrg.razao_social || targetOrg.nome_fantasia || targetOrg.name;

    const tokenHash = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from('invitations').insert({
      organization_id: tenantId,
      name:        displayName,
      company:     displayName,
      email:       email,
      document:    targetOrg.cnpj || '',
      status:      'pendente',
      token_hash:  tokenHash,
      expires_at:  expiresAt,
      city:        targetOrg.city || '',
      state:       targetOrg.state || '',
      message:     message,
      segments:    [],
    });

    if (error) throw new Error(error.message);

    // Envia e-mail de convite
    try {
      await EmailService.sendTransactionalEmail('supplier_invite', tokenHash);
    } catch (emailErr) {
      console.warn('[NetworkPage] E-mail de convite não enviado:', emailErr);
    }

    // Atualiza estado local sem recarregar tudo
    setOrgs(prev => prev.map(o =>
      o.id === targetOrg.id ? { ...o, hasPendingInvite: true } : o
    ));
    setConnectTarget(null);

    addMockNotification({
      title: 'Convite enviado!',
      message: `Convite de parceria enviado para ${displayName}.`,
      type: 'connection_request_received',
      is_read: false,
    });
  }, [tenantId, addMockNotification]);

  return (
    <div className="flex-1 bg-slate-50 min-h-full flex flex-col font-sans">
      {/* HEADER BANNER - EXACT MATCH WITH GLOBAL ADMIN */}
      <div className="bg-slate-900 rounded-2xl mx-6 mt-6 mb-6 px-8 py-8 shadow-md">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Network className="h-7 w-7 text-indigo-400" />
                Rede de Empresas
              </h1>
              <p className="text-slate-400 mt-1 text-sm max-w-2xl">
                Descubra empresas da plataforma Hub.IA e inicie novas parcerias comerciais.
              </p>
            </div>
            {isHubIA && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 px-5 rounded-xl shadow-md transition-colors shrink-0"
              >
                <Mail className="h-4 w-4" />
                Convidar Empresa
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="flex-1 px-6 pb-8">
        <div className="max-w-[1600px] mx-auto space-y-6">
          
          {/* PAINEL SUPERIOR: MÉTRICAS E BUSCA */}
          <div className="flex flex-col xl:flex-row gap-6">
            {/* Indicadores */}
            {!isLoading && (
              <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Empresas</p>
                  <p className="text-xl font-black text-slate-900">{networkOrgs.length}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Fornecedores</p>
                  <p className="text-xl font-black text-emerald-600">
                    {networkOrgs.filter(o => o.profile_type === 'seller' || o.profile_type === 'both' || o.business_model === 'seller' || o.business_model === 'both').length}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Compradores</p>
                  <p className="text-xl font-black text-blue-600">
                    {networkOrgs.filter(o => o.profile_type === 'buyer' || o.profile_type === 'both' || o.business_model === 'buyer' || o.business_model === 'both').length}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Segmentos</p>
                  <p className="text-xl font-black text-indigo-600">
                    {new Set(networkOrgs.flatMap(o => Array.isArray(o.segment) ? o.segment : (typeof o.segment === 'string' ? o.segment.split(',') : Object.values(o.segment || {}))).filter(Boolean)).size}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Materiais</p>
                  <p className="text-xl font-black text-violet-600">
                    {networkOrgs.reduce((acc, o) => acc + (o.materials_count || 0), 0)}
                  </p>
                </div>
              </div>
            )}
            
            {/* Busca */}
            <div className="xl:w-80 shrink-0">
              <div className="relative w-full h-full min-h-[64px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <ClearableInput
                  placeholder="Buscar por nome, segmento..."
                  className="pl-11 bg-white border-slate-200 text-slate-900 placeholder:text-slate-500 h-full rounded-xl focus:border-indigo-500 shadow-sm w-full"
                  value={search}
                  onChange={setSearch}
                  onClear={() => setSearch('')}
                />
              </div>
            </div>
          </div>

          {/* LISTA DE EMPRESAS */}
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-4 border border-slate-200">
                <PackageOpen className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {search ? 'Nenhuma empresa encontrada.' : 'Todas as empresas da rede já são suas parceiras!'}
              </h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-24">
              {filtered.map(o => (
                <CompanyCard
                  key={o.id}
                  org={o}
                  onConnect={handleConnect}
                  onClick={org => setSelectedOrg(org)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalhes */}
      <NetworkCompanyModal
        org={selectedOrg}
        isOpen={!!selectedOrg}
        onClose={() => setSelectedOrg(null)}
        onConnectSuccess={() => {
          loadOrgs();
        }}
      />

      {/* Modal de conexão */}
      {connectTarget && (
        <ConnectConfirmModal
          org={connectTarget}
          onClose={() => setConnectTarget(null)}
          onConfirm={(email, message) => sendInvite(connectTarget, email, message)}
        />
      )}

      {/* Modal de convite Hub.IA */}
      <InviteCompanyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          loadOrgs();
        }}
      />
    </div>
  );
}

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/infrastructure/supabase/client';
import { Search, Network, Building2, Mail, MapPin, Globe, CheckCircle2, Clock, ExternalLink, X, Loader2 } from 'lucide-react';
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
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
  const initials = displayName.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const segmentLabel = (() => {
    if (!org.segment) return null;
    if (Array.isArray(org.segment)) return org.segment.slice(0, 1).join(', ');
    if (typeof org.segment === 'string') return org.segment;
    if (typeof org.segment === 'object') return Object.values(org.segment).slice(0, 1).join(', ');
    return null;
  })();

  const roleLabel = (() => {
    const r = (org.profile_type || org.business_model || '').toLowerCase();
    if (r === 'buyer') return { text: 'Comprador', cls: 'text-blue-600 bg-blue-50' };
    if (r === 'seller') return { text: 'Fornecedor', cls: 'text-emerald-600 bg-emerald-50' };
    if (r === 'both') return { text: 'Comprador & Fornecedor', cls: 'text-violet-600 bg-violet-50' };
    return null;
  })();

  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-200 hover:shadow-lg transition-all duration-200 flex flex-col gap-3 cursor-pointer group"
      onClick={() => onClick(org)}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {org.logo_url ? (
          <img src={org.logo_url} alt={displayName} className="h-11 w-11 rounded-xl object-contain border border-slate-100 flex-shrink-0 bg-white" />
        ) : (
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-800 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm leading-tight truncate group-hover:text-indigo-700 transition-colors">{displayName}</p>
          {org.nome_fantasia && org.nome_fantasia !== displayName && (
            <p className="text-[11px] text-slate-400 truncate">{org.nome_fantasia}</p>
          )}
          {roleLabel && (
            <span className={`inline-flex text-[10px] font-semibold rounded-full px-2 py-0.5 mt-1 ${roleLabel.cls}`}>
              {roleLabel.text}
            </span>
          )}
        </div>
      </div>

      {/* Segmento */}
      {segmentLabel && (
        <p className="text-[11px] text-indigo-600 font-semibold bg-indigo-50 rounded-lg px-2 py-1 truncate">{segmentLabel}</p>
      )}

      {/* Localização e website */}
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        {(org.city || org.state) && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            {[org.city, org.state].filter(Boolean).join(', ')}
          </span>
        )}
        {org.website && (
          <a
            href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
            target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-indigo-400 hover:text-indigo-600 transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <Globe className="h-3 w-3" /><ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>

      {/* Botão de ação e Link */}
      <div className="mt-auto pt-2 flex items-center justify-between gap-3" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onClick(org)}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors px-2 py-1"
        >
          Ver Perfil
        </button>
        <button
          onClick={() => onConnect(org)}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 transition-colors shadow-sm shadow-indigo-600/20"
        >
          <Network className="h-3.5 w-3.5" />
          Conectar
        </button>
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

      const mapped: NetworkOrg[] = allOrgs.map(o => ({
        ...o,
        isPartner: partnerIds.has(o.id),
        hasPendingInvite: pendingIds.has(o.id),
      }));

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

      {/* HEADER BANNER */}
      <div className="bg-slate-900 rounded-[2rem] mx-4 sm:mx-6 mt-6 mb-2 px-6 py-8 shadow-xl">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Network className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-400" />
                Rede de Empresas
              </h1>
              <p className="text-slate-400 mt-1 text-sm max-w-2xl">
                Descubra empresas da plataforma Hub.IA e inicie novas parcerias comerciais.
              </p>
              {!isLoading && (
                <p className="text-slate-500 text-xs mt-2">
                  <span className="text-indigo-400 font-bold">{filtered.length}</span> empresa{filtered.length !== 1 ? 's' : ''} disponíve{filtered.length !== 1 ? 'is' : 'l'} para conectar
                </p>
              )}
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

          {/* Busca */}
          <div className="relative max-w-xl">
            <Search className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
            <ClearableInput
              placeholder="Buscar por nome, segmento, cidade ou CNPJ..."
              className="pl-11 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12 rounded-xl focus:border-indigo-500"
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
            />
          </div>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[1600px] mx-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
              <p className="text-sm">Carregando rede de empresas...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Building2 className="h-14 w-14 mb-4 text-slate-200" />
              <p className="font-medium">
                {search ? 'Nenhuma empresa encontrada para esta busca.' : 'Todas as empresas da rede já são suas parceiras!'}
              </p>
              {search && <p className="text-sm mt-1">Tente outros termos de busca.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/infrastructure/supabase/client';
import { Search, MapPin, Globe, Network, Building2, Mail, ExternalLink } from 'lucide-react';
import { ClearableInput } from '@/shared/components/ui/ClearableInput';
import { InviteCompanyModal } from '../components/InviteCompanyModal';
import { useNotifications } from '@/modules/notifications/presentation/context/NotificationContext';

// UUID raiz da organização Hub.IA (SupplyHub Ltda)
const HUB_IA_ORG_ID = 'a0000000-0000-0000-0000-000000000001';

interface NetworkOrg {
  id: string;
  name: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  website: string | null;
  description: string | null;
  segment: any;
  status: string | null;
  isPartner: boolean; // true se já tem invitação aceita com a empresa logada
}

// ─── CompanyCard ──────────────────────────────────────────────────────────────

function CompanyCard({ org }: { org: NetworkOrg }) {
  const displayName = org.razao_social || org.nome_fantasia || org.name;
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  const segmentLabel = (() => {
    if (!org.segment) return null;
    if (Array.isArray(org.segment)) return org.segment.slice(0, 2).join(', ');
    if (typeof org.segment === 'object') return Object.values(org.segment).slice(0, 2).join(', ');
    return String(org.segment);
  })();

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-200 hover:shadow-lg transition-all duration-200 flex flex-col gap-3 group">
      {/* Header */}
      <div className="flex items-start gap-3">
        {org.logo_url ? (
          <img
            src={org.logo_url}
            alt={displayName}
            className="h-11 w-11 rounded-xl object-contain border border-slate-100 flex-shrink-0"
          />
        ) : (
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{displayName}</p>
          {org.nome_fantasia && org.nome_fantasia !== displayName && (
            <p className="text-[11px] text-slate-400 truncate mt-0.5">{org.nome_fantasia}</p>
          )}
          {org.isPartner && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 mt-1">
              ✓ Parceiro
            </span>
          )}
        </div>
      </div>

      {/* Segmento */}
      {segmentLabel && (
        <p className="text-[11px] text-indigo-600 font-semibold bg-indigo-50 rounded-lg px-2 py-1 line-clamp-1">
          {segmentLabel}
        </p>
      )}

      {/* Descrição */}
      {org.description && (
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{org.description}</p>
      )}

      {/* Localização */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-auto">
        {(org.city || org.state) && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            {[org.city, org.state].filter(Boolean).join(', ')}
          </span>
        )}
        {org.website && (
          <a
            href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-indigo-400 hover:text-indigo-600 transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <Globe className="h-3 w-3" />
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>

      {/* CNPJ */}
      {org.cnpj && (
        <p className="text-[10px] text-slate-300 font-mono">{org.cnpj}</p>
      )}
    </div>
  );
}

// ─── NetworkPage ──────────────────────────────────────────────────────────────

export default function NetworkPage() {
  const [orgs, setOrgs] = useState<NetworkOrg[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { addMockNotification } = useNotifications();

  const tenantId = localStorage.getItem('supplyhub_organization_id') || '';

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        // Busca todas as organizações ativas (diretório aberto), excluindo a própria empresa
        const query = supabase
          .from('organizations')
          .select('id, name, razao_social, nome_fantasia, cnpj, city, state, logo_url, website, description, segment, status')
          .eq('status', 'ativo')
          .order('razao_social', { ascending: true });

        if (tenantId && tenantId !== '00000000-0000-0000-0000-000000000000') {
          query.neq('id', tenantId);
        }

        const { data: orgsData, error } = await query;
        if (error) throw error;

        // Busca quais empresas já são parceiras (invitations aceitas)
        let partnerIds = new Set<string>();
        if (tenantId && tenantId !== '00000000-0000-0000-0000-000000000000') {
          const { data: invData } = await supabase
            .from('invitations')
            .select('organization_id')
            .eq('status', 'aceito');

          // Parceiras: organizations cujo ID aparece como organization_id de um convite aceito da minha org
          // OU eu fui convidado por elas (join via accepted invitations)
          if (invData) {
            // Simplificado: qualquer org que tenha um convite aceito relacionado à minha tenant
            const { data: myAccepted } = await supabase
              .from('invitations')
              .select('company')
              .eq('organization_id', tenantId)
              .eq('status', 'aceito');

            (myAccepted || []).forEach(inv => {
              // Marca como parceira pelo nome (melhor usar UUID quando disponível)
              const matched = (orgsData || []).find(o =>
                (o.razao_social || o.name || '').toLowerCase() === (inv.company || '').toLowerCase()
              );
              if (matched) partnerIds.add(matched.id);
            });
          }
        }

        const mapped: NetworkOrg[] = (orgsData || [])
          .filter(o => o.id !== HUB_IA_ORG_ID) // oculta a própria Hub.IA do diretório
          .map(o => ({
            ...o,
            isPartner: partnerIds.has(o.id),
          }));

        setOrgs(mapped);
      } catch (e) {
        console.error('[NetworkPage] Erro ao carregar rede:', e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [tenantId]);

  // Filtro de busca
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return orgs;
    return orgs.filter(o => {
      const name = (o.razao_social || o.nome_fantasia || o.name || '').toLowerCase();
      const seg = String(o.segment || '').toLowerCase();
      const city = (o.city || '').toLowerCase();
      const cnpj = (o.cnpj || '').toLowerCase();
      return name.includes(q) || seg.includes(q) || city.includes(q) || cnpj.includes(q);
    });
  }, [orgs, search]);

  const partners = filtered.filter(o => o.isPartner);
  const others = filtered.filter(o => !o.isPartner);

  const isHubIA = tenantId === HUB_IA_ORG_ID;

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
                Catálogo de todas as empresas ativas da plataforma Hub.IA. Descubra parceiros e fornecedores.
              </p>
              {!isLoading && (
                <p className="text-slate-500 text-xs mt-2">
                  <span className="text-indigo-400 font-bold">{orgs.length}</span> empresa{orgs.length !== 1 ? 's' : ''} na rede
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {isHubIA && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 px-5 rounded-xl shadow-md transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  Convidar Empresa
                </button>
              )}
            </div>
          </div>

          {/* Busca */}
          <div className="relative max-w-xl">
            <Search className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
            <ClearableInput
              placeholder="Buscar empresa, segmento, cidade, CNPJ..."
              className="pl-11 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12 rounded-xl focus:border-indigo-500 shadow-inner"
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
            />
          </div>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[1600px] mx-auto space-y-10">

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <div className="h-8 w-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm">Carregando rede de empresas...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Building2 className="h-14 w-14 mb-4 text-slate-200" />
              <p className="font-medium">Nenhuma empresa encontrada.</p>
              <p className="text-sm mt-1">Tente ajustar os filtros de busca.</p>
            </div>
          ) : (
            <>
              {/* Parceiros primeiro */}
              {partners.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-emerald-700 uppercase tracking-wider">
                      Seus Parceiros ({partners.length})
                    </h2>
                    <div className="flex-1 h-px bg-emerald-100" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {partners.map(o => <CompanyCard key={o.id} org={o} />)}
                  </div>
                </div>
              )}

              {/* Demais empresas da rede */}
              {others.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                      Empresas da Rede ({others.length})
                    </h2>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {others.map(o => <CompanyCard key={o.id} org={o} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <InviteCompanyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(newCompany: any) => {
          setIsCreateModalOpen(false);
          addMockNotification({
            title: 'Convite enviado com sucesso!',
            message: `O e-mail foi disparado para ${newCompany.email}.`,
            type: 'connection_request_received',
            is_read: false,
          });
        }}
      />
    </div>
  );
}

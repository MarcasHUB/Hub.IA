import { useState, useMemo, useEffect } from 'react';
import { 
  Network, Users, Mail, MailOpen, History, CheckCircle2, 
  XCircle, Clock, Building2, Search 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { ClearableInput } from '@/shared/components/ui/ClearableInput';
import { PartnerCard, Partner } from '../components/PartnerCard';
import { InviteCompanyModal } from '../components/InviteCompanyModal';
import { EditInviteModal } from '../components/EditInviteModal';
import { CompanyDetailsDrawer } from '../components/CompanyDetailsDrawer';
// SupabaseSupplierRepository removido pois utilizaremos apenas dados reais de convites (invitations)

type Tab = 'parceiros' | 'convites_recebidos' | 'convites_enviados' | 'historico';
type StatusFilter = 'Todos' | 'Ativos' | 'Inativos';

export default function SuppliersListPage() {
  const [activeTab, setActiveTab]       = useState<Tab>('parceiros');
  const [partners, setPartners]         = useState<Partner[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [partnerToEdit, setPartnerToEdit] = useState<Partner | null>(null);
  const [partnerDetails, setPartnerDetails] = useState<Partner | null>(null);
  const [tenantId, setTenantId] = useState<string>('');

  useEffect(() => {
    async function load() {
       try {
         const orgId = localStorage.getItem('supplyhub_organization_id') || '00000000-0000-0000-0000-000000000000';
         setTenantId(orgId);
         
         const { supabase } = await import('@/infrastructure/supabase/client');
         
         const { data: invs } = await supabase
            .from('invitations')
            .select('*')
            .eq('organization_id', orgId)
            .in('status', ['pendente']);
            
         // Busca conexões bidirecionais
         const { data: connections, error: connectionsError } = await supabase
            .from('connection_requests')
            .select('*')
            .or(`requester_company_id.eq.${orgId},target_company_id.eq.${orgId}`)
            .eq('status', 'accepted');
            
         const partnerIds = (connections || []).map((c: any) => 
            c.requester_company_id === orgId ? c.target_company_id : c.requester_company_id
         );
            
         const docs = (invs || []).map((i: any) => i.document).filter(Boolean);
         const { data: orgs, error: organizationsError } = await supabase
            .from('organizations')
            .select(`
              *,
              empresa_certificacoes(certifications(name))
            `)
            .or(`cnpj.in.(${docs.length > 0 ? docs.map(d=>`"${d}"`).join(',') : '""'}),id.in.(${partnerIds.length > 0 ? partnerIds.map(p=>`"${p}"`).join(',') : '""'})`)
            .in('status', ['ativo', 'active'])
            .or('is_platform_internal.is.null,is_platform_internal.eq.false');

         console.group('--- DEBUG C1.2.6 SUPPLIERS LIST ---');
         console.log('route:', window.location.pathname);
         console.log('orgId:', orgId);
         console.log('connection_requests data:', connections);
         console.log('connection_requests error:', connectionsError);
         console.log('partner organization ids:', partnerIds);
         console.log('organizations data:', orgs);
         console.log('organizations error:', organizationsError);
         console.groupEnd();
            
         const mappedConnections = (connections || []).map((conn: any) => {
            const partnerId = conn.requester_company_id === orgId ? conn.target_company_id : conn.requester_company_id;
            const org = (orgs || []).find((o: any) => o.id === partnerId);
            return {
              id: conn.id,
              name: org?.razao_social || org?.nome_fantasia || org?.name || 'Empresa Desconhecida',
              document: org?.cnpj || '-',
              segment: org?.segment || 'Não definido',
              city: org?.city || '-',
              state: org?.state || '-',
              status: 'accepted' as const,
              connectionId: conn.id,
              employeesRange: '-',
              rating: 0,
              responseTime: '-',
              quotationsCount: 0,
              products: [],
              email: org?.email_corporativo || org?.business_email,
              contact_name: undefined,
              message: undefined,
              perfil_comercial: org?.perfil_comercial || org?.business_model,
              tipo_empresa: org?.tipo_empresa,
              certifications: org?.empresa_certificacoes ? org.empresa_certificacoes.map((ec: any) => ec?.certifications?.name).filter(Boolean).join(', ') : undefined,
              raio_atendimento_km: org?.raio_atendimento_km,
              score_hubia: undefined,
              phone: org?.telefone || org?.phone,
              website: org?.website
            };
         });
         console.log('--- DEBUG C1.2.6 MAPPED ---');
         console.log('partners mapped:', mappedConnections);
         console.log('---------------------------');
         
         const mappedInvites = (invs || []).map((inv: any) => {
            const org = (orgs || []).find((o: any) => o.cnpj === inv.document);
            return {
              id: inv.id,
              name: org?.razao_social || org?.nome_fantasia || org?.name || inv.company || inv.name,
              document: inv.document,
              segment: org?.segment || ((inv.segments && inv.segments.length > 0) ? inv.segments.join(', ') : 'Não definido'),
              city: org?.city || inv.city || '-',
              state: org?.state || inv.state || '-',
              status: inv.status === 'pendente' ? 'pending_sent' as const : (inv.status as any),
              connectionId: '',
              employeesRange: '-',
              rating: 0,
              responseTime: '-',
              quotationsCount: 0,
              products: [],
              email: org?.email_corporativo || org?.business_email || inv.email,
              contact_name: inv.contact_name,
              message: inv.message,
              perfil_comercial: org?.perfil_comercial || org?.business_model,
              tipo_empresa: org?.tipo_empresa,
              certifications: org?.empresa_certificacoes ? org.empresa_certificacoes.map((ec: any) => ec?.certifications?.name).filter(Boolean).join(', ') : undefined,
              raio_atendimento_km: org?.raio_atendimento_km,
              score_hubia: undefined,
              phone: org?.telefone || org?.phone,
              website: org?.website
            };
         });

         setPartners([...mappedConnections, ...mappedInvites]);
       } catch(e) {
         console.error('Erro ao carregar parceiros:', e);
       }
    }
    load();
  }, []);

  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Todos');

  // ── Filtragem inteligente ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return partners.filter(p => {
      // Filtro de status
      const matchStatus = statusFilter === 'Todos' || 
                         (statusFilter === 'Ativos' && p.status === 'accepted') ||
                         (statusFilter === 'Inativos' && p.status !== 'accepted');
                         
      const q = search.toLowerCase().trim();
      let matchSearch = true;
      if (q) {
        matchSearch = 
          p.name.toLowerCase().includes(q) ||
          p.segment.toLowerCase().includes(q) ||
          p.city.toLowerCase().includes(q) ||
          p.state.toLowerCase().includes(q) ||
          (p.email && p.email.toLowerCase().includes(q)) ||
          p.products.some(prod => prod.toLowerCase().includes(q));
      }
      return matchStatus && matchSearch;
    });
  }, [partners, search, statusFilter]);

  const accepted       = filtered.filter(p => p.status === 'accepted');
  const invitesSent     = filtered.filter(p => p.status === 'pending_sent');
  const invitesReceived = filtered.filter(p => p.status === 'pending_received');

  const handleRemove = async (id: string) => {
    try {
      const { supabase } = await import('@/infrastructure/supabase/client');
      await supabase.from('invitations').delete().eq('id', id);
      const updated = partners.filter(p => p.id !== id);
      setPartners(updated);
    } catch (e) {
      console.error('Erro ao desfazer parceria:', e);
    }
  };
  const handleAccept = async (id: string) => {
    try {
      // Impede duplo clique e mostra loading indireto usando a interface
      const originalPartners = [...partners];
      setPartners(partners.map(p => p.id === id ? { ...p, status: 'accepted' as const, since: 'Processando...' } : p));
      
      const { supabase } = await import('@/infrastructure/supabase/client');
      const { data, error } = await supabase.rpc('accept_company_invitation', {
        p_invitation_id: id
      });

      if (error) {
        console.error('Erro ao aceitar convite:', error);
        alert('Falha ao aceitar convite: ' + error.message);
        setPartners(originalPartners); // rollback UI
        return;
      }
      
      // Recarrega tudo para sincronizar invitations e connection_requests
      const orgId = localStorage.getItem('supplyhub_organization_id') || '00000000-0000-0000-0000-000000000000';
      setTenantId(orgId);
      
      const { data: invs } = await supabase
         .from('invitations')
         .select('*')
         .eq('organization_id', orgId)
         .in('status', ['pendente']);
         
      const { data: connections } = await supabase
         .from('connection_requests')
         .select('*')
         .or(`requester_company_id.eq.${orgId},target_company_id.eq.${orgId}`)
         .eq('status', 'accepted');
         
      const partnerIds = (connections || []).map((c: any) => 
         c.requester_company_id === orgId ? c.target_company_id : c.requester_company_id
      );
         
      const docs = (invs || []).map((i: any) => i.document).filter(Boolean);
      const { data: orgs } = await supabase
         .from('organizations')
         .select(`*, empresa_certificacoes(certifications(name))`)
         .or(`cnpj.in.(${docs.length > 0 ? docs.map(d=>`"${d}"`).join(',') : '""'}),id.in.(${partnerIds.length > 0 ? partnerIds.map(p=>`"${p}"`).join(',') : '""'})`)
         .in('status', ['ativo', 'active'])
         .or('is_platform_internal.is.null,is_platform_internal.eq.false');
         
      const mappedConnections = (connections || []).map((conn: any) => {
         const partnerId = conn.requester_company_id === orgId ? conn.target_company_id : conn.requester_company_id;
         const org = (orgs || []).find((o: any) => o.id === partnerId);
         return {
           id: conn.id,
           name: org?.razao_social || org?.nome_fantasia || org?.name || 'Empresa Desconhecida',
           document: org?.cnpj || '-',
           segment: org?.segment || 'Não definido',
           city: org?.city || '-',
           state: org?.state || '-',
           status: 'accepted' as const,
           connectionId: conn.id,
           employeesRange: '-',
           rating: 0,
           responseTime: '-',
           quotationsCount: 0,
           products: [],
           email: org?.email_corporativo || org?.business_email,
           contact_name: undefined,
           message: undefined,
           perfil_comercial: org?.perfil_comercial || org?.business_model,
           tipo_empresa: org?.tipo_empresa,
           certifications: org?.empresa_certificacoes ? org.empresa_certificacoes.map((ec: any) => ec?.certifications?.name).filter(Boolean).join(', ') : undefined,
           raio_atendimento_km: org?.raio_atendimento_km,
           score_hubia: undefined,
           phone: org?.telefone || org?.phone,
           website: org?.website
         };
      });
      
      const mappedInvites = (invs || []).map((inv: any) => {
         const org = (orgs || []).find((o: any) => o.cnpj === inv.document);
         return {
           id: inv.id,
           name: org?.razao_social || org?.nome_fantasia || org?.name || inv.company || inv.name,
           document: inv.document,
           segment: org?.segment || ((inv.segments && inv.segments.length > 0) ? inv.segments.join(', ') : 'Não definido'),
           city: org?.city || inv.city || '-',
           state: org?.state || inv.state || '-',
           status: inv.status === 'pendente' ? 'pending_sent' as const : (inv.status as any),
           connectionId: '',
           employeesRange: '-',
           rating: 0,
           responseTime: '-',
           quotationsCount: 0,
           products: [],
           email: org?.email_corporativo || org?.business_email || inv.email,
           contact_name: inv.contact_name,
           message: inv.message,
           perfil_comercial: org?.perfil_comercial || org?.business_model,
           tipo_empresa: org?.tipo_empresa,
           certifications: org?.empresa_certificacoes ? org.empresa_certificacoes.map((ec: any) => ec?.certifications?.name).filter(Boolean).join(', ') : undefined,
           raio_atendimento_km: org?.raio_atendimento_km,
           score_hubia: undefined,
           phone: org?.telefone || org?.phone,
           website: org?.website
         };
      });

      setPartners([...mappedConnections, ...mappedInvites]);
    } catch (e: any) {
      console.error('Erro de execução no aceite:', e);
      alert('Falha ao processar aceite: ' + e.message);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { supabase } = await import('@/infrastructure/supabase/client');
      await supabase.from('invitations').update({ status: 'recusado' }).eq('id', id);
      const updated = partners.filter(p => p.id !== id);
      setPartners(updated);
    } catch (e) {
      console.error('Erro ao recusar convite:', e);
    }
  };
  const handleCancel = async (id: string) => {
    try {
      const { supabase } = await import('@/infrastructure/supabase/client');
      await supabase.from('invitations').update({ status: 'cancelado' }).eq('id', id);
      const updated = partners.filter(p => p.id !== id);
      setPartners(updated);
    } catch (e) {
      console.error('Erro ao cancelar convite:', e);
    }
  };

  const SIDEBAR_SECTIONS = [
    {
      title: 'REDE DE NEGÓCIOS',
      items: [
        { id: 'parceiros', label: 'Parceiros', icon: Users, count: accepted.length },
        { id: 'convites_recebidos', label: 'Convites Recebidos', icon: Mail, count: invitesReceived.length },
        { id: 'convites_enviados', label: 'Convites Enviados', icon: MailOpen, count: invitesSent.length },
        { id: 'historico', label: 'Histórico', icon: History }
      ]
    }
  ];



  return (
    <div className="flex-1 bg-slate-50 min-h-full flex flex-col font-sans">
      {/* HERO BANNER INSTITUCIONAL (Sem Busca) */}
      <div className="bg-slate-900 rounded-2xl mx-6 mt-6 mb-6 px-8 py-8 shadow-md flex justify-between items-start">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            Rede de Negócios
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-2xl leading-relaxed">
            Gerencie suas conexões com fornecedores e compradores na plataforma. <br />
            Descubra novos parceiros, acompanhe convites e expanda suas oportunidades comerciais.
          </p>
        </div>
        <Button onClick={() => window.location.href = '/suppliers/network'} className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 font-bold shadow-md shadow-indigo-900/20 shrink-0">
          <Network className="h-4 w-4 mr-1.5" />
          Descobrir Parceiros
        </Button>
      </div>

      {/* CONTEÚDO E SIDEBAR */}
      <div className="flex-1 px-6 pb-8">
        <div className="max-w-[1600px] mx-auto flex gap-6">

          {/* Sidebar de navegação */}
          <aside className="w-56 shrink-0 space-y-6">
            {SIDEBAR_SECTIONS.map((section, idx) => (
              <div key={idx} className="space-y-1">
                <h3 className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{section.title}</h3>
                {section.items.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as Tab)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0" />
                        {tab.label}
                      </span>
                      {tab.count !== undefined && tab.count > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isActive ? 'bg-indigo-400 text-indigo-50' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>

          {/* Área de conteúdo */}
          <main className="flex-1 min-w-0">
            {/* Filtros da listagem */}
            {activeTab !== 'historico' && (
              <div className="mb-6 space-y-4">
                {/* Indicadores */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Parceiros</p>
                    <p className="text-2xl font-black text-slate-900">{accepted.length}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Parceiros Ativos</p>
                    <p className="text-2xl font-black text-emerald-600">{accepted.length}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Convites Pendentes</p>
                    <p className="text-2xl font-black text-amber-500">{invitesSent.length + invitesReceived.length}</p>
                  </div>
                </div>

                {/* Filtro Rápido e Busca */}
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                  
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0 w-full sm:w-auto">
                    {['Todos', 'Ativos', 'Inativos'].map(status => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status as StatusFilter)}
                        className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                          statusFilter === status
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-lg">
                    <div className="relative flex-1 w-full">
                      <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <ClearableInput
                        placeholder="Pesquisar empresas, produtos, segmentos..."
                        value={search}
                        onChange={setSearch}
                        onClear={() => setSearch('')}
                        className="pl-10 h-10 bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white transition-all text-sm w-full rounded-lg"
                      />
                    </div>
                    <Button onClick={() => setIsInviteModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-4 font-bold shrink-0">
                      + Convidar Parceiro
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Conteúdo Dinâmico */}
            {activeTab === 'parceiros' && (
              accepted.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white border border-slate-200 rounded-2xl border-dashed">
                  <Building2 className="h-12 w-12 mb-4 text-slate-300" />
                  <p className="font-medium text-slate-600">Nenhum parceiro encontrado.</p>
                  <p className="text-sm mt-1 text-slate-500">Conecte-se com novas empresas para expandir seus negócios.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {accepted.map(p => (
                    <PartnerCard
                      key={p.id} partner={p}
                      onRemove={handleRemove} onAccept={handleAccept} onReject={handleReject} onCancel={handleCancel}
                      highlight={search}
                      onViewDetails={() => setPartnerDetails(p)}
                    />
                  ))}
                </div>
              )
            )}

            {activeTab === 'convites_recebidos' && (
              invitesReceived.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white border border-slate-200 rounded-2xl border-dashed">
                  <Mail className="h-12 w-12 mb-4 text-slate-300" />
                  <p className="font-medium text-slate-600">Nenhum convite recebido no momento.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {invitesReceived.map(p => (
                    <PartnerCard
                      key={p.id} partner={p}
                      onRemove={handleRemove} onAccept={handleAccept} onReject={handleReject} onCancel={handleCancel}
                      onViewDetails={() => setPartnerDetails(p)}
                    />
                  ))}
                </div>
              )
            )}

            {activeTab === 'convites_enviados' && (
              invitesSent.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white border border-slate-200 rounded-2xl border-dashed">
                  <MailOpen className="h-12 w-12 mb-4 text-slate-300" />
                  <p className="font-medium text-slate-600">Nenhum convite pendente enviado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {invitesSent.map(p => (
                    <PartnerCard
                      key={p.id} partner={p}
                      onRemove={handleRemove} onAccept={handleAccept} onReject={handleReject} onCancel={handleCancel}
                      onEdit={() => setPartnerToEdit(p)}
                      onViewDetails={() => setPartnerDetails(p)}
                    />
                  ))}
                </div>
              )
            )}

            {activeTab === 'historico' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-slate-400 py-32">
                <History className="h-12 w-12 mb-4 text-slate-300" />
                <p className="font-medium text-slate-600">Histórico de Conexões</p>
                <p className="text-sm mt-1 text-slate-500 max-w-sm text-center">Aqui ficará o registro de todas as conexões aceitas, recusadas, expiradas e canceladas da sua organização.</p>
              </div>
            )}
          </main>
        </div>
      </div>

      <InviteCompanyModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={(companyData) => {
          setPartners(prev => [companyData, ...prev]);
        }}
      />
      
      <EditInviteModal
        isOpen={!!partnerToEdit}
        partner={partnerToEdit}
        onClose={() => setPartnerToEdit(null)}
        onSuccess={(updatedData) => {
          setPartners(prev => prev.map(p => p.id === updatedData.id ? updatedData : p));
        }}
      />

      <CompanyDetailsDrawer
        isOpen={!!partnerDetails}
        partner={partnerDetails}
        onClose={() => setPartnerDetails(null)}
      />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '@/infrastructure/supabase/client';
import { Building2, Search, PackageOpen, Shield, Users, CheckCircle, XCircle, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { ClearableInput } from '@/shared/components/ui/ClearableInput';
import { InviteCompanyModal } from '../../../suppliers/presentation/components/InviteCompanyModal';
import { OrganizationDetailsModal } from '../components/OrganizationDetailsModal';
import { EntityCard } from '@/shared/components/ui/EntityCard'; // We might use EntityCard or build custom

interface Organization {
  id: string;
  name: string;
  trade_name: string;
  cnpj: string;
  profile_type: string;
  profile_completion: number;
  status: string;
  logo_url: string | null;
  segment: string[] | string | null;
  operatorCount: number;
  activeOperatorCount: number;
  inactiveOperatorCount: number;
}

export default function OrganizationsListPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*, operators(id, status)')
        .order('name');
      
      if (error) throw error;
      
      if (data) {
        setOrganizations(data.map(org => {
          const ops = org.operators || [];
          return {
            ...org,
            id: org.id,
            name: org.razao_social || org.name || 'Sem Razão Social',
            trade_name: org.nome_fantasia || org.trade_name || org.name || 'Sem Nome Fantasia',
            cnpj: org.cnpj || '',
            profile_type: org.profile_type || org.business_model || 'Não definido',
            profile_completion: org.profile_completion || 0,
            status: org.status || 'ativo',
            logo_url: org.logo_url,
            segment: org.segment,
            operatorCount: ops.length,
            activeOperatorCount: ops.filter((o: any) => o.status === 'ativo').length,
            inactiveOperatorCount: ops.filter((o: any) => o.status === 'inativo' || o.status === 'cancelado').length,
          };
        }));
      }
    } catch (err) {
      console.error('Erro ao carregar organizações:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleStatus = async (orgId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo';
    const { error } = await supabase.from('organizations').update({ status: newStatus }).eq('id', orgId);
    if (!error) {
      setOrganizations(prev => prev.map(o => o.id === orgId ? { ...o, status: newStatus } : o));
    }
  };

  const filteredOrgs = organizations.filter(org => 
    org.name.toLowerCase().includes(search.toLowerCase()) || 
    org.trade_name.toLowerCase().includes(search.toLowerCase()) || 
    org.cnpj.includes(search)
  );

  const activeCount = organizations.filter(o => o.status === 'ativo').length;
  const inactiveCount = organizations.filter(o => o.status !== 'ativo').length;
  const completeCount = organizations.filter(o => o.profile_completion === 100).length;
  const incompleteCount = organizations.filter(o => o.profile_completion < 100).length;
  const totalCount = organizations.length;

  return (
    <div className="flex-1 bg-slate-50 min-h-full flex flex-col font-sans">
      <div className="bg-slate-900 rounded-2xl mx-6 mt-6 mb-4 px-8 py-8 shadow-md">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Building2 className="h-7 w-7 text-indigo-400" />
                Master de Empresas
              </h1>
              <p className="text-slate-400 mt-1 text-sm max-w-2xl">
                Gestão global de todas as organizações cadastradas na Rede Hub.IA.
              </p>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <Button onClick={() => setIsInviteModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 font-bold shadow-md shadow-indigo-900/20">
                Nova Empresa
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-slate-800">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Empresas Ativas</p>
              <p className="text-2xl font-black text-emerald-400">{activeCount}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Empresas Inativas</p>
              <p className="text-2xl font-black text-slate-300">{inactiveCount}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Cad. Completo</p>
              <p className="text-2xl font-black text-indigo-400">{completeCount}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Cad. Incompleto</p>
              <p className="text-2xl font-black text-amber-400">{incompleteCount}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Empresas</p>
              <p className="text-2xl font-black text-white">{totalCount}</p>
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
              <ClearableInput 
                placeholder="Busque por Razão Social, Nome Fantasia ou CNPJ..." 
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                className="pl-11 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-11 rounded-xl focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[1600px] mx-auto">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : filteredOrgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-4 border border-slate-200">
                <PackageOpen className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Nenhuma empresa encontrada.</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 pb-24">
              {filteredOrgs.map(org => {
                let segments: string[] = [];
                if (Array.isArray(org.segment)) {
                  segments = org.segment;
                } else if (typeof org.segment === 'string') {
                  segments = org.segment.split(',').map(s => s.trim()).filter(Boolean);
                }

                return (
                  <div 
                    key={org.id}
                    className="group relative bg-white border border-slate-200 rounded-2xl flex flex-col transition-all duration-150 ease-out hover:-translate-y-[2px] hover:shadow-lg hover:border-slate-300 h-full"
                  >
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex items-start gap-3 mb-4 h-[48px]">
                        {org.logo_url ? (
                          <img src={org.logo_url} alt="Logo" className="h-12 w-12 rounded-xl object-contain bg-slate-50 border border-slate-100 shrink-0" />
                        ) : (
                          <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-lg shrink-0">
                            {org.trade_name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <button 
                            onClick={() => setSelectedOrg(org)}
                            className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 hover:text-indigo-600 cursor-pointer text-left block" 
                            title={org.name}
                          >
                            {org.trade_name}
                          </button>
                          <p className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">{org.cnpj || 'Sem CNPJ'}</p>
                        </div>
                      </div>
                      
                      {/* Área Fixa para Segmentos */}
                      <div className="flex flex-wrap gap-1.5 mb-3 min-h-[24px] items-start">
                        {segments.length > 0 ? (
                          <>
                            {segments.slice(0, 2).map((seg, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold uppercase tracking-wider rounded flex items-center whitespace-nowrap">
                                {seg}
                              </span>
                            ))}
                            {segments.length > 2 && (
                              <span className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[9px] font-bold uppercase tracking-wider rounded flex items-center">
                                +{segments.length - 2}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-50 text-slate-400 text-[9px] font-bold uppercase tracking-wider rounded flex items-center italic">
                            Nenhum Segmento
                          </span>
                        )}
                      </div>
                      
                      {/* Área Fixa para Operadores */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center justify-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 w-full">
                          <Users className="h-3 w-3 text-slate-400" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">{org.operatorCount} Operadores</span>
                        </div>
                      </div>

                      {/* Status e Cadastro */}
                      <div className="flex flex-col gap-2 mb-4 mt-auto">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                            Progresso
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            org.profile_completion === 100 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {org.profile_completion === 100 ? 'Completo' : `${org.profile_completion}%`}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-full">
                          <div 
                            className={`h-full transition-all duration-300 ${org.profile_completion === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                            style={{ width: `${org.profile_completion}%` }}
                          />
                        </div>
                      </div>

                      {/* Ações: Editar e Ativar/Inativar */}
                      <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                        <button
                          onClick={() => setSelectedOrg(org)}
                          className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 py-1.5 rounded-lg transition-colors"
                        >
                          <Edit2 className="h-3 w-3" /> Editar
                        </button>
                        <button
                          onClick={() => toggleStatus(org.id, org.status)}
                          className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold py-1.5 rounded-lg transition-colors ${
                            org.status === 'ativo'
                              ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                              : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {org.status === 'ativo'
                            ? <><ToggleLeft className="h-3 w-3" /> Inativar</>
                            : <><ToggleRight className="h-3 w-3" /> Ativar</>
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <InviteCompanyModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={() => {
          loadData();
        }}
      />
      
      <OrganizationDetailsModal
        isOpen={!!selectedOrg}
        onClose={() => setSelectedOrg(null)}
        organization={selectedOrg}
        onSaved={loadData}
      />
    </div>
  );
}

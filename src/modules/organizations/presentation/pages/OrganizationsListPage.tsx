import { useState, useEffect } from 'react';
import { supabase } from '@/infrastructure/supabase/client';
import { Building2, Search, PackageOpen, Shield, Users, CheckCircle, XCircle } from 'lucide-react';
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 pb-24">
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
                    className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col transition-all hover:shadow-lg hover:border-slate-300"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      {org.logo_url ? (
                        <img src={org.logo_url} alt="Logo" className="h-12 w-12 rounded-xl object-contain bg-slate-50 border border-slate-100" />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-lg">
                          {org.trade_name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <button 
                          onClick={() => setSelectedOrg(org)}
                          className="font-bold text-slate-900 text-base leading-tight truncate hover:text-indigo-600 hover:underline block text-left" 
                          title={org.name}
                        >
                          {org.trade_name}
                        </button>
                        <p className="text-xs font-mono text-slate-500 mt-1">{org.cnpj || 'Sem CNPJ'}</p>
                      </div>
                    </div>
                    
                    {segments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {segments.slice(0, 3).map((seg, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded flex items-center">
                            [ {seg} ]
                          </span>
                        ))}
                        {segments.length > 3 && (
                          <span className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[10px] font-bold rounded">
                            +{segments.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">{org.operatorCount} Operadores</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center gap-2">
                        <Shield className={`h-4 w-4 ${org.profile_completion === 100 ? 'text-emerald-500' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold text-slate-700">
                          {org.profile_completion === 100 ? 'Cadastro Completo' : `Cadastro ${org.profile_completion}% Completo`}
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setSelectedOrg(org)}
                        className="flex-1 h-9 text-xs font-bold bg-white"
                      >
                        Editar Empresa
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => toggleStatus(org.id, org.status)}
                        className={`h-9 px-4 text-xs font-bold border-slate-200 ${
                          org.status === 'ativo' 
                            ? 'text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200' 
                            : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200'
                        }`}
                      >
                        {org.status === 'ativo' ? 'Inativar' : 'Ativar'}
                      </Button>
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

import { useState, useEffect } from 'react';
import { supabase } from '@/infrastructure/supabase/client';
import { Building2, Search, PackageOpen, MoreVertical, Shield } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { ClearableInput } from '@/shared/components/ui/ClearableInput';
import { Badge } from '@/shared/components/ui/Badge';

interface Organization {
  id: string;
  name: string;
  trade_name: string;
  document: string;
  company_role: string;
  profile_completion: number;
}

export default function OrganizationsListPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from('organizations').select('*').order('name');
        if (error) throw error;
        
        if (data) {
          setOrganizations(data.map(org => ({
            id: org.id,
            name: org.name || 'Sem Razão Social',
            trade_name: org.trade_name || org.name || 'Sem Nome Fantasia',
            document: org.document || 'Sem CNPJ',
            company_role: org.company_role || 'Não definido',
            profile_completion: org.profile_completion || 0
          })));
        }
      } catch (err) {
        console.error('Erro ao carregar organizações:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredOrgs = organizations.filter(org => 
    org.name.toLowerCase().includes(search.toLowerCase()) || 
    org.trade_name.toLowerCase().includes(search.toLowerCase()) || 
    org.document.includes(search)
  );

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
              <Button onClick={() => alert('Em breve')} className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 font-bold shadow-md shadow-indigo-900/20">
                Nova Empresa
              </Button>
            </div>
          </div>

          <div className="flex gap-4">
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
              {filteredOrgs.map(org => (
                <div 
                  key={org.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col transition-all hover:shadow-lg hover:border-slate-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-lg">
                      {org.trade_name.substring(0, 2).toUpperCase()}
                    </div>
                    <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-medium px-2 py-0.5 text-[10px]">
                      {org.company_role.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-base leading-tight line-clamp-1" title={org.name}>
                      {org.trade_name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{org.name}</p>
                    <p className="text-xs font-mono text-slate-400 mt-2">{org.document}</p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs font-semibold text-slate-700">Perfil {org.profile_completion}%</span>
                    </div>
                    <button className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


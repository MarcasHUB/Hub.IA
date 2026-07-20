import { useState, useEffect } from 'react';
import { Shield, ShieldAlert, User, Building2, ToggleLeft, ToggleRight, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/infrastructure/supabase/client';
import { Input } from '@/shared/components/ui/Input';
import { Card, CardContent } from '@/shared/components/ui/Card';

type GlobalUser = {
  id: string;
  email: string;
  full_name: string;
  is_superadmin: boolean;
  organization_id: string;
  organizations?: {
    name: string;
  };
};

export default function GlobalAdminPage() {
  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    checkAccessAndLoadUsers();
  }, []);

  const checkAccessAndLoadUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: currentUser } = await supabase
        .from('users')
        .select('is_superadmin')
        .eq('id', user.id)
        .single();

      if (!currentUser?.is_superadmin) {
        setIsSuperAdmin(false);
        setIsLoading(false);
        return;
      }

      setIsSuperAdmin(true);
      await loadUsers();
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('users')
      .select('*, organizations(name)')
      .order('full_name');
    
    if (data) {
      setUsers(data as unknown as GlobalUser[]);
    }
    setIsLoading(false);
  };

  const toggleSuperAdmin = async (userId: string, currentStatus: boolean, userName: string) => {
    const newStatus = !currentStatus;
    
    // Atualização otimista
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_superadmin: newStatus } : u));

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_superadmin: newStatus })
        .eq('id', userId);

      if (error) throw error;

      // Log de auditoria
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: myUser } = await supabase.from('users').select('full_name, organization_id').eq('id', user.id).single();
        if (myUser) {
          await supabase.from('logs').insert({
            organization_id: myUser.organization_id, // Para não violar constraints de org
            operator_id: user.id,
            action: newStatus ? 'promote_superadmin' : 'demote_superadmin',
            details: `O usuário ${myUser.full_name} ${newStatus ? 'concedeu' : 'removeu'} privilégio SuperAdmin para o usuário: ${userName}`,
            ip_address: '127.0.0.1'
          });
        }
      }
    } catch (error: any) {
      console.error('Erro ao alterar privilégio:', error);
      alert('Erro ao alterar privilégio. ' + (error.message || ''));
      // Rollback otimista
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_superadmin: currentStatus } : u));
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.organizations?.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex">
            <ShieldAlert className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Acesso Negado</h3>
              <p className="text-sm text-red-700 mt-2">Você não possui privilégios de SuperAdmin para acessar esta página.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Administração Global</h1>
          <p className="text-slate-500">Gerenciamento de acesso e governança mestre da plataforma Hub.IA</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-slate-400" />
              Usuários da Plataforma ({filteredUsers.length})
            </h2>
            <div className="w-full sm:w-72 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Buscar usuário, email ou empresa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-3 px-4 text-sm font-medium text-slate-500">Usuário</th>
                  <th className="py-3 px-4 text-sm font-medium text-slate-500">Empresa (Tenant)</th>
                  <th className="py-3 px-4 text-sm font-medium text-slate-500">Acesso</th>
                  <th className="py-3 px-4 text-sm font-medium text-slate-500 text-right">Governança Global</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{u.full_name}</div>
                      <div className="text-sm text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-700">{u.organizations?.name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.is_superadmin 
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {u.is_superadmin ? 'SuperAdmin' : 'Usuário Padrão'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => toggleSuperAdmin(u.id, u.is_superadmin, u.full_name)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                          u.is_superadmin 
                            ? 'text-purple-700 hover:bg-purple-50'
                            : 'text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-sm font-medium">
                          {u.is_superadmin ? 'Ativo' : 'Inativo'}
                        </span>
                        {u.is_superadmin ? (
                          <ToggleRight className="w-6 h-6 text-purple-600" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-slate-400" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredUsers.length === 0 && (
              <div className="py-12 text-center text-slate-500">
                Nenhum usuário encontrado na plataforma.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { User, Building2, ToggleLeft, ToggleRight, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/infrastructure/supabase/client';
import { Input } from '@/shared/components/ui/Input';
import { Card, CardContent } from '@/shared/components/ui/Card';

type GlobalUser = {
  id: string;
  email: string;
  full_name: string;
  is_super_admin: boolean;
  organization_id: string;
  organizations?: {
    name: string;
  };
};

export default function GlobalUsersTab() {
  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*, organizations(name)')
      .order('full_name');
    
    if (data) {
      setUsers(data as unknown as GlobalUser[]);
    }
    setIsLoading(false);
  };

  const toggleSuperAdmin = async (userId: string, currentStatus: boolean, userName: string) => {
    const newStatus = !currentStatus;
    
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_super_admin: newStatus } : u));

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_super_admin: newStatus })
        .eq('id', userId);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: myUser } = await supabase.from('profiles').select('full_name, organization_id').eq('id', user.id).single();
        if (myUser) {
          await supabase.from('logs').insert({
            organization_id: myUser.organization_id,
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
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_super_admin: currentStatus } : u));
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.organizations?.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
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
                      u.is_super_admin 
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {u.is_super_admin ? 'SuperAdmin' : 'Usuário Padrão'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => toggleSuperAdmin(u.id, u.is_super_admin, u.full_name)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                        u.is_super_admin 
                          ? 'text-purple-700 hover:bg-purple-50'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-sm font-medium">
                        {u.is_super_admin ? 'Ativo' : 'Inativo'}
                      </span>
                      {u.is_super_admin ? (
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
  );
}

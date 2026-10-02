import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clipboard,
  Clock3,
  ExternalLink,
  MonitorSmartphone,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Users,
  Wifi,
} from 'lucide-react';
import { supabase } from '@/infrastructure/supabase/client';

type MobileAccessUser = {
  user_id: string;
  organization_id: string;
  organization_name: string;
  name: string;
  email: string;
  profile: string;
  operator_status: string;
  access_channel: 'mobile' | 'both';
  preferred_interface: 'web' | 'mobile';
  is_active: boolean;
  last_login_at: string | null;
  last_activity_at: string | null;
  accepted_at: string | null;
};

const profileLabel = (profile: string) => {
  const labels: Record<string, string> = {
    solicitante: 'Solicitante',
    comprador: 'Comprador',
    gestor: 'Gestor',
    administrador: 'Administrador',
    auditor: 'Auditor',
  };
  return labels[profile] || profile;
};

const formatDateTime = (value: string | null) => {
  if (!value) return 'Nunca';
  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
};

export default function AppCampoAdminPage() {
  const [users, setUsers] = useState<MobileAccessUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const appUrl = typeof window !== 'undefined' ? `${window.location.origin}/pwa-choice` : 'https://supplyhub.ia.br/pwa-choice';

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('admin_list_mobile_app_users');

    if (rpcError) {
      setUsers([]);
      setError('Não foi possível carregar os acessos mobile neste momento.');
    } else {
      setUsers((Array.isArray(data) ? data : []) as MobileAccessUser[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      [user.name, user.email, user.organization_name, user.profile, user.access_channel]
        .some((value) => String(value || '').toLowerCase().includes(term)),
    );
  }, [search, users]);

  const stats = useMemo(() => ({
    total: users.length,
    mobileOnly: users.filter((user) => user.access_channel === 'mobile').length,
    both: users.filter((user) => user.access_channel === 'both').length,
    active: users.filter((user) => user.is_active && user.operator_status === 'ativo').length,
  }), [users]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(appUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">App Mobile / Solicitantes</h2>
                <p className="text-sm text-slate-500">Gestão do acesso PWA usado por solicitantes e demais perfis habilitados para mobile.</p>
              </div>
            </div>
          </div>

          <a
            href={appUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-extrabold text-white shadow-sm hover:bg-indigo-700"
          >
            Abrir App
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-700">
            <Clipboard className="h-4 w-4" />
            Link fixo de acesso ao app
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={appUrl}
              className="h-11 flex-1 rounded-xl border border-indigo-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none"
              aria-label="Link público do aplicativo"
            />
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-extrabold text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-100"
            >
              {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
              {copied ? 'Copiado' : 'Copiar link'}
            </button>
          </div>
          <p className="mt-2 text-xs text-indigo-700/80">
            Envie este endereço ao usuário. No celular ele poderá entrar, autenticar e instalar o SupplyHub como aplicativo quando o navegador oferecer a instalação.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Habilitados no mobile', value: stats.total, icon: Users },
          { label: 'Somente Mobile', value: stats.mobileOnly, icon: Smartphone },
          { label: 'Web + Mobile', value: stats.both, icon: MonitorSmartphone },
          { label: 'Ativos', value: stats.active, icon: ShieldCheck },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <Icon className="h-4 w-4 text-indigo-600" />
              <p className="mt-3 text-2xl font-black text-slate-900">{card.value}</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">{card.label}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-emerald-800">
            <Wifi className="h-4 w-4" />
            <p className="text-sm font-black">PWA configurado</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-emerald-800/80">
            O aplicativo utiliza instalação pelo navegador e abre em janela própria, com ícone na tela inicial.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-black text-slate-800">Canal recomendado</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Solicitante: Mobile/PWA. Comprador e Gestor podem utilizar Web + Mobile quando necessário.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-black text-slate-800">Controle de segurança</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            O link é público, mas o conteúdo do app exige login. O tipo de acesso definido no usuário continua sendo validado após autenticação.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900">Quem tem acesso ao App</h3>
            <p className="text-xs text-slate-500">Usuários configurados como Mobile/PWA ou Web + Mobile.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </button>
        </div>

        <div className="p-5">
          <div className="relative mb-4 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar usuário, e-mail ou empresa..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[1000px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Acesso</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Último login</th>
                  <th className="px-4 py-3">Última atividade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">Carregando acessos...</td></tr>
                ) : visibleUsers.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">Nenhum usuário mobile encontrado.</td></tr>
                ) : visibleUsers.map((user) => (
                  <tr key={user.user_id} className="bg-white hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-extrabold text-slate-900">{user.name || 'Usuário'}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700">{user.organization_name}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700">{profileLabel(user.profile)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-700">
                        {user.access_channel === 'mobile' ? 'Mobile/PWA' : 'Web + Mobile'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                        user.is_active && user.operator_status === 'ativo'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {user.is_active && user.operator_status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{formatDateTime(user.last_login_at)}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(user.last_activity_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

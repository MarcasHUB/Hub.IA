import { useEffect, useState } from 'react';
import { CheckCircle2, Monitor, Smartphone, XCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import {
  AccessChannel,
  MacroProfile,
  MACRO_PROFILES,
  Operator,
  OperatorPerfil,
  OperatorPermissions,
  PreferredInterface,
} from '../../domain/entities/Operator';
import { SupabaseOperatorRepository } from '../../infrastructure/repositories/SupabaseOperatorRepository';
import { SupabaseCategoryRepository } from '@/modules/categories/infrastructure/repositories/SupabaseCategoryRepository';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { privateQueryKeys } from '@/modules/auth/application/query/privateQueryKeys';

interface EditOperatorModalProps {
  authUserId: string;
  operator: Operator;
  orgId: string;
  operators: Operator[];
  onClose: () => void;
}

type PermissionKey = Exclude<keyof OperatorPermissions, 'platform_master'>;

const permissionLabels: Array<{ key: PermissionKey; label: string; help: string }> = [
  { key: 'can_request_materials', label: 'Solicitar materiais', help: 'Criar e acompanhar solicitações.' },
  { key: 'can_manage_quotations', label: 'Gerenciar cotações', help: 'Criar, operar e comparar cotações.' },
  { key: 'can_approve_requests', label: 'Aprovar solicitações', help: 'Aprovar, reprovar ou devolver processos.' },
  { key: 'can_issue_purchase_orders', label: 'Emitir pedidos', help: 'Gerar pedidos após a aprovação.' },
  { key: 'can_manage_users', label: 'Gerenciar usuários', help: 'Administrar operadores da própria empresa.' },
  { key: 'organization_admin', label: 'Administrador da empresa', help: 'Administração completa da própria organização.' },
];

function permissionPreset(perfil: OperatorPerfil, platformMaster = false): OperatorPermissions {
  if (perfil === 'administrador') {
    return {
      can_request_materials: true,
      can_manage_quotations: true,
      can_approve_requests: true,
      can_issue_purchase_orders: true,
      can_manage_users: true,
      organization_admin: true,
      platform_master: platformMaster,
    };
  }
  if (perfil === 'gestor') {
    return {
      can_request_materials: true,
      can_manage_quotations: false,
      can_approve_requests: true,
      can_issue_purchase_orders: false,
      can_manage_users: false,
      organization_admin: false,
      platform_master: platformMaster,
    };
  }
  if (perfil === 'comprador') {
    return {
      can_request_materials: true,
      can_manage_quotations: true,
      can_approve_requests: false,
      can_issue_purchase_orders: true,
      can_manage_users: false,
      organization_admin: false,
      platform_master: platformMaster,
    };
  }
  if (perfil === 'solicitante') {
    return {
      can_request_materials: true,
      can_manage_quotations: false,
      can_approve_requests: false,
      can_issue_purchase_orders: false,
      can_manage_users: false,
      organization_admin: false,
      platform_master: platformMaster,
    };
  }
  return {
    can_request_materials: false,
    can_manage_quotations: false,
    can_approve_requests: false,
    can_issue_purchase_orders: false,
    can_manage_users: false,
    organization_admin: false,
    platform_master: platformMaster,
  };
}

function defaultAccessForProfile(perfil: OperatorPerfil): AccessChannel {
  if (perfil === 'solicitante') return 'mobile';
  if (perfil === 'auditor') return 'web';
  return 'both';
}

export function EditOperatorModal({ authUserId, operator, orgId, operators, onClose }: EditOperatorModalProps) {
  const queryClient = useQueryClient();
  const operatorsKey = privateQueryKeys.operators(authUserId, orgId);
  const repo = new SupabaseOperatorRepository();

  const initialMacro = (): MacroProfile => {
    if (operator.cargo?.includes('[APP] Solicitante')) return 'Solicitante';
    if (operator.cargo?.includes('[DESKTOP] Auditor')) return 'Auditor';
    if (operator.cargo?.includes('[DESKTOP] Gestor') || operator.perfil === 'gestor') return 'Gestor';
    if (operator.cargo?.includes('[DESKTOP] Administrador') || operator.perfil === 'administrador') return 'Administrador';
    return 'Comprador';
  };

  const [form, setForm] = useState({
    nome: operator.nome || '',
    sobrenome: operator.sobrenome || '',
    email: operator.email || '',
    telefone: operator.telefone || '',
    cargo: operator.cargo || '',
    perfil: operator.perfil || 'comprador',
    macroProfile: initialMacro(),
    gestor_id: operator.gestor_id || '',
    todas_categorias: operator.todas_categorias ?? true,
    category_ids: operator.categories || [],
    access_channel: defaultAccessForProfile(operator.perfil) as AccessChannel,
    preferred_interface: 'web' as PreferredInterface,
    permissions: permissionPreset(operator.perfil),
  });

  const { data: categoriesList = [] } = useQuery({
    queryKey: privateQueryKeys.categories(authUserId, orgId),
    queryFn: async () => new SupabaseCategoryRepository().findAll(orgId),
  });

  const { data: operatorProfile } = useQuery({
    queryKey: privateQueryKeys.operatorProfile(authUserId, orgId, operator.id),
    queryFn: async () => {
      if (operator.status === 'pendente') return null;
      const { supabase } = await import('@/infrastructure/supabase/client');
      const { data } = await supabase
        .from('profiles')
        .select('full_name, display_name, phone, job_title')
        .eq('user_id', operator.id)
        .maybeSingle();
      return data;
    },
    enabled: operator.status !== 'pendente',
  });

  const { data: accessSettings, isLoading: accessLoading } = useQuery({
    queryKey: ['operator-access-d2', authUserId, orgId, operator.id],
    queryFn: () => repo.getOperatorAccess(operator.id),
    enabled: operator.status !== 'pendente',
  });

  useEffect(() => {
    if (!accessSettings) return;
    setForm(current => ({
      ...current,
      access_channel: accessSettings.access_channel,
      preferred_interface: accessSettings.preferred_interface,
      permissions: accessSettings.permissions,
    }));
  }, [accessSettings]);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const activePerfil = operator.status === 'pendente' ? MACRO_PROFILES[form.macroProfile].perfil : form.perfil;
  const activeMacro: MacroProfile = operator.status === 'pendente'
    ? form.macroProfile
    : activePerfil === 'administrador'
      ? 'Administrador'
      : activePerfil === 'auditor'
        ? 'Auditor'
        : activePerfil === 'gestor'
          ? 'Gestor'
          : activePerfil === 'solicitante'
            ? 'Solicitante'
            : 'Comprador';

  const requiresGestor = activeMacro !== 'Administrador' && activeMacro !== 'Comprador';
  const hasValidGestor = requiresGestor ? Boolean(form.gestor_id) : true;
  const isCategoriasValid = (activeMacro === 'Administrador' || activeMacro === 'Auditor') || form.todas_categorias || form.category_ids.length > 0;
  const valid = form.nome.trim() !== '' && hasValidGestor && isCategoriasValid && !accessLoading;

  const handleProfileChange = (newPerfil: OperatorPerfil) => {
    setForm(current => ({
      ...current,
      perfil: newPerfil,
      access_channel: defaultAccessForProfile(newPerfil),
      preferred_interface: newPerfil === 'solicitante' ? 'mobile' : 'web',
      permissions: permissionPreset(newPerfil, current.permissions.platform_master),
      todas_categorias: newPerfil === 'administrador' || newPerfil === 'gestor' ? true : current.todas_categorias,
    }));
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      setErrorMsg('O nome é obrigatório.');
      return;
    }
    if (operator.status === 'pendente' && !form.email.trim()) {
      setErrorMsg('O e-mail é obrigatório para convites pendentes.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    try {
      const selectedPerfil = operator.status === 'pendente'
        ? MACRO_PROFILES[form.macroProfile].perfil
        : form.perfil;
      const isAllCats = selectedPerfil === 'administrador' || selectedPerfil === 'auditor' || form.todas_categorias;
      const payload: Partial<Operator> = {
        email: operator.email,
        status: operator.status,
        perfil: selectedPerfil,
        gestor_id: selectedPerfil === 'administrador' ? undefined : (form.gestor_id || undefined),
        todas_categorias: isAllCats,
        categories: isAllCats ? [] : form.category_ids,
      };

      if (operator.status === 'pendente') {
        payload.nome = form.nome;
        payload.sobrenome = form.sobrenome;
        payload.telefone = form.telefone || undefined;
        payload.cargo = MACRO_PROFILES[form.macroProfile].cargo;
      }

      await repo.updateOperator(operator.id, payload as any);

      if (operator.status !== 'pendente') {
        const preferred = form.access_channel === 'mobile'
          ? 'mobile'
          : form.access_channel === 'web'
            ? 'web'
            : form.preferred_interface;
        await repo.setOperatorAccess(operator.id, form.access_channel, preferred, form.permissions);
      }

      queryClient.setQueryData(operatorsKey, (old: Operator[] | undefined) => {
        if (!old) return [];
        return old.map(item => item.id === operator.id ? { ...item, ...payload } as Operator : item);
      });
      queryClient.invalidateQueries({ queryKey: operatorsKey });
      queryClient.invalidateQueries({ queryKey: ['operator-access-d2', authUserId, orgId, operator.id] });

      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch (err: any) {
      const message = String(err?.message || 'Erro ao atualizar os dados do operador.');
      setErrorMsg(message.includes('FORBIDDEN') ? 'Você não possui permissão administrativa para alterar este acesso.' : message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        {success ? (
          <div className="px-6 py-12 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 mb-2">Operador atualizado!</h3>
            <p className="text-sm text-slate-500">Perfil, canal e permissões foram salvos com segurança.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">{operator.status === 'pendente' ? 'Editar Convite' : 'Editar Operador'}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {operator.status === 'pendente' ? 'Altere os dados do convite antes do aceite.' : 'Administre perfil, canal de acesso e permissões.'}
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full">
                <XCircle className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            {errorMsg && <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">⚠️ {errorMsg}</div>}

            <div className="px-6 py-5 space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">E-mail Corporativo (Login) <span className="font-normal normal-case">— não editável</span></label>
                <Input type="email" value={operator.email} readOnly disabled className="h-9 text-sm bg-slate-50 text-slate-500 cursor-not-allowed" />
              </div>

              {operator.status !== 'pendente' && (
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg text-xs text-indigo-800">
                  <strong>Dados pessoais:</strong> nome, telefone e cargo são mantidos pelo próprio usuário em <a href="/meus-dados" className="font-bold underline">Meus Dados</a>.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nome *</label>
                  <Input value={operator.status === 'pendente' ? form.nome : (operatorProfile?.display_name || operatorProfile?.full_name?.split(' ')[0] || operator.nome || '')} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} readOnly={operator.status !== 'pendente'} className={`h-9 text-sm ${operator.status !== 'pendente' ? 'bg-slate-50 text-slate-500' : ''}`} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sobrenome</label>
                  <Input value={operator.status === 'pendente' ? form.sobrenome : (operatorProfile?.full_name?.split(' ').slice(1).join(' ') || operator.sobrenome || '')} onChange={e => setForm(f => ({ ...f, sobrenome: e.target.value }))} readOnly={operator.status !== 'pendente'} className={`h-9 text-sm ${operator.status !== 'pendente' ? 'bg-slate-50 text-slate-500' : ''}`} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Telefone</label>
                  <Input value={operator.status === 'pendente' ? form.telefone : (operatorProfile?.phone || operator.telefone || '')} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} readOnly={operator.status !== 'pendente'} className={`h-9 text-sm ${operator.status !== 'pendente' ? 'bg-slate-50 text-slate-500' : ''}`} />
                </div>
                {activeMacro !== 'Administrador' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Gestor Direto {activeMacro === 'Comprador' ? '(Opcional)' : '*'}</label>
                    <select value={form.gestor_id} onChange={e => setForm(f => ({ ...f, gestor_id: e.target.value }))} className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm">
                      {activeMacro === 'Comprador' && <option value="">Sem gestor</option>}
                      {activeMacro !== 'Comprador' && !form.gestor_id && <option value="" disabled>Selecione um gestor</option>}
                      {operators.filter(op => {
                        if (op.status === 'cancelado' || op.id === operator.id) return false;
                        if (activeMacro === 'Auditor' || activeMacro === 'Gestor') return op.perfil === 'administrador';
                        if (activeMacro === 'Comprador') return op.perfil === 'administrador' || op.perfil === 'gestor';
                        if (activeMacro === 'Solicitante') return op.perfil === 'gestor';
                        return false;
                      }).map(op => <option key={op.id} value={op.id}>{op.nome} {op.sobrenome}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {operator.status !== 'pendente' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cargo</label>
                  <Input value={operatorProfile?.job_title || operator.cargo || ''} readOnly disabled className="h-9 text-sm bg-slate-50 text-slate-500" />
                </div>
              )}

              {operator.status === 'pendente' ? (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Perfil de Acesso *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {(Object.keys(MACRO_PROFILES) as MacroProfile[]).map(mp => (
                      <button key={mp} type="button" onClick={() => setForm(f => ({ ...f, macroProfile: mp }))} className={`h-9 text-[11px] font-bold rounded-lg border ${form.macroProfile === mp ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>{mp}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Perfil de Acesso *</label>
                    <select value={form.perfil} onChange={e => handleProfileChange(e.target.value as OperatorPerfil)} className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700">
                      <option value="auditor">Auditor/Consulta</option>
                      <option value="solicitante">Solicitante</option>
                      <option value="comprador">Comprador</option>
                      <option value="gestor">Gestor</option>
                      <option value="administrador">Administrador</option>
                    </select>
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Acesso ao sistema</h4>
                      <p className="text-xs text-slate-500">Define em qual experiência este usuário pode entrar.</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {([
                        ['web', 'Desktop/Web', Monitor],
                        ['mobile', 'Mobile/PWA', Smartphone],
                        ['both', 'Web + Mobile', Smartphone],
                        ['disabled', 'Sem acesso', XCircle],
                      ] as const).map(([value, label, Icon]) => (
                        <button key={value} type="button" onClick={() => setForm(f => ({ ...f, access_channel: value }))} className={`min-h-16 rounded-xl border px-3 py-2 text-xs font-bold flex flex-col items-center justify-center gap-1 ${form.access_channel === value ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                          <Icon className="h-4 w-4" /> {label}
                        </button>
                      ))}
                    </div>

                    {form.access_channel === 'both' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Interface preferencial</label>
                        <select value={form.preferred_interface} onChange={e => setForm(f => ({ ...f, preferred_interface: e.target.value as PreferredInterface }))} className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm">
                          <option value="web">Sistema completo (Web)</option>
                          <option value="mobile">Experiência Mobile/PWA</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Permissões operacionais</h4>
                      <p className="text-xs text-slate-500">O perfil fornece um padrão, mas as permissões podem ser ajustadas individualmente.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {permissionLabels.map(item => (
                        <label key={item.key} className="flex gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                          <input type="checkbox" checked={Boolean(form.permissions[item.key])} onChange={e => setForm(f => ({ ...f, permissions: { ...f.permissions, [item.key]: e.target.checked } }))} className="mt-0.5 rounded border-slate-300 text-indigo-600" />
                          <span>
                            <span className="block text-xs font-bold text-slate-800">{item.label}</span>
                            <span className="block text-[11px] text-slate-500 mt-0.5">{item.help}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    {form.permissions.platform_master && (
                      <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">
                        <strong>Master da plataforma:</strong> permissão protegida e não editável por administradores comuns.
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeMacro !== 'Administrador' && activeMacro !== 'Auditor' && (
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Categorias Autorizadas</label>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-slate-300 text-indigo-600" checked={form.todas_categorias} onChange={e => setForm(f => ({ ...f, todas_categorias: e.target.checked }))} />
                      <span className="text-sm font-semibold text-slate-700">Todas as Categorias</span>
                    </label>
                    {!form.todas_categorias && (
                      <div className="pl-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {categoriesList.map(cat => (
                          <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="rounded border-slate-300 text-indigo-600" checked={form.category_ids.includes(cat.id)} onChange={e => setForm(f => ({ ...f, category_ids: e.target.checked ? [...f.category_ids, cat.id] : f.category_ids.filter((id: string) => id !== cat.id) }))} />
                            <span className="text-xs font-medium text-slate-600 truncate" title={cat.name}>{cat.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end px-6 pb-6 pt-2">
              <Button variant="outline" onClick={onClose} className="h-9 text-xs rounded-lg">Cancelar</Button>
              <Button onClick={handleSave} disabled={!valid || saving} className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-bold rounded-lg px-4 shadow-sm">
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

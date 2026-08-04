import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users, UserPlus, Shield, UserCheck, Search,
  Mail, MoreVertical, XCircle, Layers, CheckCircle2, Copy,
  Smartphone, Monitor, Check, X
} from 'lucide-react';
import { EmailService } from '@/shared/utils/EmailService';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { ClearableInput } from '@/shared/components/ui/ClearableInput';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { EntityCard } from '@/shared/components/ui/EntityCard';
import { Operator, OperatorPerfil, OperatorStatus, operatorFullName, MacroProfile, MACRO_PROFILES } from '@/modules/employees/domain/entities/Operator';
import { SupabaseOperatorRepository } from '../../infrastructure/repositories/SupabaseOperatorRepository';
import { SupabaseCategoryRepository } from '@/modules/categories/infrastructure/repositories/SupabaseCategoryRepository';
import { SupabaseDelegationRepository } from '../../infrastructure/repositories/SupabaseDelegationRepository';
import { EditOperatorModal } from '../components/EditOperatorModal';
import { OperatorDetailsModal } from '../components/OperatorDetailsModal';

import { supabase } from '@/infrastructure/supabase/client';

// ─── Badges ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<OperatorStatus, { label: string; dot: string; badge: string }> = {
  ativo:       { label: 'Ativo',       dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700 border-green-200' },
  pendente:    { label: 'Pendente',    dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  inativo:     { label: 'Inativo',     dot: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-500 border-slate-200' },
  bloqueado:   { label: 'Bloqueado',   dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200' },
  ferias:      { label: 'Férias',      dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  substituido: { label: 'Substituído', dot: 'bg-violet-400', badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  cancelado:   { label: 'Cancelado',   dot: 'bg-slate-500',  badge: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const PERFIL_CONFIG: Record<OperatorPerfil, { label: string; badge: string; icon: any }> = {
  administrador: { label: 'Administrador', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: Shield },
  gestor:        { label: 'Gestor',        badge: 'bg-violet-100 text-violet-800 border-violet-200', icon: UserCheck },
  comprador:     { label: 'Comprador',     badge: 'bg-slate-100 text-slate-700 border-slate-200', icon: Users },
  solicitante:   { label: 'Solicitante',   badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Smartphone },
  auditor:       { label: 'Auditor/Consulta', badge: 'bg-slate-50 text-slate-500 border-slate-200', icon: Users },
};


function StatusBadge({ status }: { status: OperatorStatus }) {
  const cfg = STATUS_CONFIG[status] || { label: status || 'Desconhecido', badge: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${cfg.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function PerfilBadge({ perfil }: { perfil: OperatorPerfil }) {
  const cfg = PERFIL_CONFIG[perfil] || { label: perfil || 'Desconhecido', badge: 'bg-slate-100 text-slate-500 border-slate-200', icon: Users };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${cfg.badge}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
}

// ─── Modal de Convite ─────────────────────────────────────────────────────────

function InviteModal({ onClose, onInvite, operators, organizationId }: { onClose: () => void; onInvite: (op: Operator) => void, operators: Operator[], organizationId?: string }) {
  const [form, setForm] = useState({
    nome: '', sobrenome: '', email: '', telefone: '',
    macroProfile: 'Comprador' as MacroProfile,
    gestor_id: '',
  });
  const [inviteForm, setInviteForm] = useState({
    todas_categorias: false,
    category_ids: [] as string[]
  });
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState<{ op: Operator; token: string; expires_at: string; invite_url: string; } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  const orgId = organizationId || localStorage.getItem('supplyhub_organization_id') || '00000000-0000-0000-0000-000000000000';
  
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', orgId],
    queryFn: async () => {
      const repo = new SupabaseCategoryRepository();
      return await repo.findAll(orgId);
    }
  });

  const handleSubmit = async () => {
    if (!form.nome.trim() || !form.email.trim()) return;
    setSending(true);
    setErrorMsg('');
    try {
      const repo = new SupabaseOperatorRepository();
      const orgId = organizationId || localStorage.getItem('supplyhub_organization_id') || '00000000-0000-0000-0000-000000000000';
      const loggedOperator = JSON.parse(localStorage.getItem('supplyhub_logged_operator') || '{}');

      const mapInfo = MACRO_PROFILES[form.macroProfile];

      const res = await repo.inviteOperator({
        nome: form.nome,
        sobrenome: form.sobrenome,
        email: form.email,
        telefone: form.telefone || undefined,
        cargo: mapInfo.cargo,
        perfil: mapInfo.perfil,
        gestor_id: form.gestor_id || undefined,
        category_ids: inviteForm.todas_categorias ? [] : inviteForm.category_ids,
        todas_categorias: inviteForm.todas_categorias,
        invited_by_id: loggedOperator.id || undefined,
        organization_id: orgId,
      });

      if (res.success && res.token) {
        const emailRes = await EmailService.sendTransactionalEmail('operator_invite', res.token);
        
        if (!emailRes.success) {
          await repo.updateEmailStatus(res.token, 'failed', emailRes.message);
          setErrorMsg(`Convite salvo, mas falha no envio do e-mail: ${emailRes.message}`);
          return;
        }

        await repo.updateEmailStatus(res.token, 'sent');

        const newOp: Operator = {
          id: res.user?.id || `op-${Date.now()}`,
          organization_id: orgId,
          nome: form.nome,
          sobrenome: form.sobrenome,
          email: form.email,
          telefone: form.telefone || undefined,
          cargo: mapInfo.cargo,
          perfil: mapInfo.perfil,
          gestor_id: form.gestor_id || undefined,
          status: 'pendente',
          invited_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          todas_categorias: inviteForm.todas_categorias,
          categories: inviteForm.todas_categorias ? [] : inviteForm.category_ids,
        };
        const tokenStr = res.token || 'TOKEN_NAO_RETORNADO';
        const expStr = res.expires_at || new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
        const baseUrl = window.location.origin;
        
        setSuccessData({
          op: newOp,
          token: tokenStr,
          expires_at: expStr,
          invite_url: `${baseUrl}/aceitar-convite?token=${tokenStr}`
        });
      } else {
        setErrorMsg(res.message || 'Falha ao processar o convite.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao conectar à Edge Function de convite.');
    } finally {
      setSending(false);
    }
  };

  const valid = form.nome.trim() && form.email.trim() && (inviteForm.todas_categorias || inviteForm.category_ids.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        
        {successData ? (
          <div className="px-6 py-8 flex flex-col items-center">
            <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 mb-2">Convite criado com sucesso!</h3>
            <p className="text-sm text-slate-500 mb-6 text-center">
              O operador <strong>{successData.op.nome}</strong> foi cadastrado e está com status <strong className="text-amber-500">Pendente</strong>.<br/>
              O link abaixo permite o acesso direto para aceitar o convite.
            </p>

            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Operador</span>
                  <p className="text-sm font-semibold text-slate-800">{successData.op.nome} {successData.op.sobrenome}</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">E-mail</span>
                  <p className="text-sm font-semibold text-slate-800">{successData.op.email}</p>
                </div>
                <Button variant="outline" className="h-8 text-xs flex gap-1.5 bg-white shadow-sm" onClick={() => {
                  navigator.clipboard.writeText(successData.op.email);
                  setCopiedEmail(true);
                  setTimeout(() => setCopiedEmail(false), 2000);
                }}>
                  {copiedEmail ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedEmail ? 'Copiado' : 'Copiar E-mail'}
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Data de Envio</span>
                  <p className="text-sm font-semibold text-slate-800">{new Date().toLocaleString('pt-BR')}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Validade</span>
                  <p className="text-sm font-semibold text-slate-800">{new Date(successData.expires_at).toLocaleString('pt-BR')}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Link do Convite</span>
                <div className="flex mt-1.5 gap-2">
                  <Input readOnly value={successData.invite_url} className="h-9 text-xs font-mono bg-white text-slate-600" />
                  <Button variant="outline" className="h-9 shrink-0 px-3 text-xs flex gap-1.5 bg-white shadow-sm" onClick={() => {
                    navigator.clipboard.writeText(successData.invite_url);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}>
                    {copiedLink ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    {copiedLink ? 'Copiado' : 'Copiar Link'}
                  </Button>
                </div>
              </div>
            </div>

            <Button onClick={() => onInvite(successData.op)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 text-sm rounded-xl">
              Concluir e Fechar
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Convidar Operador</h3>
                <p className="text-xs text-slate-500 mt-0.5">Um e-mail de convite será enviado com link de acesso.</p>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full">
                <XCircle className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            {errorMsg && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 flex gap-2">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nome *</label>
                  <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Maria" className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sobrenome</label>
                  <Input value={form.sobrenome} onChange={e => setForm(f => ({ ...f, sobrenome: e.target.value }))} placeholder="Oliveira" className="h-9 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">E-mail Corporativo *</label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="maria@empresa.com.br" className="h-9 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Telefone</label>
                  <Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(11) 9xxxx-xxxx" className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Gestor Direto (Opcional)</label>
                  <select
                    value={form.gestor_id}
                    onChange={e => setForm(f => ({ ...f, gestor_id: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Sem gestor</option>
                    {operators
                      .filter(op => op.status !== 'cancelado' && (op.perfil === 'gestor' || op.perfil === 'administrador'))
                      .map(op => (
                        <option key={op.id} value={op.id}>{operatorFullName(op)}</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Perfil de Acesso *</label>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {(Object.keys(MACRO_PROFILES) as MacroProfile[]).map((mp) => (
                    <button
                      key={mp}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, macroProfile: mp }))}
                      className={`h-9 text-[11px] font-bold rounded-lg border transition-all ${
                        form.macroProfile === mp 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {mp}
                    </button>
                  ))}
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm mt-2">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">Acessos Disponíveis:</span>
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1 ${MACRO_PROFILES[form.macroProfile].mobile ? 'text-green-600' : 'text-slate-400'}`}>
                          {MACRO_PROFILES[form.macroProfile].mobile ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <Smartphone className="h-3.5 w-3.5" />
                          <span className="text-[11px] font-bold uppercase">Mobile</span>
                        </div>
                        <div className={`flex items-center gap-1 ${MACRO_PROFILES[form.macroProfile].desktop ? 'text-green-600' : 'text-slate-400'}`}>
                          {MACRO_PROFILES[form.macroProfile].desktop ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <Monitor className="h-3.5 w-3.5" />
                          <span className="text-[11px] font-bold uppercase">Desktop</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <span className="font-bold text-slate-900 block mb-1">Permissões:</span>
                      <ul className="list-disc pl-5 text-slate-600 space-y-0.5">
                        {MACRO_PROFILES[form.macroProfile].perms.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>

                    {MACRO_PROFILES[form.macroProfile].rests.length > 0 && (
                      <div className="pt-2 border-t border-slate-200">
                        <span className="font-bold text-red-600 block mb-1">Restrições:</span>
                        <ul className="list-disc pl-5 text-slate-500 space-y-0.5">
                          {MACRO_PROFILES[form.macroProfile].rests.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            <div className="space-y-3 pt-4 border-t border-slate-100">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Categorias Autorizadas
            </label>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={inviteForm.todas_categorias}
                  onChange={(e) => setInviteForm(f => ({ ...f, todas_categorias: e.target.checked, category_ids: e.target.checked ? [] : f.category_ids }))}
                />
                <span className="text-sm font-semibold text-slate-700">Todas as Categorias</span>
              </label>
              
              {inviteForm.todas_categorias ? (
                <div className="pl-6 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">Inclui:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.slice(0, 10).map(cat => (
                      <span key={cat.id} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {cat.name}
                      </span>
                    ))}
                    {categories.length > 10 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        +{categories.length - 10} categorias
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="pl-6 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Buscar categorias..."
                      className="pl-9 h-9 text-sm bg-white"
                      value={categorySearch}
                      onChange={e => setCategorySearch(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {inviteForm.category_ids.map(catId => {
                      const cat = categories.find(c => c.id === catId);
                      if (!cat) return null;
                      return (
                        <span key={cat.id} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {cat.name}
                          <button
                            type="button"
                            onClick={() => setInviteForm(f => ({ ...f, category_ids: f.category_ids.filter(id => id !== cat.id) }))}
                            className="text-indigo-400 hover:text-indigo-600 focus:outline-none"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                    {inviteForm.category_ids.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setInviteForm(f => ({ ...f, category_ids: [] }))}
                        className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 focus:outline-none transition-colors"
                      >
                        Limpar todas
                      </button>
                    )}
                  </div>

                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg bg-white p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {categories
                      .filter(cat => cat.name.toLowerCase().includes(categorySearch.toLowerCase()))
                      .map(cat => (
                      <label key={cat.id} className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-slate-50 rounded-md transition-colors">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={inviteForm.category_ids.includes(cat.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setInviteForm(f => ({ ...f, category_ids: [...f.category_ids, cat.id] }));
                            } else {
                              setInviteForm(f => ({ ...f, category_ids: f.category_ids.filter(id => id !== cat.id) }));
                            }
                          }}
                        />
                        <span className="text-xs font-medium text-slate-700 truncate" title={cat.name}>{cat.name}</span>
                      </label>
                    ))}
                    {categories.filter(cat => cat.name.toLowerCase().includes(categorySearch.toLowerCase())).length === 0 && (
                      <div className="col-span-full py-4 text-center text-xs text-slate-400">
                        Nenhuma categoria encontrada
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                <p className="text-[10px] font-bold text-indigo-700 flex items-center gap-1.5">
                  <Mail className="h-3 w-3" />
                  O convite expira em 72 horas. O operador receberá um link para definir sua senha.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end px-6 pb-6">
              <Button variant="outline" onClick={onClose} className="h-9 text-xs rounded-lg">Cancelar</Button>
              <Button
                onClick={handleSubmit}
                disabled={!valid || sending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-bold flex items-center gap-2 rounded-lg px-4 shadow-sm"
              >
                <Mail className="h-3.5 w-3.5" />
                {sending ? 'Enviando...' : 'Enviar Convite'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── OperatorsPage ────────────────────────────────────────────────────────────
export default function OperatorsPage({ organizationId }: { organizationId?: string }) {
  const queryClient = useQueryClient();
  const orgId = organizationId || localStorage.getItem('supplyhub_organization_id') || '00000000-0000-0000-0000-000000000000';
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [remoteLoggedOperator, setRemoteLoggedOperator] = useState<Operator | null>(null);

  useEffect(() => {
    async function checkPermissions() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Fetch is_super_admin from remote
      const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('user_id', user.id).maybeSingle();
      if (profile?.is_super_admin) {
        setIsSuperAdmin(true);
      }
      
      // Fetch operator remote details
      const { data: opData } = await supabase.from('operators').select('*').eq('id', user.id).maybeSingle();
      if (opData) setRemoteLoggedOperator(opData as unknown as Operator);
    }
    checkPermissions();
  }, []);

  const { data: operators = [], isLoading: isLoadingOps } = useQuery({
    queryKey: ['operators', orgId],
    queryFn: async () => {
      const repo = new SupabaseOperatorRepository();
      return repo.listOperators(orgId);
    }
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', orgId],
    queryFn: async () => {
      const repo = new SupabaseCategoryRepository();
      return repo.findAll(orgId);
    }
  });

  const { data: delegations = [] } = useQuery({
    queryKey: ['delegations', orgId],
    queryFn: async () => {
      const delRepo = new SupabaseDelegationRepository();
      return delRepo.listDelegations(orgId);
    }
  });

  const [showInvite, setShowInvite] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [search, setSearch] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  
  type TabType = 'todos' | 'ativos' | 'pendentes' | 'inativos' | 'cancelados';
  const [activeTab, setActiveTab] = useState<TabType>('todos');

  const getActiveDelegationStatus = (opId: string): 'origem' | 'substituto' | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeDel = delegations.find(del => {
      if (del.status !== 'ativa') return false;
      const start = new Date(del.data_inicio);
      start.setHours(0, 0, 0, 0);
      const end = new Date(del.data_fim);
      end.setHours(0, 0, 0, 0);
      return today >= start && today <= end;
    });

    if (!activeDel) return null;
    if (activeDel.operador_origem_id === opId) return 'origem';
    if (activeDel.operador_substituto_id === opId) return 'substituto';
    return null;
  };

  const baseFiltered = operators.filter(op =>
    operatorFullName(op).toLowerCase().includes(search.toLowerCase()) ||
    op.email.toLowerCase().includes(search.toLowerCase())
  );

  const filtered = baseFiltered.filter(op => {
    if (activeTab === 'todos') return op.status !== 'cancelado';
    if (activeTab === 'ativos') return op.status === 'ativo';
    if (activeTab === 'pendentes') return op.status === 'pendente';
    if (activeTab === 'inativos') return op.status === 'inativo';
    if (activeTab === 'cancelados') return op.status === 'cancelado';
    return true;
  });

  const handleInvite = () => {
    queryClient.invalidateQueries({ queryKey: ['operators', orgId] });
    setShowInvite(false);
  };

  const handleCopyLink = async (op: Operator) => {
    setActiveMenu(null);
    try {
      const repo = new SupabaseOperatorRepository();
      const invitation = await repo.getInvitationByEmail(op.email);
      if (!invitation) {
        alert("Nenhum convite pendente encontrado para este operador.");
        return;
      }
      const baseUrl = window.location.origin;
      const inviteUrl = `${baseUrl}/aceitar-convite?token=${invitation.token}`;
      await navigator.clipboard.writeText(inviteUrl);
      alert(`Link do convite para ${op.nome} copiado para a área de transferência!`);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao copiar o link do convite.");
    }
  };

  const handleResendInvite = async (op: Operator) => {
    setActiveMenu(null);
    try {
      const repo = new SupabaseOperatorRepository();
      await repo.resendInvite(op.email);
      
      const invitation = await repo.getInvitationByEmail(op.email);
      if (!invitation) {
        alert("Nenhum convite pendente encontrado para este operador.");
        return;
      }
      
      const { EmailService } = await import('@/shared/utils/EmailService');
      const emailRes = await EmailService.sendTransactionalEmail('operator_invite', invitation.token);
      
      if (!emailRes.success) {
        await repo.updateEmailStatus(invitation.token, 'failed', emailRes.message);
        alert(`Erro ao reenviar o e-mail: ${emailRes.message}`);
        return;
      }
      
      await repo.updateEmailStatus(invitation.token, 'sent');
      alert(`Convite reenviado com sucesso para ${op.email}!`);
      
    } catch (err: any) {
      console.error(err);
      alert("Erro ao reenviar o convite.");
    }
  };

  const handleCancelInvite = async (op: Operator) => {
    setActiveMenu(null);
    if (!window.confirm(`Deseja realmente cancelar o convite de ${op.nome} ${op.sobrenome}? O operador e seu token de acesso serão removidos.`)) {
      return;
    }
    
    const previousOperators = queryClient.getQueryData<Operator[]>(['operators', orgId]);
    
    queryClient.setQueryData(['operators', orgId], (old: Operator[] | undefined) => {
      if (!old) return [];
      return old.filter(item => item.id !== op.id);
    });

    try {
      const repo = new SupabaseOperatorRepository();
      await repo.cancelInvite(op.email, op.id);
      alert(`Convite de ${op.nome} cancelado com sucesso.`);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao cancelar o convite.");
      if (previousOperators) {
        queryClient.setQueryData(['operators', orgId], previousOperators);
      }
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['operators'] });
    }
  };

  const [detailsOperator, setDetailsOperator] = useState<Operator | null>(null);

  const handleUpdateStatus = async (op: Operator, newStatus: OperatorStatus) => {
    setActiveMenu(null);
    setDetailsOperator(null);
    const actionName = newStatus === 'inativo' ? 'inativar' : 'reativar';
    
    if (!window.confirm(`Deseja realmente ${actionName} o operador ${op.nome} ${op.sobrenome}?`)) {
      return;
    }
    
    const previousOperators = queryClient.getQueryData<Operator[]>(['operators', orgId]);
    
    queryClient.setQueryData(['operators', orgId], (old: Operator[] | undefined) => {
      if (!old) return [];
      return old.map(item => item.id === op.id ? { ...item, status: newStatus } : item);
    });

    try {
      const repo = new SupabaseOperatorRepository();
      await repo.updateOperatorStatus(op.id, newStatus);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao ${actionName} o operador.`);
      if (previousOperators) {
        queryClient.setQueryData(['operators', orgId], previousOperators);
      }
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['operators'] });
    }
  };

  const handleDeleteOperator = async (op: Operator) => {
    setActiveMenu(null);
    setDetailsOperator(null);
    
    if (!op.id || !orgId) {
       alert("Erro técnico: Identificador do operador ou organização não encontrado.");
       return;
    }

    const displayName = (op.nome && op.nome !== 'Usuário Autenticado' && op.nome.trim() !== '')
      ? `${op.nome} ${op.sobrenome || ''}`.trim()
      : (op.email || 'Operador sem identificação');

    if (!window.confirm(`ATENÇÃO: Deseja realmente excluir o operador ${displayName}?\n\nEsta ação removerá o operador das listas do sistema, mas manterá o histórico salvo para auditoria.`)) {
      return;
    }
    
    const previousOperators = queryClient.getQueryData<Operator[]>(['operators', orgId]);
    
    queryClient.setQueryData(['operators', orgId], (old: Operator[] | undefined) => {
      if (!old) return [];
      return old.filter(item => item.id !== op.id);
    });

    try {
      const repo = new SupabaseOperatorRepository();
      await repo.deleteOperator(op.id);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao excluir o operador.');
      if (previousOperators) {
        queryClient.setQueryData(['operators', orgId], previousOperators);
      }
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['operators'] });
    }
  };

  const activeStatsList = operators.filter(o => o.status !== 'cancelado');
  
  const stats = {
    total: activeStatsList.length,
    ativos: activeStatsList.filter(o => o.status === 'ativo' || o.status === 'ferias').length,
    pendentes: activeStatsList.filter(o => o.status === 'pendente').length,
  };

  return (
    <div className="space-y-6 font-sans">
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvite={handleInvite} operators={operators} organizationId={orgId} />}
      {editingOperator && (
        <EditOperatorModal 
          operator={editingOperator} 
          orgId={orgId} 
          operators={operators}
          onClose={() => setEditingOperator(null)} 
        />
      )}
      {detailsOperator && (
        <OperatorDetailsModal
          operator={detailsOperator}
          segmentsList={categories}
          onClose={() => setDetailsOperator(null)}
          onEdit={() => {
            setDetailsOperator(null);
            setEditingOperator(detailsOperator);
          }}
          onInactivate={() => {
            handleUpdateStatus(detailsOperator, 'inativo');
            setDetailsOperator(null);
          }}
          onReactivate={() => {
            handleUpdateStatus(detailsOperator, 'ativo');
            setDetailsOperator(null);
          }}
          onDelete={() => {
            if (detailsOperator.status === 'pendente') {
              handleCancelInvite(detailsOperator);
            } else {
              handleDeleteOperator(detailsOperator);
            }
            setDetailsOperator(null);
          }}
          onResendInvite={detailsOperator.status === 'pendente' ? () => handleResendInvite(detailsOperator) : undefined}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total de Operadores', value: stats.total, color: 'text-slate-900', desc: 'Membros cadastrados' },
          { label: 'Ativos', value: stats.ativos, color: 'text-green-600', desc: 'Operadores com acesso liberado' },
          { label: 'Pendentes', value: stats.pendentes, color: 'text-amber-500', desc: 'Aguardando aceite de convite' },
        ].map(item => (
          <Card key={item.label} className="rounded-2xl border-slate-200 shadow-sm bg-white">
            <CardContent className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
              <p className={`text-2xl font-extrabold mt-1 ${item.color}`}>{item.value}</p>
              <p className="text-[10px] text-slate-400 mt-1">{item.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
        <CardContent className="p-0">
          
          <div className="flex border-b border-slate-200 overflow-x-auto hide-scrollbar">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'ativos', label: 'Ativos' },
              { id: 'pendentes', label: 'Pendentes' },
              { id: 'inativos', label: 'Inativos' },
              { id: 'cancelados', label: 'Cancelados' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-5 py-3.5 text-xs font-bold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <ClearableInput
                placeholder="Buscar por nome ou e-mail..."
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                className="pl-10 h-10 text-sm"
              />
            </div>
            <Button
              onClick={() => setShowInvite(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 text-sm font-bold flex items-center gap-2 shrink-0 w-full sm:w-auto rounded-xl"
            >
              <UserPlus className="h-4 w-4" /> Convidar Operador
            </Button>
          </div>
        </CardContent>
      </Card>

      {(activeTab === 'todos' || activeTab === 'pendentes') && filtered.filter(op => op.status === 'pendente').length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 px-1">Convites Pendentes</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.filter(op => op.status === 'pendente').map(op => (
              <EntityCard
                key={op.id}
                type="operador"
                title={operatorFullName(op)}
                subtitle={op.email}
                status="pendente"
                onCopyLink={() => handleCopyLink(op)}
                onCancel={() => handleCancelInvite(op)}
                onClick={() => setEditingOperator(op)}
                onEdit={() => setEditingOperator(op)}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <Card className="rounded-2xl border-slate-200 shadow-sm overflow-visible">
          <div className="w-full overflow-x-auto relative">
            <table className="w-full text-sm text-left whitespace-nowrap xl:whitespace-normal min-w-[900px] xl:min-w-0">
              <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 w-[25%]">Operador</th>
                  <th className="px-6 py-3 w-[15%]">Tipo de Acesso</th>
                  <th className="px-6 py-3 w-[15%]">Perfil</th>
                  <th className="px-6 py-3 w-[15%] text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Categorias</th>
                  <th className="px-6 py-3 w-[10%]">Status</th>
                  <th className="px-6 py-3 w-[10%]">Último Acesso</th>
                  <th className="px-6 py-3 w-[10%] text-center sticky right-0 bg-slate-50 z-10 shadow-[-4px_0_8px_rgba(0,0,0,0.05)]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingOps ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-sm">
                      <div className="flex justify-center items-center gap-2">
                        <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        Carregando operadores...
                      </div>
                    </td>
                  </tr>
                ) : filtered.filter(op => op.status !== 'pendente').length === 0 && (activeTab === 'todos' || activeTab === 'pendentes') ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-sm">
                      Os convites pendentes estão sendo exibidos nos cards acima.
                    </td>
                  </tr>
                ) : (
                  filtered.filter(op => op.status !== 'pendente').map(op => (
                    <tr key={op.id} className={`group transition-colors ${op.status === 'cancelado' ? 'bg-slate-50/50 opacity-60 grayscale' : 'hover:bg-slate-50/50 bg-white'}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0 shadow-sm">
                            <span className="text-[11px] font-black text-white leading-none">
                              {op.nome?.[0] || ''}{op.sobrenome?.[0] || ''}
                            </span>
                          </div>
                          <div>
                            <button onClick={() => setDetailsOperator(op)} className="font-bold text-slate-900 text-left hover:text-indigo-600 transition-colors">
                              {operatorFullName(op)}
                            </button>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1 truncate max-w-[150px] sm:max-w-[200px] lg:max-w-xs" title={op.email}>
                              <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{op.email}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-700">
                        {op.cargo?.includes('[APP]') ? 'Campo' : 'Desktop'}
                      </td>
                      <td className="px-6 py-4"><PerfilBadge perfil={op.perfil} /></td>
                      <td className="px-6 py-4">
                        {op.todas_categorias ? (
                          <span className="text-[10px] font-bold text-slate-600">
                            Todas as Categorias
                          </span>
                        ) : op.categories && op.categories.length > 0 ? (
                          <span className="text-[10px] text-slate-600">
                            {op.categories.length} categoria{op.categories.length !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Nenhuma</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <StatusBadge status={op.status} />
                          {(() => {
                            const delStatus = getActiveDelegationStatus(op.id);
                            if (delStatus === 'origem') {
                              return (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  Em Delegação
                                </span>
                              );
                            }
                            if (delStatus === 'substituto') {
                              return (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
                                  Substituindo
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[10px] text-slate-400">
                        {op.last_login_at
                          ? new Date(op.last_login_at).toLocaleDateString('pt-BR')
                          : op.status === 'pendente' ? 'Aguardando aceite' : '—'}
                      </td>
                      <td className="px-6 py-4 text-center sticky right-0 bg-white group-hover:bg-slate-50 transition-colors z-10 shadow-[-4px_0_8px_rgba(0,0,0,0.02)]">
                        <div className="relative inline-block text-left">
                          <button 
                            onClick={() => setActiveMenu(activeMenu === op.id ? null : op.id)}
                            className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          
                          {activeMenu === op.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)}></div>
                              <div className="absolute right-0 z-50 mt-1 w-40 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden">
                                <div className="py-1">
                                  {op.status === 'pendente' && (
                                    <>
                                      <button onClick={() => { setActiveMenu(null); setEditingOperator(op); }} className="w-full text-left px-4 py-2 text-xs text-indigo-600 hover:bg-indigo-50 font-bold">Editar Convite</button>
                                      <button onClick={() => handleResendInvite(op)} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium">Reenviar Convite</button>
                                      <button onClick={() => handleCopyLink(op)} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium">Copiar Link</button>
                                      <button onClick={() => { setActiveMenu(null); handleCancelInvite(op); }} className="w-full text-left px-4 py-2 text-xs text-amber-600 hover:bg-amber-50 font-medium">Cancelar Convite</button>
                                    </>
                                  )}
                                  {op.status === 'ativo' && (
                                    <>
                                      <button onClick={() => { setActiveMenu(null); setEditingOperator(op); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium">Editar Operador</button>
                                      <button onClick={() => setActiveMenu(null)} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium">Delegar Funções</button>
                                      <button onClick={() => handleUpdateStatus(op, 'inativo')} className="w-full text-left px-4 py-2 text-xs text-amber-600 hover:bg-amber-50 font-medium">Inativar Operador</button>
                                    </>
                                  )}
                                  {op.status === 'inativo' && (
                                    <>
                                      <button onClick={() => { setActiveMenu(null); setEditingOperator(op); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium">Editar Operador</button>
                                      <button onClick={() => handleUpdateStatus(op, 'ativo')} className="w-full text-left px-4 py-2 text-xs text-green-600 hover:bg-green-50 font-medium">Reativar Operador</button>
                                    </>
                                  )}
                                  {op.status !== 'cancelado' && (isSuperAdmin || (remoteLoggedOperator?.perfil === 'administrador' && remoteLoggedOperator?.status === 'ativo' && remoteLoggedOperator?.organization_id === op.organization_id)) && (
                                    <div className="border-t border-slate-100 mt-1 py-1">
                                      <button onClick={() => handleDeleteOperator(op)} className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 font-medium">Excluir Operador</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

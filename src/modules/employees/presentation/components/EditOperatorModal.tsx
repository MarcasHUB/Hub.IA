import { useState } from 'react';
import { XCircle, CheckCircle2, Check, X, Smartphone, Monitor } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Operator, OperatorPerfil, MacroProfile, MACRO_PROFILES } from '../../domain/entities/Operator';
import { SupabaseOperatorRepository } from '../../infrastructure/repositories/SupabaseOperatorRepository';
import { SupabaseCategoryRepository } from '@/modules/categories/infrastructure/repositories/SupabaseCategoryRepository';
import { useQueryClient, useQuery } from '@tanstack/react-query';

interface EditOperatorModalProps {
  operator: Operator;
  orgId: string;
  operators: Operator[];
  onClose: () => void;
}

export function EditOperatorModal({ operator, orgId, operators, onClose }: EditOperatorModalProps) {
  const queryClient = useQueryClient();
  
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
    telefone: operator.telefone || '',
    cargo: operator.cargo || '',
    macroProfile: initialMacro(),
    perfil: operator.perfil as OperatorPerfil,
    gestor_id: operator.gestor_id || '',
    todas_categorias: operator.todas_categorias || false,
    category_ids: operator.categories || [],
  });

  const { data: categoriesList = [] } = useQuery({
    queryKey: ['categories', orgId],
    queryFn: async () => {
      const repo = new SupabaseCategoryRepository();
      return repo.findAll(orgId);
    }
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!form.nome.trim()) {
      setErrorMsg("O nome é obrigatório.");
      return;
    }
    
    setSaving(true);
    setErrorMsg('');
    try {
      const repo = new SupabaseOperatorRepository();
      
      const payload: Partial<Operator> = {
        nome: form.nome,
        sobrenome: form.sobrenome,
        email: operator.email,
        status: operator.status,
        telefone: form.telefone || undefined,
        cargo: operator.status === 'pendente' ? MACRO_PROFILES[form.macroProfile].cargo : (form.cargo || undefined),
        perfil: operator.status === 'pendente' ? MACRO_PROFILES[form.macroProfile].perfil : form.perfil,
        gestor_id: form.gestor_id || undefined,
        todas_categorias: form.todas_categorias,
        categories: form.todas_categorias ? [] : form.category_ids,
      };

      await repo.updateOperator(operator.id, payload as any);

      setSuccess(true);
      
      // Atualização otimista no cache e invalidação final
      queryClient.setQueryData(['operators', orgId], (old: Operator[] | undefined) => {
        if (!old) return [];
        return old.map(item => item.id === operator.id ? { 
          ...item, 
          nome: form.nome,
          sobrenome: form.sobrenome,
          telefone: form.telefone,
          cargo: form.cargo,
          perfil: form.perfil,
          gestor_id: form.gestor_id || undefined,
          todas_categorias: form.todas_categorias,
          categories: form.todas_categorias ? [] : form.category_ids,
        } : item);
      });
      
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar os dados do operador.');
    } finally {
      setSaving(false);
    }
  };

  const valid = form.nome.trim() !== '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        
        {success ? (
          <div className="px-6 py-12 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 mb-2">Operador atualizado!</h3>
            <p className="text-sm text-slate-500 mb-6">As informações foram salvas com sucesso no banco de dados.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">{operator.status === 'pendente' ? 'Editar Convite' : 'Editar Operador'}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{operator.status === 'pendente' ? 'Altere os dados do convite antes do aceite. O e-mail não pode ser alterado.' : 'Altere as permissões e dados pessoais.'}</p>
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
              {/* Email bloqueado */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">E-mail Corporativo (Login) <span className="text-slate-400 font-normal lowercase">- Não editável</span></label>
                <Input type="email" value={operator.email} readOnly disabled className="h-9 text-sm bg-slate-50 text-slate-500 cursor-not-allowed" />
              </div>

              {/* Dados pessoais */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nome *</label>
                  <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sobrenome</label>
                  <Input value={form.sobrenome} onChange={e => setForm(f => ({ ...f, sobrenome: e.target.value }))} className="h-9 text-sm" />
                </div>
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
                      .filter(op => op.status !== 'cancelado' && op.id !== operator.id && (op.perfil === 'gestor' || op.perfil === 'administrador'))
                      .map(op => (
                        <option key={op.id} value={op.id}>{op.nome} {op.sobrenome}</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              {operator.status !== 'pendente' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cargo</label>
                  <Input value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Ex: Comprador Sênior" className="h-9 text-sm" />
                </div>
              )}

              {/* Perfil e Acessos */}
              {operator.status === 'pendente' ? (
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

                  {/* Resumo Dinâmico do Perfil */}
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
                          {MACRO_PROFILES[form.macroProfile].perms.map((p: string, i: number) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>

                      {MACRO_PROFILES[form.macroProfile].rests.length > 0 && (
                        <div className="pt-2 border-t border-slate-200">
                          <span className="font-bold text-red-600 block mb-1">Restrições:</span>
                          <ul className="list-disc pl-5 text-slate-500 space-y-0.5">
                            {MACRO_PROFILES[form.macroProfile].rests.map((p: string, i: number) => (
                              <li key={i}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Perfil de Acesso *</label>
                  <select
                    value={form.perfil}
                    onChange={e => setForm(f => ({ ...f, perfil: e.target.value as OperatorPerfil }))}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="auditor">Auditor/Consulta — Acesso restrito de leitura</option>
                    <option value="solicitante">Solicitante — Apenas requisições (Mobile)</option>
                    <option value="comprador">Comprador — Opera categorias autorizadas</option>
                    <option value="gestor">Gestor — Aprova e delega funções</option>
                    <option value="administrador">Administrador — Acesso total</option>
                  </select>
                </div>
              )}

              {/* Categorias Autorizadas */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Categorias Autorizadas
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={form.todas_categorias}
                      onChange={(e) => setForm(f => ({ ...f, todas_categorias: e.target.checked, category_ids: e.target.checked ? [] : f.category_ids }))}
                    />
                    <span className="text-sm font-semibold text-slate-700">Todas as Categorias</span>
                  </label>
                  
                  {form.todas_categorias ? (
                    <div className="pl-6 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">Inclui:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {categoriesList.map(cat => (
                          <span key={cat.id} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {cat.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="pl-6 grid grid-cols-2 gap-2">
                      {categoriesList.map(cat => (
                        <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            checked={form.category_ids.includes(cat.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setForm(f => ({ ...f, category_ids: [...f.category_ids, cat.id] }));
                              } else {
                                setForm(f => ({ ...f, category_ids: f.category_ids.filter((id: string) => id !== cat.id) }));
                              }
                            }}
                          />
                          <span className="text-xs font-medium text-slate-600 truncate" title={cat.name}>{cat.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 justify-end px-6 pb-6 pt-2">
              <Button variant="outline" onClick={onClose} className="h-9 text-xs rounded-lg">Cancelar</Button>
              <Button
                onClick={handleSave}
                disabled={!valid || saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-bold flex items-center gap-2 rounded-lg px-4 shadow-sm"
              >
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { XCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Operator, OperatorPerfil } from '../../domain/entities/Operator';
import { SupabaseOperatorRepository } from '../../infrastructure/repositories/SupabaseOperatorRepository';
import { useQueryClient } from '@tanstack/react-query';

interface EditOperatorModalProps {
  operator: Operator;
  orgId: string;
  onClose: () => void;
}

export function EditOperatorModal({ operator, orgId, onClose }: EditOperatorModalProps) {
  const queryClient = useQueryClient();
  
  const [form, setForm] = useState({
    nome: operator.nome || '',
    sobrenome: operator.sobrenome || '',
    telefone: operator.telefone || '',
    cargo: operator.cargo || '',
    perfil: operator.perfil as OperatorPerfil,
  });

  const [segmentosSel, setSegmentosSel] = useState<string[]>(operator.segments || []);
  const [todosSegmentos, setTodosSegmentos] = useState(operator.todos_segmentos || false);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const toggleSegmento = (s: string) => {
    setSegmentosSel(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      setErrorMsg("O nome é obrigatório.");
      return;
    }
    
    setSaving(true);
    setErrorMsg('');
    try {
      const repo = new SupabaseOperatorRepository();
      
      await repo.updateOperator(operator.id, {
        nome: form.nome,
        sobrenome: form.sobrenome,
        telefone: form.telefone || undefined,
        cargo: form.cargo || undefined,
        perfil: form.perfil,
        segments: todosSegmentos ? [] : segmentosSel,
        todos_segmentos: todosSegmentos
      });

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
          segments: todosSegmentos ? [] : segmentosSel,
          todos_segmentos: todosSegmentos
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

  const valid = form.nome.trim() && (todosSegmentos || segmentosSel.length > 0);

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
                <h3 className="text-base font-extrabold text-slate-900">Editar Operador</h3>
                <p className="text-xs text-slate-500 mt-0.5">Altere as permissões e dados pessoais.</p>
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
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cargo</label>
                  <Input value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Ex: Comprador Sênior" className="h-9 text-sm" />
                </div>
              </div>

              {/* Perfil */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Perfil de Acesso *</label>
                <select
                  value={form.perfil}
                  onChange={e => setForm(f => ({ ...f, perfil: e.target.value as OperatorPerfil }))}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="consulta">Consulta — Somente leitura</option>
                  <option value="comprador">Comprador — Opera categorias autorizadas</option>
                  <option value="gestor">Gestor — Aprova e delega funções</option>
                  <option value="administrador">Administrador — Acesso total</option>
                </select>
              </div>

              {/* Segmentos */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex justify-between">
                  Categorias Autorizadas
                  <label className="flex items-center gap-1.5 cursor-pointer normal-case">
                    <input
                      type="checkbox"
                      checked={todosSegmentos}
                      onChange={e => setTodosSegmentos(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3"
                    />
                    <span className="text-xs font-semibold text-indigo-600">Acesso a Todas</span>
                  </label>
                </label>
                {!todosSegmentos && (
                  <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    {['Embalagens', 'Matérias-primas', 'Serviços TI', 'MRO', 'Fretes', 'Marketing', 'Limpeza'].map(seg => (
                      <button
                        key={seg}
                        onClick={() => toggleSegmento(seg)}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition-all ${
                          segmentosSel.includes(seg)
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                        }`}
                      >
                        {seg}
                      </button>
                    ))}
                  </div>
                )}
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

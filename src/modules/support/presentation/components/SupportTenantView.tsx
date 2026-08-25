import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/infrastructure/supabase/client';
import { ShieldAlert, Plus, MessageSquare, Clock, CheckCircle, Ticket, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Badge } from '@/shared/components/ui/Badge';

const CATEGORIES = [
  { id: 'access', label: 'Acesso', module: 'Auth' },
  { id: 'company_registration', label: 'Cadastro da Empresa', module: 'Empresas' },
  { id: 'invites', label: 'Convites', module: 'Rede' },
  { id: 'network_partners', label: 'Rede / Parceiros', module: 'Rede' },
  { id: 'materials', label: 'Materiais', module: 'Materiais' },
  { id: 'quotations', label: 'Cotações', module: 'Cotações' },
  { id: 'system_error', label: 'Erro do Sistema', module: 'Sistema' },
  { id: 'other', label: 'Outro', module: 'Geral' },
];

export default function SupportTenantView() {
  const queryClient = useQueryClient();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const [form, setForm] = useState({ 
    subject: '', 
    category: 'access', 
    priority: 'normal', 
    content: '',
    affected_entity_type: null as string | null,
    affected_entity_id: null as string | null
  });

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['tenant_support_tickets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('support_tickets').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: messages } = useQuery({
    queryKey: ['support_messages', selectedTicketId],
    queryFn: async () => {
      if (!selectedTicketId) return [];
      const { data, error } = await supabase.from('support_messages').select('*').eq('ticket_id', selectedTicketId).order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTicketId
  });

  const { data: quotations } = useQuery({
    queryKey: ['tenant_support_quotations'],
    queryFn: async () => {
      const { data: qr } = await supabase.from('quotation_requests').select('id, title, created_at').order('created_at', { ascending: false }).limit(20);
      const { data: sq } = await supabase.from('supplier_quotations').select('id, request_id, created_at, quotation_requests(title)').order('created_at', { ascending: false }).limit(20);
      return {
        requests: qr || [],
        responses: sq || []
      };
    },
    enabled: isNewOpen && form.category === 'quotations'
  });

  const createTicket = useMutation({
    mutationFn: async () => {
      const module = CATEGORIES.find(c => c.id === form.category)?.module || 'Geral';
      const { data, error } = await supabase.rpc('support_create_ticket', {
        p_subject: form.subject,
        p_category: form.category,
        p_module: module,
        p_priority: form.priority,
        p_content: form.content,
        p_affected_entity_type: form.affected_entity_type,
        p_affected_entity_id: form.affected_entity_id
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['tenant_support_tickets'] });
      setIsNewOpen(false);
      setSelectedTicketId(id);
      setForm({ subject: '', category: 'access', priority: 'normal', content: '', affected_entity_type: null, affected_entity_id: null });
    }
  });

  const [replyText, setReplyText] = useState('');
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!selectedTicketId || !replyText.trim()) return;
      const { error } = await supabase.rpc('support_send_message', {
        p_ticket_id: selectedTicketId,
        p_content: replyText
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['support_messages', selectedTicketId] });
      queryClient.invalidateQueries({ queryKey: ['tenant_support_tickets'] });
    }
  });

  const activeTickets = tickets?.filter(t => t.status !== 'closed' && t.status !== 'resolved')?.length || 0;
  const waitingTickets = tickets?.filter(t => t.status === 'waiting_company')?.length || 0;
  const resolvedTickets = tickets?.filter(t => t.status === 'resolved')?.length || 0;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-indigo-600" />
          Meus Chamados (Suporte Hub.IA)
        </h2>
        <Button onClick={() => setIsNewOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Novo Chamado
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 border rounded-xl bg-slate-50 text-center">
          <p className="text-sm font-bold text-slate-500 uppercase">Abertos/Em Andamento</p>
          <p className="text-2xl font-black text-indigo-600">{activeTickets}</p>
        </div>
        <div className="p-4 border rounded-xl bg-amber-50 text-center">
          <p className="text-sm font-bold text-amber-600 uppercase">Aguardando Você</p>
          <p className="text-2xl font-black text-amber-600">{waitingTickets}</p>
        </div>
        <div className="p-4 border rounded-xl bg-emerald-50 text-center">
          <p className="text-sm font-bold text-emerald-600 uppercase">Resolvidos</p>
          <p className="text-2xl font-black text-emerald-600">{resolvedTickets}</p>
        </div>
        <div className="p-4 border rounded-xl bg-slate-50 text-center">
          <p className="text-sm font-bold text-slate-500 uppercase">Total</p>
          <p className="text-2xl font-black text-slate-700">{tickets?.length || 0}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-slate-400">Carregando...</div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-600">Assunto</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Categoria</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Módulo</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Atualizado</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tickets?.map(t => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium">{t.subject}</td>
                  <td className="px-4 py-3 text-slate-500">{CATEGORIES.find(c => c.id === t.category)?.label || t.category}</td>
                  <td className="px-4 py-3 text-slate-500">{t.module}</td>
                  <td className="px-4 py-3"><Badge>{t.status}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{new Date(t.updated_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Button variant="outline" size="sm" onClick={() => setSelectedTicketId(t.id)}>Abrir</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Ticket Modal */}
      {isNewOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold">Novo Chamado</h3>
              <button onClick={() => setIsNewOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Assunto</label>
                <Input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="Ex: Problema de acesso" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Categoria</label>
                  <select 
                    className="w-full h-10 border rounded-md px-3 text-sm bg-white" 
                    value={form.category} 
                    onChange={e => {
                      const newCat = e.target.value;
                      setForm({...form, category: newCat, affected_entity_type: null, affected_entity_id: null});
                    }}
                  >
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Prioridade</label>
                  <select className="w-full h-10 border rounded-md px-3 text-sm bg-white" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                    <option value="low">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>
              
              {form.category === 'quotations' && (
                <div className="bg-slate-50 p-3 rounded-lg border">
                  <label className="text-xs font-bold text-indigo-600 uppercase block mb-2">Vincular cotação ao chamado (Opcional)</label>
                  <select 
                    className="w-full h-10 border rounded-md px-3 text-sm bg-white"
                    value={form.affected_entity_id || ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (!val) {
                        setForm({...form, affected_entity_id: null, affected_entity_type: null});
                      } else {
                        const isReq = quotations?.requests.some(r => r.id === val);
                        setForm({...form, affected_entity_id: val, affected_entity_type: isReq ? 'quotation_request' : 'supplier_quotation'});
                      }
                    }}
                  >
                    <option value="">Não vincular</option>
                    {quotations?.requests.map(q => (
                      <option key={q.id} value={q.id}>Minha Cotação: {q.title}</option>
                    ))}
                    {quotations?.responses.map(sq => (
                      <option key={sq.id} value={sq.id}>Proposta Enviada para: {(sq.quotation_requests as any)?.title || 'Cotação'}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Descrição</label>
                <textarea 
                  className="w-full border rounded-md p-3 text-sm min-h-[120px]" 
                  value={form.content} 
                  onChange={e => setForm({...form, content: e.target.value})}
                  placeholder="Detalhe sua solicitação..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsNewOpen(false)}>Cancelar</Button>
              <Button onClick={() => createTicket.mutate()} disabled={createTicket.isPending || !form.subject.trim() || !form.content.trim()} className="bg-indigo-600 text-white">
                {createTicket.isPending ? 'Enviando...' : 'Abrir Chamado'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {selectedTicketId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-lg">Chamado #{selectedTicketId.substring(0,8)}</h3>
                <p className="text-sm text-slate-500">{tickets?.find(t => t.id === selectedTicketId)?.subject}</p>
              </div>
              <button onClick={() => setSelectedTicketId(null)}><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50">
              {messages?.map(m => (
                <div key={m.id} className={`flex ${m.sender_type === 'tenant' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-xl p-3 ${m.sender_type === 'tenant' ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-800'}`}>
                    <p className="text-[10px] opacity-70 mb-1 font-bold">{m.sender_name_snapshot}</p>
                    <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                    <p className="text-[10px] opacity-50 text-right mt-2">{new Date(m.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t bg-white">
              {tickets?.find(t => t.id === selectedTicketId)?.status === 'closed' ? (
                <div className="text-center text-slate-500 p-2 text-sm">Este chamado foi encerrado.</div>
              ) : (
                <div className="flex gap-2">
                  <textarea 
                    className="flex-1 border rounded-lg p-2 text-sm resize-none" 
                    rows={2} 
                    placeholder="Digite sua resposta..." 
                    value={replyText} 
                    onChange={e => setReplyText(e.target.value)}
                  />
                  <Button className="bg-indigo-600 text-white h-auto" onClick={() => sendMessage.mutate()} disabled={sendMessage.isPending || !replyText.trim()}>
                    Enviar
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

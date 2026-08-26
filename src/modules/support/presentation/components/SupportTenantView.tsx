import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/infrastructure/supabase/client';
import { ShieldAlert, Plus, MessageSquare, Clock, CheckCircle, Ticket, X, Search } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Badge } from '@/shared/components/ui/Badge';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';

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

const STATUS_MAP: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  waiting_company: 'Aguardando você',
  resolved: 'Resolvido',
  closed: 'Encerrado'
};

const PRIORITY_MAP: Record<string, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente'
};

export default function SupportTenantView() {
  const queryClient = useQueryClient();
  const { data: identity } = useAuthenticatedIdentity();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const [form, setForm] = useState({ 
    subject: '', 
    category: 'access', 
    priority: 'normal', 
    content: '',
    affected_entity_type: null as string | null,
    affected_entity_id: null as string | null
  });

  const [replyText, setReplyText] = useState('');

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['my_support_tickets', identity?.organizationId],
    enabled: !!identity?.organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('organization_id', identity!.organizationId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: quotations } = useQuery({
    queryKey: ['support_quotations_lookup'],
    queryFn: async () => {
      const { data: requests } = await supabase.from('quotation_requests').select('id, title, status').order('created_at', { ascending: false }).limit(20);
      const { data: responses } = await supabase.from('supplier_quotations').select('id, status, quotation_requests(title)').order('created_at', { ascending: false }).limit(20);
      return { requests: requests || [], responses: responses || [] };
    }
  });

  const { data: messages } = useQuery({
    queryKey: ['support_messages', selectedTicketId],
    enabled: !!selectedTicketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', selectedTicketId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (!identity?.organizationId) return;
    const channel = supabase
      .channel(`support_tenant_tickets_${identity.organizationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets', filter: `organization_id=eq.${identity.organizationId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['my_support_tickets', identity.organizationId] });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [identity?.organizationId, queryClient]);

  useEffect(() => {
    if (!selectedTicketId) return;
    const channel = supabase
      .channel(`support_tenant_messages_${selectedTicketId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${selectedTicketId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['support_messages', selectedTicketId] });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedTicketId, queryClient]);

  const createTicket = useMutation({
    mutationFn: async () => {
      const moduleStr = CATEGORIES.find(c => c.id === form.category)?.module || 'Geral';
      const { data, error } = await supabase.rpc('support_create_ticket', {
        p_subject: form.subject,
        p_category: form.category,
        p_module: moduleStr,
        p_priority: form.priority,
        p_content: form.content,
        p_affected_entity_type: form.affected_entity_type,
        p_affected_entity_id: form.affected_entity_id
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_support_tickets'] });
      setIsNewOpen(false);
      setForm({ subject: '', category: 'access', priority: 'normal', content: '', affected_entity_type: null, affected_entity_id: null });
    }
  });

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
      queryClient.invalidateQueries({ queryKey: ['support_messages', selectedTicketId] });
      queryClient.invalidateQueries({ queryKey: ['my_support_tickets'] });
      setReplyText('');
    }
  });

  const closeTicket = useMutation({
    mutationFn: async () => {
      if (!selectedTicketId) return;
      const { error } = await supabase.rpc('support_close_ticket', {
        p_ticket_id: selectedTicketId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_support_tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support_messages', selectedTicketId] });
      setIsCloseConfirmOpen(false);
    }
  });

  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    return tickets.filter(t => {
      const shortId = '#' + t.id.substring(0,8).toUpperCase();
      const searchMatch = !searchTerm || shortId.includes(searchTerm.toUpperCase()) || t.subject.toLowerCase().includes(searchTerm.toLowerCase());
      const catMatch = !filterCategory || t.category === filterCategory;
      const statusMatch = !filterStatus || t.status === filterStatus;
      const prioMatch = !filterPriority || t.priority === filterPriority;
      return searchMatch && catMatch && statusMatch && prioMatch;
    });
  }, [tickets, searchTerm, filterCategory, filterStatus, filterPriority]);

  const hasActiveFilters = !!(searchTerm || filterCategory || filterStatus || filterPriority);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Meus Chamados</h2>
          <p className="text-slate-500">Histórico de solicitações de suporte da sua empresa.</p>
        </div>
        <Button onClick={() => setIsNewOpen(true)} className="gap-2 bg-indigo-600 text-white">
          <Plus className="w-4 h-4" /> Novo Chamado
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white p-4 rounded-xl border flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">{tickets?.length || 0}</p>
            <p className="text-xs text-slate-500 uppercase font-semibold">Total</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">{tickets?.filter(t => t.status === 'resolved' || t.status === 'closed').length || 0}</p>
            <p className="text-xs text-slate-500 uppercase font-semibold">Resolvidos</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">{tickets?.filter(t => t.status === 'open' || t.status === 'in_progress').length || 0}</p>
            <p className="text-xs text-slate-500 uppercase font-semibold">Em andamento</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">{tickets?.filter(t => t.status === 'waiting_company').length || 0}</p>
            <p className="text-xs text-slate-500 uppercase font-semibold">Aguardando você</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border flex flex-col md:flex-row gap-3 items-center flex-wrap">
        <div className="relative flex-1 w-full min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input 
            className="pl-9 w-full" 
            placeholder="Buscar por chamado ou assunto..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>
        <select className="border rounded-md px-3 h-10 text-sm bg-white" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">Todas as categorias</option>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select className="border rounded-md px-3 h-10 text-sm bg-white" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="open">Aberto</option>
          <option value="in_progress">Em andamento</option>
          <option value="waiting_company">Aguardando você</option>
          <option value="resolved">Resolvido</option>
          <option value="closed">Encerrado</option>
        </select>
        <select className="border rounded-md px-3 h-10 text-sm bg-white" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="">Todas prioridades</option>
          <option value="low">Baixa</option>
          <option value="normal">Normal</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(''); setFilterCategory(''); setFilterStatus(''); setFilterPriority(''); }}>
            Limpar
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-600 w-[100px]">Chamado</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Assunto</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 w-32">Categoria</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 w-28">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 w-24">Prioridade</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 w-40">Atualizado</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 w-20">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map(t => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">#{t.id.substring(0,8).toUpperCase()}</td>
                    <td className="px-4 py-3 font-medium truncate max-w-[300px]" title={t.subject}>
                      {t.subject}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{CATEGORIES.find(c => c.id === t.category)?.label || t.category}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><Badge>{STATUS_MAP[t.status] || t.status}</Badge></td>
                    <td className="px-4 py-3 whitespace-nowrap"><Badge variant="outline">{PRIORITY_MAP[t.priority] || t.priority}</Badge></td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(t.updated_at).toLocaleString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Button variant="outline" size="sm" onClick={() => setSelectedTicketId(t.id)}>Abrir</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredTickets.length === 0 && <div className="p-8 text-center text-slate-500 border-t">Nenhum chamado encontrado.</div>}
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
          <div className="bg-white rounded-2xl w-full max-w-3xl flex flex-col overflow-hidden shadow-2xl" style={{ maxHeight: '90vh' }}>
            {(() => {
              const currentTicket = tickets?.find(t => t.id === selectedTicketId);
              return (
                <>
                  <div className="p-4 border-b flex justify-between items-start bg-slate-50">
                    <div className="space-y-3 w-full mr-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-xl text-slate-800">Chamado #{selectedTicketId.substring(0,8).toUpperCase()}</h3>
                          <Badge>{STATUS_MAP[currentTicket?.status || ''] || currentTicket?.status}</Badge>
                        </div>
                        {currentTicket?.status !== 'closed' && (
                          <Button variant="outline" size="sm" onClick={() => setIsCloseConfirmOpen(true)} className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                            Encerrar chamado
                          </Button>
                        )}
                      </div>
                      <p className="text-base text-slate-700 font-medium">{currentTicket?.subject}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-500 pt-2 border-t mt-2">
                        <div><span className="block font-semibold uppercase">Categoria</span> {CATEGORIES.find(c => c.id === currentTicket?.category)?.label || currentTicket?.category}</div>
                        <div><span className="block font-semibold uppercase">Prioridade</span> {PRIORITY_MAP[currentTicket?.priority || ''] || currentTicket?.priority}</div>
                        <div><span className="block font-semibold uppercase">Abertura</span> {currentTicket ? new Date(currentTicket.created_at).toLocaleString() : ''}</div>
                        <div><span className="block font-semibold uppercase">Atualização</span> {currentTicket ? new Date(currentTicket.updated_at).toLocaleString() : ''}</div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedTicketId(null)} className="p-1 hover:bg-slate-200 rounded-md"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50 flex flex-col">
                    {messages?.length === 0 && (
                      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                        Nenhuma mensagem ainda.
                      </div>
                    )}
                    {messages?.map(m => (
                      <div key={m.id} className={`flex ${m.sender_type === 'tenant' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] rounded-xl p-3 shadow-sm ${m.sender_type === 'tenant' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border text-slate-800 rounded-bl-none'}`}>
                          <p className="text-[10px] opacity-70 mb-1 font-bold">
                            {m.sender_type === 'tenant' ? m.sender_name_snapshot : (m.sender_name_snapshot || 'Suporte Hub.IA')}
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                          <p className="text-[10px] opacity-50 text-right mt-2">{new Date(m.created_at).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 border-t bg-white">
                    {currentTicket?.status === 'closed' ? (
                      <div className="text-center text-slate-500 p-2 text-sm bg-slate-50 rounded-lg">Este chamado foi encerrado.</div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <textarea 
                          className="w-full border rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                          rows={3} 
                          placeholder="Digite sua resposta..." 
                          value={replyText} 
                          onChange={e => setReplyText(e.target.value)}
                        />
                        <div className="flex justify-end">
                          <Button className="bg-indigo-600 text-white px-6" onClick={() => sendMessage.mutate()} disabled={sendMessage.isPending || !replyText.trim()}>
                            {sendMessage.isPending ? 'Enviando...' : 'Enviar Mensagem'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {isCloseConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800">Encerrar este chamado?</h3>
            <p className="text-slate-600 text-sm">
              O chamado será encerrado e permanecerá disponível no histórico da sua empresa.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsCloseConfirmOpen(false)} disabled={closeTicket.isPending}>
                Cancelar
              </Button>
              <Button onClick={() => closeTicket.mutate()} disabled={closeTicket.isPending} className="bg-red-600 text-white hover:bg-red-700">
                {closeTicket.isPending ? 'Encerrando...' : 'Encerrar chamado'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/infrastructure/supabase/client';
import { ShieldAlert, FileText, CheckCircle, Clock, Search, X, Ticket } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Badge } from '@/shared/components/ui/Badge';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = [
  { id: 'access', label: 'Acesso', module: 'Auth' },
  { id: 'company_registration', label: 'Cadastro da Empresa', module: 'Empresas' },
  { id: 'invites', label: 'Convites', module: 'Rede' },
  { id: 'network_partners', label: 'Rede / Parceiros', module: 'Rede' },
  { id: 'materials', label: 'Materiais', module: 'Materiais' },
  { id: 'master_data_request', label: 'Solicitação de cadastro', module: 'Cadastros Master' },
  { id: 'quotations', label: 'Cotações', module: 'Cotações' },
  { id: 'system_error', label: 'Erro do Sistema', module: 'Sistema' },
  { id: 'other', label: 'Outro', module: 'Geral' },
];

const STATUS_MAP: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  waiting_company: 'Aguardando empresa',
  resolved: 'Resolvido',
  closed: 'Encerrado'
};

const PRIORITY_MAP: Record<string, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente'
};

export default function SupportAdminView() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterRequestType, setFilterRequestType] = useState('');

  const [replyText, setReplyText] = useState('');
  const [reportedContext, setReportedContext] = useState<any>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['admin_support_tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*, organizations(name, cnpj)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
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
      queryClient.invalidateQueries({ queryKey: ['admin_support_tickets'] });
      setReplyText('');
    }
  });

  useEffect(() => {
    const channel = supabase
      .channel('support_admin_tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin_support_tickets'] });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  useEffect(() => {
    if (!selectedTicketId) return;
    const channel = supabase
      .channel(`support_admin_messages_${selectedTicketId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${selectedTicketId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['support_messages', selectedTicketId] });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedTicketId, queryClient]);

  const updateTicket = useMutation({
    mutationFn: async (vars: { status?: string, priority?: string }) => {
      if (!selectedTicketId) return;
      const current = tickets?.find(t => t.id === selectedTicketId);
      if (!current) return;
      const { error } = await supabase.rpc('support_update_ticket', {
        p_ticket_id: selectedTicketId,
        p_status: vars.status || current.status,
        p_priority: vars.priority || current.priority
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_support_tickets'] });
    }
  });

  const fetchContext = async () => {
    if (!selectedTicketId) return;
    setIsLoadingContext(true);
    try {
      const { data, error } = await supabase.rpc('support_get_reported_quotation_context', {
        p_ticket_id: selectedTicketId
      });
      if (error) throw error;
      setReportedContext(data);
    } finally {
      setIsLoadingContext(false);
    }
  };

  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    return tickets.filter(t => {
      const shortId = '#' + t.id.substring(0,8).toUpperCase();
      const orgName = ((t.organizations as any)?.name || '').toLowerCase();
      const searchMatch = !searchTerm || shortId.includes(searchTerm.toUpperCase()) || t.subject.toLowerCase().includes(searchTerm.toLowerCase()) || orgName.includes(searchTerm.toLowerCase());
      const catMatch = !filterCategory || t.category === filterCategory;
      const statusMatch = !filterStatus || t.status === filterStatus;
      const prioMatch = !filterPriority || t.priority === filterPriority;
      const requestTypeMatch = !filterRequestType || t.request_type === filterRequestType;
      return searchMatch && catMatch && statusMatch && prioMatch && requestTypeMatch;
    });
  }, [tickets, searchTerm, filterCategory, filterStatus, filterPriority, filterRequestType]);

  const hasActiveFilters = !!(searchTerm || filterCategory || filterStatus || filterPriority || filterRequestType);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Suporte Global</h2>
          <p className="text-slate-500">Gestão de chamados de todas as empresas da plataforma.</p>
        </div>
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
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">{tickets?.filter(t => t.status === 'open').length || 0}</p>
            <p className="text-xs text-slate-500 uppercase font-semibold">Abertos</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">{tickets?.filter(t => t.status === 'waiting_company').length || 0}</p>
            <p className="text-xs text-slate-500 uppercase font-semibold">Aguardando Retorno</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border flex flex-col md:flex-row gap-3 items-center flex-wrap">
        <div className="relative flex-1 w-full min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input 
            className="pl-9 w-full" 
            placeholder="Buscar chamado, assunto ou empresa..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>
        <select className="border rounded-md px-3 h-10 text-sm bg-white" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">Todas as categorias</option>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        {(filterCategory === 'master_data_request' || filterRequestType) && (
          <select className="border rounded-md px-3 h-10 text-sm bg-white" value={filterRequestType} onChange={e => setFilterRequestType(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="category">Categorias</option>
            <option value="segment">Segmentos</option>
            <option value="certification">Certificações</option>
          </select>
        )}
        <select className="border rounded-md px-3 h-10 text-sm bg-white" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="open">Aberto</option>
          <option value="in_progress">Em andamento</option>
          <option value="waiting_company">Aguardando empresa</option>
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
          <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(''); setFilterCategory(''); setFilterStatus(''); setFilterPriority(''); setFilterRequestType(''); }}>
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
                  <th className="px-4 py-3 font-semibold text-slate-600">Empresa</th>
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
                    <td className="px-4 py-3 font-medium truncate max-w-[150px]" title={(t.organizations as any)?.name}>
                      {(t.organizations as any)?.name}
                    </td>
                    <td className="px-4 py-3 font-medium truncate max-w-[200px]" title={t.subject}>
                      {t.subject}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{CATEGORIES.find(c => c.id === t.category)?.label || t.category}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><Badge>{STATUS_MAP[t.status] || t.status}</Badge></td>
                    <td className="px-4 py-3 whitespace-nowrap"><Badge variant="outline">{PRIORITY_MAP[t.priority] || t.priority}</Badge></td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(t.updated_at).toLocaleString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Button variant="outline" size="sm" onClick={() => {
                        setReportedContext(null);
                        setSelectedTicketId(t.id);
                      }}>Abrir</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredTickets.length === 0 && <div className="p-8 text-center text-slate-500 border-t">Nenhum chamado encontrado.</div>}
        </div>
      )}

      {/* Chat Modal */}
      {selectedTicketId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl flex overflow-hidden shadow-2xl" style={{ maxHeight: '90vh', minHeight: '600px' }}>
            
            {(() => {
              const currentTicket = tickets?.find(t => t.id === selectedTicketId);
              return (
                <>
                  {/* Chat Area */}
                  <div className="flex-1 flex flex-col border-r bg-slate-50/50">
                    <div className="p-4 border-b flex justify-between items-center bg-white">
                      <div>
                        <h3 className="font-bold text-xl text-slate-800">Chamado #{selectedTicketId.substring(0,8).toUpperCase()}</h3>
                        <p className="text-sm text-slate-500 font-medium">{currentTicket?.subject}</p>
                      </div>
                    </div>
                    
                    <div className="flex-1 p-4 overflow-y-auto space-y-4 flex flex-col">
                      {messages?.length === 0 && (
                        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                          Nenhuma mensagem ainda.
                        </div>
                      )}
                      {messages?.map(m => (
                        <div key={m.id} className={`flex ${m.sender_type === 'tenant' ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[80%] rounded-xl p-3 shadow-sm ${m.sender_type === 'tenant' ? 'bg-white border text-slate-800 rounded-bl-none' : 'bg-indigo-600 text-white rounded-br-none'}`}>
                            <p className="text-[10px] opacity-70 mb-1 font-bold">
                              {m.sender_type === 'tenant' ? (m.sender_name_snapshot || 'Empresa') : (m.sender_name_snapshot || 'Suporte Hub.IA')}
                            </p>
                            <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                            <p className="text-[10px] opacity-50 text-right mt-2">{new Date(m.created_at).toLocaleTimeString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 border-t bg-white">
                      <div className="flex flex-col gap-2">
                        <textarea 
                          className="w-full border rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                          rows={3} 
                          placeholder="Digite a resposta do suporte..." 
                          value={replyText} 
                          onChange={e => setReplyText(e.target.value)}
                        />
                        <div className="flex justify-end">
                          <Button className="bg-indigo-600 text-white px-6" onClick={() => sendMessage.mutate()} disabled={sendMessage.isPending || !replyText.trim()}>
                            {sendMessage.isPending ? 'Enviando...' : 'Responder Chamado'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar Details */}
                  <div className="w-96 bg-white flex flex-col">
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-slate-800">Gerenciamento</h3>
                      <button onClick={() => setSelectedTicketId(null)} className="p-1 hover:bg-slate-200 rounded-md"><X className="w-5 h-5" /></button>
                    </div>
                    
                    <div className="p-4 space-y-6 flex-1 overflow-y-auto text-sm">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Status</label>
                        <select 
                          className="w-full border rounded-md p-2.5 bg-slate-50"
                          value={currentTicket?.status}
                          onChange={e => updateTicket.mutate({ status: e.target.value })}
                          disabled={updateTicket.isPending}
                        >
                          <option value="open">Aberto</option>
                          <option value="in_progress">Em andamento</option>
                          <option value="waiting_company">Aguardando empresa</option>
                          <option value="resolved">Resolvido</option>
                          <option value="closed">Encerrado</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Prioridade</label>
                        <select 
                          className="w-full border rounded-md p-2.5 bg-slate-50"
                          value={currentTicket?.priority}
                          onChange={e => updateTicket.mutate({ priority: e.target.value })}
                          disabled={updateTicket.isPending}
                        >
                          <option value="low">Baixa</option>
                          <option value="normal">Normal</option>
                          <option value="high">Alta</option>
                          <option value="urgent">Urgente</option>
                        </select>
                      </div>

                      <div className="pt-4 border-t space-y-3">
                        {currentTicket?.category === 'master_data_request' && (() => {
                          const payload = (currentTicket.request_payload || {}) as Record<string, string>;
                          const labels: Record<string, string> = { category: 'Categoria', segment: 'Segmento', certification: 'Certificação' };
                          const routeByType: Record<string, string> = { category: '/admin/categorias', segment: '/admin/segmentos', certification: '/admin/certificacoes' };
                          const actionByType: Record<string, string> = { category: 'Cadastrar categoria', segment: 'Cadastrar segmento', certification: 'Cadastrar certificação' };
                          return (
                            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
                              <p className="text-xs font-extrabold uppercase tracking-wider text-indigo-700">Solicitação de cadastro</p>
                              <div><span className="block text-[10px] font-bold uppercase text-slate-500">Tipo</span><span>{labels[currentTicket.request_type] || currentTicket.request_type}</span></div>
                              <div><span className="block text-[10px] font-bold uppercase text-slate-500">Nome</span><span className="font-semibold">{payload.name || '—'}</span></div>
                              <div><span className="block text-[10px] font-bold uppercase text-slate-500">Descrição</span><span>{payload.description || '—'}</span></div>
                              <div><span className="block text-[10px] font-bold uppercase text-slate-500">Justificativa</span><span>{payload.reason || '—'}</span></div>
                              {payload.issuer && <div><span className="block text-[10px] font-bold uppercase text-slate-500">Órgão emissor / referência</span><span>{payload.issuer}</span></div>}
                              {payload.parent_category_id && <div><span className="block text-[10px] font-bold uppercase text-slate-500">Categoria pai sugerida</span><span>{payload.parent_category_id}</span></div>}
                              <Button
                                className="w-full bg-indigo-600 text-white"
                                onClick={() => {
                                  const params = new URLSearchParams({ prefill_name: payload.name || '', prefill_description: payload.description || '' });
                                  if (payload.parent_category_id) params.set('prefill_parent_id', payload.parent_category_id);
                                  navigate(`${routeByType[currentTicket.request_type]}?${params.toString()}`);
                                }}
                              >
                                {actionByType[currentTicket.request_type] || 'Abrir cadastro'}
                              </Button>
                              <p className="text-[10px] text-slate-500">O cadastro só será criado após revisão e confirmação na tela administrativa.</p>
                            </div>
                          );
                        })()}
                        <div>
                          <span className="font-semibold text-slate-600 block text-xs uppercase mb-0.5">Empresa</span>
                          <span className="text-slate-800">{(currentTicket?.organizations as any)?.name}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-600 block text-xs uppercase mb-0.5">CNPJ</span>
                          <span className="text-slate-800">{(currentTicket?.organizations as any)?.cnpj}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-600 block text-xs uppercase mb-0.5">Categoria</span>
                          <span className="text-slate-800">{CATEGORIES.find(c => c.id === currentTicket?.category)?.label || currentTicket?.category}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-600 block text-xs uppercase mb-0.5">Aberto em</span>
                          <span className="text-slate-800">{currentTicket?.created_at ? new Date(currentTicket.created_at).toLocaleString() : ''}</span>
                        </div>
                      </div>

                      {currentTicket?.affected_entity_type && (
                        <div className="pt-4 border-t">
                          <label className="text-xs font-bold text-amber-600 uppercase block mb-2">Contexto Reportado</label>
                          <p className="text-xs text-slate-500 mb-3">Este chamado está vinculado a uma cotação.</p>
                          
                          {!reportedContext ? (
                            <Button variant="outline" size="sm" className="w-full text-xs flex items-center justify-center gap-2" onClick={fetchContext} disabled={isLoadingContext}>
                              <FileText className="w-4 h-4" /> Visualizar Ocorrência
                            </Button>
                          ) : (
                            <div className="bg-slate-50 p-3 rounded border text-xs space-y-2 break-words max-h-48 overflow-y-auto">
                              <p className="font-bold text-indigo-700">Snapshot de Auditoria Gerado</p>
                              {Object.entries(reportedContext).map(([key, val]) => (
                                <div key={key}>
                                  <span className="font-semibold block opacity-70">{key}</span>
                                  <span>{String(val)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

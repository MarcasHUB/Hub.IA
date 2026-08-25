import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/infrastructure/supabase/client';
import { ShieldAlert, Plus, MessageSquare, Clock, CheckCircle, Ticket, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Badge } from '@/shared/components/ui/Badge';

const CATEGORIES = [
  { id: 'access', label: 'Acesso' },
  { id: 'company_registration', label: 'Cadastro da Empresa' },
  { id: 'invites', label: 'Convites' },
  { id: 'network_partners', label: 'Rede / Parceiros' },
  { id: 'materials', label: 'Materiais' },
  { id: 'quotations', label: 'Cotações' },
  { id: 'system_error', label: 'Erro do Sistema' },
  { id: 'other', label: 'Outro' },
];

export default function SupportAdminView() {
  const queryClient = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['admin_support_tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          organizations(name, cnpj)
        `)
        .order('updated_at', { ascending: false });
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
      queryClient.invalidateQueries({ queryKey: ['admin_support_tickets'] });
    }
  });

  const updateTicket = useMutation({
    mutationFn: async ({ status, priority }: { status?: string, priority?: string }) => {
      if (!selectedTicketId) return;
      const { error } = await supabase.rpc('support_update_ticket', {
        p_ticket_id: selectedTicketId,
        p_status: status || null,
        p_priority: priority || null
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_support_tickets'] });
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
          Painel de Suporte Global
        </h2>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 border rounded-xl bg-slate-50 text-center">
          <p className="text-sm font-bold text-slate-500 uppercase">Abertos</p>
          <p className="text-2xl font-black text-indigo-600">{activeTickets}</p>
        </div>
        <div className="p-4 border rounded-xl bg-amber-50 text-center">
          <p className="text-sm font-bold text-amber-600 uppercase">Aguardando Empresa</p>
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
                <th className="px-4 py-3 font-semibold text-slate-600">Empresa</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Assunto</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Categoria</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Prioridade</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Atualizado</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tickets?.map(t => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium">{(t.organizations as any)?.name}</td>
                  <td className="px-4 py-3 font-medium">{t.subject}</td>
                  <td className="px-4 py-3 text-slate-500">{CATEGORIES.find(c => c.id === t.category)?.label || t.category}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{t.priority}</Badge></td>
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

      {/* Chat Modal */}
      {selectedTicketId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[85vh] flex overflow-hidden">
            
            {/* Chat Area */}
            <div className="flex-1 flex flex-col border-r">
              <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-bold text-lg">Chamado #{selectedTicketId.substring(0,8)}</h3>
                  <p className="text-sm text-slate-500">{tickets?.find(t => t.id === selectedTicketId)?.subject}</p>
                </div>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50">
                {messages?.map(m => (
                  <div key={m.id} className={`flex ${m.sender_type === 'tenant' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[70%] rounded-xl p-3 ${m.sender_type === 'tenant' ? 'bg-white border text-slate-800' : 'bg-indigo-600 text-white'}`}>
                      <p className="text-[10px] opacity-70 mb-1 font-bold">{m.sender_name_snapshot}</p>
                      <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                      <p className="text-[10px] opacity-50 text-right mt-2">{new Date(m.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t bg-white">
                <div className="flex gap-2">
                  <textarea 
                    className="flex-1 border rounded-lg p-2 text-sm resize-none" 
                    rows={2} 
                    placeholder="Digite a resposta do suporte..." 
                    value={replyText} 
                    onChange={e => setReplyText(e.target.value)}
                  />
                  <Button className="bg-indigo-600 text-white h-auto" onClick={() => sendMessage.mutate()} disabled={sendMessage.isPending || !replyText.trim()}>
                    Responder
                  </Button>
                </div>
              </div>
            </div>

            {/* Sidebar Details */}
            <div className="w-80 bg-white flex flex-col">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold">Gerenciamento</h3>
                <button onClick={() => setSelectedTicketId(null)}><X className="w-5 h-5" /></button>
              </div>
              
              <div className="p-4 space-y-6 flex-1 overflow-y-auto text-sm">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Status</label>
                  <select 
                    className="w-full border rounded p-2"
                    value={tickets?.find(t => t.id === selectedTicketId)?.status}
                    onChange={e => updateTicket.mutate({ status: e.target.value })}
                    disabled={updateTicket.isPending}
                  >
                    <option value="open">Aberto</option>
                    <option value="in_progress">Em Atendimento</option>
                    <option value="waiting_company">Aguardando Empresa</option>
                    <option value="resolved">Resolvido</option>
                    <option value="closed">Fechado</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Prioridade</label>
                  <select 
                    className="w-full border rounded p-2"
                    value={tickets?.find(t => t.id === selectedTicketId)?.priority}
                    onChange={e => updateTicket.mutate({ priority: e.target.value })}
                    disabled={updateTicket.isPending}
                  >
                    <option value="low">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                <div className="pt-4 border-t space-y-2">
                  <p><span className="font-semibold text-slate-600 block text-xs">Empresa</span>
                  {(tickets?.find(t => t.id === selectedTicketId)?.organizations as any)?.name}
                  </p>
                  <p><span className="font-semibold text-slate-600 block text-xs">CNPJ</span>
                  {(tickets?.find(t => t.id === selectedTicketId)?.organizations as any)?.cnpj}
                  </p>
                  <p><span className="font-semibold text-slate-600 block text-xs">Aberto em</span>
                  {tickets?.find(t => t.id === selectedTicketId)?.created_at ? new Date(tickets?.find(t => t.id === selectedTicketId)?.created_at as string).toLocaleString() : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

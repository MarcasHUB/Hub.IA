import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, CheckCheck, Check, Search } from 'lucide-react';
import { supabase } from '@/infrastructure/supabase/client';
import { useChatDrawer } from '../context/ChatDrawerContext';
import { Input } from '@/shared/components/ui/Input';
import { cn } from '@/shared/utils/cn';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';

interface Conversation {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerSegment: string;
  partnerInitials: string;
  partnerGradient: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isOnline: boolean;
}

export default function MessagesPage() {
  const { data: identity } = useAuthenticatedIdentity();
  const navigate = useNavigate();
  const { openChat } = useChatDrawer();
  const activeOrgId = identity?.organizationId || null;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadConversations() {
      if (!activeOrgId) {
        setLoading(false);
        return;
      }
      
      try {
        const { data: convs, error } = await supabase
          .from('conversations')
          .select(`
            id,
            company_a_id,
            company_b_id,
            updated_at,
            created_at,
            org_a:organizations!company_a_id(id, razao_social, nome_fantasia),
            org_b:organizations!company_b_id(id, razao_social, nome_fantasia),
            messages!inner(
              content,
              created_at,
              read_at,
              sender_organization_id
            )
          `)
          .or(`company_a_id.eq.${activeOrgId},company_b_id.eq.${activeOrgId}`);
          
        if (error) throw error;
        
        if (convs) {
          const mapped = convs.map(c => {
            const isA = c.company_a_id === activeOrgId;
            const partnerId = isA ? c.company_b_id : c.company_a_id;
            const rawPartner = isA ? c.org_b : c.org_a;
            const partnerObj = Array.isArray(rawPartner) ? rawPartner[0] : rawPartner;
            const pName = partnerObj?.razao_social || 'Empresa Parceria';
            
            return {
              id: c.id,
              partnerId: partnerId,
              partnerName: pName,
              partnerSegment: 'Não definido',
              partnerInitials: pName.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase(),
              partnerGradient: 'from-indigo-500 to-violet-600',
              lastMessage: 'Conversa iniciada',
              lastMessageTime: new Date(c.updated_at),
              unreadCount: 0,
              isOnline: true
            };
          });
          setConversations(mapped);
        }
      } catch (e) {
         console.error('Error loading conversations', e);
      } finally {
         setLoading(false);
      }
    }
    
    loadConversations();
  }, [activeOrgId]);

  const filteredConversations = conversations.filter((c: Conversation) =>
    c.partnerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 bg-white flex flex-col font-sans">
      <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Mensagens</h1>
          <p className="text-sm text-slate-500">Histórico de conversas B2B.</p>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar com Lista */}
        <div className="w-96 border-r border-slate-200 flex flex-col bg-white shrink-0">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Pesquisar..."
                className="pl-9 h-10 w-full"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-slate-500">Carregando conversas...</div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <MessageSquare className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="font-bold text-slate-900">Nenhuma conversa</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-[250px]">
                  Você ainda não possui conversas comerciais ativas.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => openChat(conv.partnerId, { name: conv.partnerName, isConnected: true })}
                    className="w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-start gap-4"
                  >
                    <div className="relative flex-shrink-0">
                      <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${conv.partnerGradient} flex items-center justify-center text-white font-bold text-xs`}>
                        {conv.partnerInitials}
                      </div>
                      {conv.isOnline && (
                        <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <p className="font-bold text-sm text-slate-900 truncate">{conv.partnerName}</p>
                        <span className="text-[10px] text-slate-400">
                          {conv.lastMessageTime.toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{conv.lastMessage}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Empty State na Área Principal */}
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-center p-8">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
            <MessageSquare className="h-10 w-10 text-slate-300" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Selecione uma conversa</h2>
          <p className="text-slate-500 max-w-md">
            Escolha uma conversa na lista ao lado ou abra o chat direto pelo perfil de um parceiro na rede.
          </p>
        </div>
      </div>
    </div>
  );
}

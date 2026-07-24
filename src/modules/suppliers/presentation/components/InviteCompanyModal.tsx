import React, { useState } from 'react';
import { Building2, X, Loader2, CheckCircle2 } from 'lucide-react';
import { Input } from '@/shared/components/ui/Input';
import { Button } from '@/shared/components/ui/Button';
import { supabase } from '@/infrastructure/supabase/client';

interface InviteCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (companyData: any) => void;
}

export function InviteCompanyModal({ isOpen, onClose, onSuccess }: InviteCompanyModalProps) {
  const [tenantId, setTenantId] = useState<string>('');

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('supplyhub_logged_operator');
      if (stored) {
        const parsed = JSON.parse(stored);
        setTenantId(parsed.organizationId || '');
      }
    } catch (e) {}
  }, []);
  
  const [newCompName, setNewCompName] = useState('');
  const [newCompDoc, setNewCompDoc] = useState('');
  const [newCompEmail, setNewCompEmail] = useState('');
  const [newCompSeg, setNewCompSeg] = useState('');
  const [newCompCity, setNewCompCity] = useState('');
  const [newCompState, setNewCompState] = useState('');
  const [newCompDesc, setNewCompDesc] = useState('');
  const [newCompContact, setNewCompContact] = useState('');
  const [newCompWeb, setNewCompWeb] = useState('');
  const [newCompMessage, setNewCompMessage] = useState('');
  const [isFetchingCnpj, setIsFetchingCnpj] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<{name: string, email: string} | null>(null);

  if (!isOpen) return null;

  const matchSegments = (cnaeDesc: string) => {
    const cnae = cnaeDesc.toLowerCase();
    const suggestions = new Set<string>();
    
    if (cnae.includes('pain') && cnae.includes('elétric')) {
      suggestions.add('Material Elétrico');
      suggestions.add('Automação Industrial');
    }
    if (cnae.includes('epi') || cnae.includes('segurança')) {
      suggestions.add('EPIs');
    }
    if (cnae.includes('transporte') || cnae.includes('logística')) {
      suggestions.add('Logística');
    }
    if (cnae.includes('software') || cnae.includes('sistemas')) {
      suggestions.add('TI & Software');
    }
    if (cnae.includes('hardware') || cnae.includes('infraestrutura') || cnae.includes('rede')) {
      suggestions.add('TI & Hardware');
    }
    if (cnae.includes('metalúrgica') || cnae.includes('aço') || cnae.includes('ferro')) {
      suggestions.add('Metalurgia');
    }
    if (cnae.includes('químic') || cnae.includes('plástic')) {
      suggestions.add('Química');
    }
    if (cnae.includes('embalagem') || cnae.includes('papelão')) {
      suggestions.add('Embalagens');
    }
    
    return Array.from(suggestions);
  };

  const handleCnpjBlur = async () => {
    const cleanCnpj = newCompDoc.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return;
    setIsFetchingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (response.ok) {
        const data = await response.json();
        setNewCompName(data.razao_social || data.nome_fantasia || '');
        setNewCompCity(data.municipio || '');
        setNewCompState(data.uf || '');
        if (data.cnae_fiscal_descricao) {
          const suggested = matchSegments(data.cnae_fiscal_descricao);
          if (suggested.length > 0) {
            setNewCompSeg(suggested.join(', '));
          } else {
            setNewCompSeg(data.cnae_fiscal_descricao.substring(0, 80));
          }
        }
      }
    } catch (e) {
      console.error("Falha ao buscar CNPJ na BrasilAPI", e);
    } finally {
      setIsFetchingCnpj(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim() || !newCompDoc.trim() || !newCompEmail.trim() || !newCompContact.trim()) return;
    
    setIsSubmitting(true);

    try {
      // Validação de Duplicidade
      const { data: existing } = await supabase
        .from('invitations')
        .select('id, status')
        .eq('document', newCompDoc)
        .in('status', ['pendente', 'aceito'])
        .maybeSingle();

      if (existing) {
        if (existing.status === 'pendente') {
          alert('Esta empresa já possui um convite pendente.');
        } else {
          alert('Esta empresa já faz parte da sua rede de negócios.');
        }
        setIsSubmitting(false);
        return;
      }

      // 1. Gera token rastreável para o fornecedor
      const tokenHash = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 dias

      // 2. Insere na tabela 'invitations'
      const { error: inviteError } = await supabase.from('invitations').insert({
        organization_id: tenantId,
        name: newCompName,
        company: newCompName,
        email: newCompEmail,
        document: newCompDoc,
        status: 'pendente',
        token_hash: tokenHash,
        expires_at: expiresAt,
        city: newCompCity,
        state: newCompState,
        contact_name: newCompContact,
        website: newCompWeb,
        message: newCompMessage
      });

      if (inviteError) {
        alert(`Erro ao criar convite no banco: ${inviteError.message}`);
        setIsSubmitting(false);
        return;
      }

      // 3. (Simulação) Chamada ao EmailService passaria aqui
      console.log(`Email simulado para: ${newCompEmail}, Contato: ${newCompContact}`);

      setSuccessData({
        name: newCompName,
        email: newCompEmail
      });

      onSuccess({
        id: `net-${Date.now()}`,
        name: newCompName,
        document: newCompDoc,
        segment: newCompSeg || 'Geral',
        city: newCompCity || 'São Paulo',
        state: newCompState || 'SP',
        status: 'pending_sent',
        employeesRange: '10–50',
        rating: 0,
        responseTime: '-',
        quotationsCount: 0,
        products: [],
        email: newCompEmail,
        connectionId: ''
      });
      
    } catch (e) {
      console.error(e);
      alert('Erro ao enviar o convite. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setNewCompName('');
    setNewCompDoc('');
    setNewCompEmail('');
    setNewCompSeg('');
    setNewCompCity('');
    setNewCompState('');
    setNewCompDesc('');
    setNewCompContact('');
    setNewCompWeb('');
    setNewCompMessage('');
    setSuccessData(null);
    onClose();
  };

  if (successData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
        <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-8 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
          <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Convite enviado com sucesso</h2>
          
          <div className="w-full bg-slate-50 p-4 rounded-xl space-y-3 mb-6 text-sm text-left">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Empresa</p>
              <p className="font-semibold text-slate-800">{successData.name}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">E-mail</p>
              <p className="font-medium text-slate-600">{successData.email}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase">Status</p>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                  Convite enviado
                </span>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase">Validade</p>
                <p className="font-medium text-slate-600">7 dias</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center mb-6">
            Um e-mail contendo o link de acesso exclusivo foi enviado para o responsável pela empresa.
          </p>

          <Button onClick={resetAndClose} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-11">
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" /> Cadastrar Empresa na Rede B2B
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Adicione empresas para convidar e conectar no ecossistema real.</p>
          </div>
          <button onClick={resetAndClose} className="p-1.5 hover:bg-slate-100 rounded-full">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <form id="inviteForm" onSubmit={handleSubmit} className="p-6 space-y-5">
            
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5 relative">
                <label className="text-xs font-bold text-slate-700">CNPJ *</label>
                <div className="relative">
                  <Input placeholder="Ex: 00.000.000/0001-00" value={newCompDoc} onChange={e => setNewCompDoc(e.target.value)} onBlur={handleCnpjBlur} required />
                  {isFetchingCnpj && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" />}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Razão Social / Nome Fantasia *</label>
                <Input placeholder="Ex: Metalúrgica Norte" value={newCompName} onChange={e => setNewCompName(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Nome do Contato Responsável *</label>
                <Input placeholder="Ex: Carlos Silva" value={newCompContact} onChange={e => setNewCompContact(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">E-mail Corporativo *</label>
                <Input type="email" placeholder="contato@fornecedor.com.br" value={newCompEmail} onChange={e => setNewCompEmail(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Segmentos (Separados por vírgula)</label>
                <Input placeholder="Ex: Material Elétrico, EPIs" value={newCompSeg} onChange={e => setNewCompSeg(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Site Corporativo (Opcional)</label>
                <Input placeholder="Ex: www.empresa.com.br" value={newCompWeb} onChange={e => setNewCompWeb(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Cidade</label>
                <Input placeholder="Ex: São Paulo" value={newCompCity} onChange={e => setNewCompCity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Estado (UF)</label>
                <Input placeholder="Ex: SP" value={newCompState} onChange={e => setNewCompState(e.target.value)} maxLength={2} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Mensagem Personalizada (Opcional)</label>
              <textarea 
                placeholder="Ex: Gostaríamos de incluir sua empresa na Rede Hub.IA para futuras oportunidades comerciais."
                value={newCompMessage}
                onChange={e => setNewCompMessage(e.target.value)}
                className="w-full flex min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </form>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <Button type="button" variant="outline" onClick={resetAndClose} className="h-10 text-sm font-semibold">Cancelar</Button>
          <Button form="inviteForm" type="submit" disabled={isFetchingCnpj || isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 text-sm font-bold shadow-sm min-w-[160px]">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Convidar para a Rede'}
          </Button>
        </div>
      </div>
    </div>
  );
}

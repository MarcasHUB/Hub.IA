import React, { useState } from 'react';
import { Building2, X, Loader2, CheckCircle2 } from 'lucide-react';
import { Input } from '@/shared/components/ui/Input';
import { Button } from '@/shared/components/ui/Button';
import { supabase } from '@/infrastructure/supabase/client';
import { maskCNPJ } from '@/shared/utils/formatters';

interface EditInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedData: any) => void;
  partner: any; // Partner type
}

export function EditInviteModal({ isOpen, onClose, onSuccess, partner }: EditInviteModalProps) {
  const [tenantId, setTenantId] = useState<string>('');

  React.useEffect(() => {
    try {
      const orgId = localStorage.getItem('supplyhub_organization_id') || '00000000-0000-0000-0000-000000000000';
      setTenantId(orgId);
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
  const [newCompMessage, setNewCompMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState<'update' | 'resend'>('update');
  const [successData, setSuccessData] = useState<{name: string, email: string, mode: string} | null>(null);

  React.useEffect(() => {
    if (isOpen && partner) {
      setNewCompName(partner.name || '');
      setNewCompDoc(partner.document ? maskCNPJ(partner.document) : '');
      setNewCompEmail(partner.email || '');
      setNewCompSeg(partner.segment && partner.segment !== 'Não definido' ? partner.segment : '');
      setNewCompCity(partner.city !== '-' ? partner.city : '');
      setNewCompState(partner.state !== '-' ? partner.state : '');
      setNewCompContact(partner.contact_name || '');
      setNewCompMessage(partner.message || '');
    }
  }, [isOpen, partner]);

  if (!isOpen || !partner) return null;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim() || !newCompDoc.trim() || !newCompEmail.trim() || !newCompContact.trim()) return;
    
    setIsSubmitting(true);

    try {
      // Atualiza na tabela 'invitations'
      const { data: updated, error: inviteError } = await supabase.from('invitations').update({
        name: newCompName,
        company: newCompName,
        email: newCompEmail,
        document: newCompDoc,
        city: newCompCity,
        state: newCompState,
        contact_name: newCompContact,
        message: newCompMessage,
        segments: newCompSeg ? [newCompSeg] : [],
        updated_at: new Date().toISOString()
      }).eq('id', partner.id).select().single();

      if (inviteError) {
        alert(`Erro ao atualizar convite no banco: ${inviteError.message}`);
        setIsSubmitting(false);
        return;
      }

      if (submitMode === 'resend') {
        try {
          const { EmailService } = await import('@/shared/utils/EmailService');
          const emailRes = await EmailService.sendTransactionalEmail('supplier_invite', updated.token_hash);
          if (!emailRes.success) {
            console.warn('Convite salvo, mas falha no reenvio do e-mail:', emailRes.message);
          }
        } catch (err) {
          console.error('Erro ao chamar EmailService:', err);
        }
      }

      setSuccessData({
        name: newCompName,
        email: newCompEmail,
        mode: submitMode
      });

      onSuccess({
        ...partner,
        name: newCompName,
        document: newCompDoc,
        segment: newCompSeg || 'Não definido',
        city: newCompCity || '-',
        state: newCompState || '-',
        email: newCompEmail,
        contact_name: newCompContact,
        message: newCompMessage,
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
          <h2 className="text-xl font-bold text-slate-900 mb-2">Convite atualizado com sucesso</h2>
          
          <div className="w-full bg-slate-50 p-4 rounded-xl space-y-3 mb-6 text-sm text-left">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Empresa</p>
              <p className="font-semibold text-slate-800">{successData.name}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">E-mail</p>
              <p className="font-medium text-slate-600">{successData.email}</p>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center mb-6">
            {successData.mode === 'resend' ? 'Um novo e-mail contendo o link de acesso exclusivo foi reenviado para o responsável.' : 'Os dados do convite foram atualizados internamente.'}
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
              <Building2 className="h-5 w-5 text-indigo-600" /> Editar Convite Enviado
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Atualize os dados e opte por reenviar o e-mail.</p>
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
                  <Input placeholder="Ex: 00.000.000/0001-00" value={newCompDoc} onChange={e => setNewCompDoc(maskCNPJ(e.target.value))} disabled required />
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

            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Segmentos (Separados por vírgula)</label>
                <Input placeholder="Ex: Material Elétrico, EPIs" value={newCompSeg} onChange={e => setNewCompSeg(e.target.value)} />
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
          <Button 
            type="button" 
            disabled={isSubmitting} 
            onClick={(e) => { setSubmitMode('update'); handleSubmit(e); }}
            className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 h-10 text-sm font-bold shadow-sm px-6"
          >
            Atualizar somente
          </Button>
          <Button 
            type="button" 
            disabled={isSubmitting} 
            onClick={(e) => { setSubmitMode('resend'); handleSubmit(e); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 text-sm font-bold shadow-sm px-6"
          >
            {isSubmitting && submitMode === 'resend' ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
            Atualizar e reenviar convite
          </Button>
        </div>
      </div>
    </div>
  );
}
